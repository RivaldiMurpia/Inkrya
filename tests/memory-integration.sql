begin;
insert into auth.users(id) values ('11111111-1111-4111-8111-111111111111'),('22222222-2222-4222-8222-222222222222');
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
set local role authenticated;
insert into public.projects(id,title) values ('33333333-3333-4333-8333-333333333333','Memory QA'),('55555555-5555-4555-8555-555555555555','Other QA');
insert into public.chapters(id,project_id,title,plain_text) values
('44444444-4444-4444-8444-444444444444','33333333-3333-4333-8333-333333333333','Bab 1','Aurel bekerja di kantor BUMN di Duri. Kenan menghubungi Aurel untuk jastip skincare.'),
('66666666-6666-4666-8666-666666666666','33333333-3333-4333-8333-333333333333','Bab panjang',repeat('Hujan turun pelan di halaman rumah. ',16667)||' Nama kapal rahasia itu adalah ZafirOmega.'),
('77777777-7777-4777-8777-777777777777','55555555-5555-4555-8555-555555555555','Proyek lain','ZafirOmega berada di proyek lain.');
select public.process_memory('33333333-3333-4333-8333-333333333333',true);
select public.process_memory('33333333-3333-4333-8333-333333333333',true);
select public.process_memory('55555555-5555-4555-8555-555555555555',true);
do $$ declare count_before integer;s public.story_chunks;g uuid;f public.story_facts;r jsonb;begin
 if not exists(select 1 from public.retrieve_memory('33333333-3333-4333-8333-333333333333','Di mana Aurel bekerja?') where content like '%BUMN di Duri%') then raise exception 'Basic retrieval failed';end if;
 if not exists(select 1 from public.retrieve_memory('33333333-3333-4333-8333-333333333333','ZafirOmega') where chapter_id='66666666-6666-4666-8666-666666666666') then raise exception 'Long text tail missed';end if;
 if exists(select 1 from public.retrieve_memory('33333333-3333-4333-8333-333333333333','ZafirOmega') where chapter_id='77777777-7777-4777-8777-777777777777') then raise exception 'Cross project retrieval';end if;
 if exists(select 1 from public.retrieve_memory('33333333-3333-4333-8333-333333333333','XyzTidakAda')) then raise exception 'Unknown query returned evidence';end if;
 if exists(select 1 from public.story_chunks sc join public.chapters c on c.id=sc.chapter_id where sc.content<>substring(c.plain_text from sc.start_offset+1 for sc.end_offset-sc.start_offset)) then raise exception 'Offsets incorrect';end if;
 select count(*) into count_before from public.story_chunks;
 perform public.process_memory('33333333-3333-4333-8333-333333333333',true);
 if count_before<>(select count(*) from public.story_chunks) then raise exception 'Duplicate job work';end if;
 select * into s from public.story_chunks where chapter_id='44444444-4444-4444-8444-444444444444' limit 1;
 insert into public.ai_generations(project_id,action,prompt,model) values(s.project_id,'brainstorm','QA only','test') returning id into g;
 perform public.save_memory_insights(s.id,g,'Aurel bekerja di Duri.','[{"claim":"Aurel bekerja di Duri","quote":"kantor BUMN di Duri"},{"claim":"Tidak berdasar","quote":"kutipan tidak ada"}]');
 if (select count(*) from public.story_facts where chunk_id=s.id)<>1 then raise exception 'Fact quote validation failed';end if;
 select * into f from public.story_facts where chunk_id=s.id;
 if f.status<>'pending' then raise exception 'Fact auto approved';end if;
 update public.story_facts set claim='Pegawai korporasi Nusantara' where id=f.id;
 if exists(select 1 from public.retrieve_memory(s.project_id,'Nusantara')) then raise exception 'Pending fact used';end if;
 perform public.review_story_fact(f.id,1,'approved','Pegawai korporasi Nusantara');
 if not exists(select 1 from public.retrieve_memory(s.project_id,'Nusantara') where id=s.id) then raise exception 'Approved fact not retrieved';end if;
 perform public.review_story_fact(f.id,2,'ignored','Pegawai korporasi Nusantara');
 if exists(select 1 from public.retrieve_memory(s.project_id,'Nusantara')) then raise exception 'Ignored fact used';end if;
 perform public.review_story_fact(f.id,3,'approved','Pegawai korporasi Nusantara');
 update public.chapters set plain_text='Aurel pindah ke Bandung.',revision_number=1 where id=s.chapter_id;
 if exists(select 1 from public.retrieve_memory(s.project_id,'Nusantara BUMN Duri') where chapter_id=s.chapter_id) then raise exception 'Stale chunk returned';end if;
 begin perform public.save_memory_insights(s.id,g,'Old','[]');raise exception 'Stale insight allowed';exception when raise_exception then if sqlerrm<>'STALE_SOURCE' then raise;end if;end;
 begin perform public.review_story_fact(f.id,1,'approved',f.claim);raise exception 'Stale approval allowed';exception when raise_exception then if sqlerrm<>'STALE_SOURCE' then raise;end if;end;
 if not exists(select 1 from public.story_facts where id=f.id and status='approved') then raise exception 'Approved fact history lost';end if;
 r:=public.memory_overview(s.project_id);
 if (r->'facts'->0->>'current')::boolean then raise exception 'Stale fact shown current';end if;
 perform public.process_memory(s.project_id,true);
 if not exists(select 1 from public.retrieve_memory(s.project_id,'Bandung') where chapter_id=s.chapter_id) then raise exception 'Updated text missing';end if;
end $$;
select set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',true);
do $$begin
 if has_function_privilege('authenticated','private.dispatch_memory()','EXECUTE') then raise exception 'Dispatcher exposed';end if;
 if (private.process_memory_core('33333333-3333-4333-8333-333333333333',true)->>'processed')::boolean then raise exception 'Private core bypasses RLS';end if;
 if exists(select 1 from public.story_chunks where project_id='33333333-3333-4333-8333-333333333333') then raise exception 'RLS chunk leak';end if;
 begin perform public.retrieve_memory('33333333-3333-4333-8333-333333333333','Aurel');raise exception 'Unauthorized retrieval';exception when raise_exception then if sqlerrm<>'NOT_FOUND' then raise;end if;end;
 begin perform public.process_memory('33333333-3333-4333-8333-333333333333',true);raise exception 'Unauthorized worker';exception when raise_exception then if sqlerrm<>'NOT_FOUND' then raise;end if;end;
end $$;
select 'PASS: 100k-word source, offsets, idempotency, retrieval, evidence, approval, revision invalidation, cross-project/user isolation' as result;
reset role;
update public.chapters set plain_text='AutonomousMarker cerita baru.',revision_number=2 where id='44444444-4444-4444-8444-444444444444';
update public.memory_jobs set available_at=now()-interval '1 minute' where chapter_id='44444444-4444-4444-8444-444444444444';
select private.dispatch_memory();
do $$begin
 if not exists(select 1 from public.memory_jobs where chapter_id='44444444-4444-4444-8444-444444444444' and status='ready' and source_revision=2) then raise exception 'Scheduled dispatcher did not index due chapter';end if;
end $$;
select 'PASS: autonomous dispatcher indexes due chapter without user JWT impersonation' as background_result;
rollback;
