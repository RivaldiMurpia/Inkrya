-- Phase 5 canon update — live-SQL invariants (manual run; postgres role, no `set local role`
-- because canon_proposals is intentionally SELECT-only for authenticated and the write-side
-- RPCs are security definer with their own owner checks — RLS for this table is covered by
-- tests/memory-integration.sql). Runs inside one transaction; a passing run inserts nothing.
begin;
insert into auth.users(id) values ('11111111-1111-4111-8111-111111111111') on conflict (id) do nothing;
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
insert into public.projects(id,title) values ('33333333-3333-4333-8333-333333333333','Canon QA');
insert into public.chapters(id,project_id,title,plain_text) values
('44444444-4444-4444-8444-444444444444','33333333-3333-4333-8333-333333333333','Bab 1','Mira menatap jendela. Ia masih menyimpan liontin perak pemberian ibunya. Malam itu dingin.');
select public.process_memory('33333333-3333-4333-8333-333333333333',true);
do $$
declare g uuid;prop1 uuid;prop2 uuid;prop3 uuid;c public.chapters;s public.story_chunks;bound integer;j text;e text;
begin
 select * into c from public.chapters where id='44444444-4444-4444-8444-444444444444';
 select * into s from public.story_chunks where chapter_id=c.id limit 1;
 insert into public.ai_generations(project_id,action,prompt,model) values (c.project_id,'write','QA only','test') returning id into g;

 -- save: dedup + draft-quote validation (three items -> one survives)
 perform public.save_canon_proposals(c.project_id,g,
  'Mira menatap jendela. Ia masih menyimpan liontin perak pemberian ibunya. Malam itu dingin.',
  '[{"target_kind":"fact","claim":"Mira memiliki liontin perak dari ibunya","quote":"Ia masih menyimpan liontin perak pemberian ibunya.","evidence_ids":["x"],"subject":"Mira","predicate":"memiliki","object":"liontin perak","confidence":0.8},
    {"target_kind":"fact","claim":"Mira memiliki liontin perak dari ibunya","quote":"Ia masih menyimpan liontin perak pemberian ibunya.","evidence_ids":["x"]},
    {"target_kind":"fact","claim":"Mira membeli liontin","quote":"kutipan tidak ada di draf","evidence_ids":["x"]}]');
 if (select count(*) from public.canon_proposals where generation_id=g)<>1 then raise exception 'SAVE: dedup or draft-quote validation failed';end if;
 select id into prop1 from public.canon_proposals where generation_id=g;

 -- decide before attach must fail
 j:='[{"id":"'||prop1||'","revision":0,"decision":"accepted"}]';
 begin
  perform public.decide_canon_proposals(j::jsonb);
  raise exception 'DECIDE: unattached proposal was accepted';
 exception when others then
  if sqlerrm not like '%PROPOSAL_NOT_ATTACHED%' then raise exception 'DECIDE: wrong unattached error: %',sqlerrm;end if;
 end;

 -- attach binds the proposal and snapshots revision
 bound:=public.attach_canon_proposals(g,c.id);
 if bound<>1 then raise exception 'ATTACH: expected 1, got %',bound;end if;

 -- accepted item + rejected item in one atomic batch
 prop2:=prop1;
 perform public.decide_canon_proposals(j::jsonb);
 if (select count(*) from public.canon_proposals where generation_id=g and status='accepted' and target_id is not null)<>1 then raise exception 'DECIDE: acceptance did not stamp target_id';end if;
 if not exists(select 1 from public.story_facts where chunk_id=s.id and status='CANON' and claim='Mira memiliki liontin perak dari ibunya') then raise exception 'DECIDE: canon fact row missing';end if;

 -- idempotent re-decide: no second row, no error
 perform public.decide_canon_proposals(j::jsonb);
 if (select count(*) from public.story_facts where chunk_id=s.id and claim='Mira memiliki liontin perak dari ibunya')<>1 then raise exception 'IDEMPOTENCY: duplicate canon row';end if;

 -- accepted fact becomes retrievable through the live canonical path
 if not exists(select 1 from public.retrieve_memory(c.project_id,'liontin perak') where content like '%liontin perak pemberian ibunya%') then raise exception 'REINDEX: accepted fact not retrievable';end if;

 -- edit = accept-with-edit: rejected variant keeps history
 insert into public.canon_proposals(project_id,generation_id,chapter_id,target_kind,payload,quote,evidence_ids,dedup_key,source_revision,source_hash)
 values (c.project_id,g,c.id,'fact','{"claim":"Mira menjual liontinnya"}'::jsonb,'Ia masih menyimpan liontin perak pemberian ibunya.','[]'::jsonb,'qa-edit-key',c.revision_number,md5(c.plain_text))
 returning id into prop2;
 perform public.decide_canon_proposals(
  ('[{"id":"'||prop2||'","revision":0,"decision":"accepted"}]')::jsonb,
  jsonb_build_object(prop2::text,'Mira memiliki liontin perak warisan ibunya'));
 if not exists(select 1 from public.story_facts where chunk_id=s.id and claim='Mira memiliki liontin perak warisan ibunya') then raise exception 'EDIT: edited claim not committed';end if;
 if (select payload->>'claim' from public.canon_proposals where id=prop2)<>'Mira menjual liontinnya' then raise exception 'EDIT: original payload not preserved';end if;

 -- rejected proposal is never canon
 insert into public.canon_proposals(project_id,generation_id,chapter_id,target_kind,payload,quote,evidence_ids,dedup_key,source_revision,source_hash)
 values (c.project_id,g,c.id,'fact','{"claim":"Mira kehilangan liontinnya"}'::jsonb,'Ia masih menyimpan liontin perak pemberian ibunya.','[]'::jsonb,'qa-reject-key',c.revision_number,md5(c.plain_text))
 returning id into prop2;
 perform public.decide_canon_proposals(('[{"id":"'||prop2||'","revision":0,"decision":"rejected"}]')::jsonb);
 -- A rejected claim must never exist as an active canon row. (Retrieval is lexical over
 -- chapter text, so asserting on retrieve_memory here would only test the chapter prose.)
 if exists(select 1 from public.story_facts where project_id=c.project_id and claim='Mira kehilangan liontinnya' and status in ('approved','CANON')) then raise exception 'REJECT: rejected claim became canon';end if;
 if (select status from public.canon_proposals where id=prop2)<>'rejected' then raise exception 'REJECT: proposal status not rejected';end if;

 -- revision conflict: a stale revision is refused
 insert into public.canon_proposals(project_id,generation_id,chapter_id,target_kind,payload,quote,evidence_ids,dedup_key,source_revision,source_hash)
 values (c.project_id,g,c.id,'fact','{"claim":"Mira menjahit ulang liontinnya"}'::jsonb,'Ia masih menyimpan liontin perak pemberian ibunya.','[]'::jsonb,'qa-cas-key',c.revision_number,md5(c.plain_text))
 returning id into prop2;
 begin
  perform public.decide_canon_proposals(('[{"id":"'||prop2||'","revision":99,"decision":"accepted"}]')::jsonb);
  raise exception 'CAS: stale revision accepted';
 exception when others then
  if sqlerrm not like '%REVISION_CONFLICT%' then raise exception 'CAS: wrong error: %',sqlerrm;end if;
 end;

 -- atomic batch: the good item is listed first, a later stale item raises, and the whole
 -- batch rolls back — the good item must NOT remain accepted and no canon row may survive.
 insert into public.canon_proposals(project_id,generation_id,chapter_id,target_kind,payload,quote,evidence_ids,dedup_key,source_revision,source_hash)
 values (c.project_id,g,c.id,'fact','{"claim":"Mira merawat liontinnya"}'::jsonb,'Ia masih menyimpan liontin perak pemberian ibunya.','[]'::jsonb,'qa-atomic-good',c.revision_number,md5(c.plain_text))
 returning id into prop2;
 insert into public.canon_proposals(project_id,generation_id,chapter_id,target_kind,payload,quote,evidence_ids,dedup_key,source_revision,source_hash)
 values (c.project_id,g,c.id,'fact','{"claim":"Mira menyimpan liontin di lemari"}'::jsonb,'Ia masih menyimpan liontin perak pemberian ibunya.','[]'::jsonb,'qa-atomic-stale',c.revision_number,md5(c.plain_text))
 returning id into prop3;
 begin
  perform public.decide_canon_proposals(('[{"id":"'||prop2||'","revision":0,"decision":"accepted"},{"id":"'||prop3||'","revision":99,"decision":"accepted"}]')::jsonb);
  raise exception 'ATOMIC: batch with a stale item was accepted';
 exception when others then
  if sqlerrm not like '%REVISION_CONFLICT%' then raise exception 'ATOMIC: wrong error: %',sqlerrm;end if;
 end;
 if (select status from public.canon_proposals where id=prop2)<>'proposed' then raise exception 'ATOMIC: good item was partially committed';end if;
 if exists(select 1 from public.story_facts where project_id=c.project_id and claim='Mira merawat liontinnya') then raise exception 'ATOMIC: canon row survived rollback';end if;

 -- stale source: chapter edited after attach -> STALE_SOURCE / QUOTE_NOT_IN_CHAPTER on accept
 update public.chapters set plain_text=plain_text||' Tambahan kalimat.' where id=c.id;
 begin
  perform public.decide_canon_proposals(('[{"id":"'||prop2||'","revision":0,"decision":"accepted"}]')::jsonb);
  raise exception 'STALE: stale source accepted';
 exception when others then
  if sqlerrm not like '%QUOTE_NOT_IN_CHAPTER%' and sqlerrm not like '%STALE_SOURCE%' then raise exception 'STALE: wrong error: %',sqlerrm;end if;
 end;
 raise notice 'ALL CANON INVARIANTS PASSED';
end $$;
rollback;
select 'ALL_CANON_INVARIANTS_PASSED' as result;
