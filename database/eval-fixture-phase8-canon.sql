-- Phase 8 evaluation fixture corpus, part 2 of 2 — canon rows.
-- Apply ONLY after `eval-fixture-phase8.sql` + process_memory() chunked the chapters
-- (these joins require the chunk with chunk_index=0 of each chapter to exist).
-- Idempotent like part 1: the project delete in part 1 resets everything, so re-running
-- the pair (base → chunk → canon) is always the safe path.
-- All rows are written at status='CANON' — a known accepted state, NOT model extraction.
-- All quotes are verified verbatim substrings of the chapter plain_text.
-- Fixture map: F1 (fact, Ch1) · F4 (facts Ch1+Ch2) · F5 (facts Ch3+Ch4, event Ch7)
--   F6 (event death Ch5) · F8 (fact Ch9) · F9 (fact Ch6) · F10 (fact Ch10)
--   F3 (knowledge row Ch8); F2 is deliberately NOT a row — "Mira has no established Helios
--   knowledge before Ch8" is expressed by the ABSENCE of a pre-Ch8 knows=true Helios row,
--   which is exactly what the abstention case tests.
-- NOTE ON FKs: fact/knowledge rows here use source_chapter_id / learned_at_chapter_id but
-- story_facts.source_chapter_id and knowledge learned_at_chapter_id are ON DELETE SET NULL,
-- so re-applying part 1 while canon rows exist cascades chunk deletes and would leave these
-- rows orphaned — that is why the ordered pair (part 1 wipes the project first) is required.

begin;

-- Facts (F1, F4, F5, F8, F9, F10)
insert into public.story_facts (project_id, chunk_id, source_chapter_id, claim, quote, subject, predicate, object, status, confidence)
select f.project_id, sc.id, c.id, v.claim, v.quote, v.subject, v.predicate, v.object, 'CANON', 1.0
from (values
 ('Bab 1 — Deteksi Pertama','Arka Vale','knows','Project Helios exists',
  'Ia tahu proyek yang bersembunyi di balik sinyal itu bernama Project Helios'),
 ('Bab 1 — Deteksi Pertama','Arka Vale','behavior','avoids firearms',
  'Arka menolak dengan tangan yang gemetar'),
 ('Bab 2 — Arsip Terkunci','Arka Vale','behavior','refuses to carry firearms',
  'Arka menolaknya dengan jelas, ia bahkan tidak mau memegang gagangnya'),
 ('Bab 3 — Nama di Kebisingan','the world','evidence','Project Helios is real',
  'nama Project Helios-nya muncul berulang kali'),
 ('Bab 3 — Nama di Kebisingan','Dr. Elias Vale','status','alive on 2048-03-07',
  'Dr. Elias Vale masih hidup'),
 ('Bab 4 — Sebelum Keheningan','Dr. Elias Vale','status','alive on 2045-08-19',
  'Dr. Elias Vale masih hidup dan mengetik catatan proyek'),
 ('Bab 4 — Sebelum Keheningan','Arka Vale','origin','firearm trauma from the 2045 robbery',
  'melihat ayahnya terluka oleh perampok bersenjata di pintu laboratorium'),
 ('Bab 6 — Koordinat Palsu','Helios Station','access','public access closed, core-team only',
  'akses publik ditutup'),
 ('Bab 9 — Garis Darah','Mira Voss','family','half-sister of Arka Vale',
  'Mira Voss adalah saudara tiri Arka Vale'),
 ('Bab 10 — Sinyal Terakhir','Helios transmissions','rule','detectable only with the tower receiver configuration',
  'transmisi Helios tidak dapat dideteksi tanpa receiver dengan konfigurasi khusus')
) as v(chapter_title, subject, predicate, object, quote)
join public.projects f on f.title = 'Eval Fixture — The Last Signal'
join public.chapters c on c.project_id = f.id and c.title = v.chapter_title
join public.story_chunks sc on sc.chapter_id = c.id and sc.chunk_index = 0;

-- Events (F5 via Ch7 flashback, F6 death, plus the reveal anchors)
insert into public.timeline_events (project_id, chapter_id, chunk_id, story_time, title, description, event_type, quote, status)
select f.project_id, c.id, sc.id, v.story_time, v.title, v.description, v.event_type, v.quote, 'CANON'
from (values
 ('Bab 1 — Deteksi Pertama','2048-03-02','Arka mendeteksi Sinyal Terakhir untuk pertama kalinya','detektor menangkap frekuensi anomali','discovery','Arka Vale berdiri di atap menara komunikasi'),
 ('Bab 4 — Sebelum Keheningan','2045-08-19','Perampok bersenjata melukai Dr. Vale di pintu laboratorium','asal trauma senjata api Arka','conflict','melihat ayahnya terluka oleh perampok bersenjata'),
 ('Bab 5 — Kanal yang Mati','2048-03-11','Dr. Elias Vale meninggal','kecelakaan nitrogen di laboratorium','death','Dr. Elias Vale meninggal di lantai laboratoriumnya pada tanggal 11 Maret 2048'),
 ('Bab 7 — Laboratorium Lama','2045-08-20','Dr. Vale memutar rekaman Sinyal Terakhir pertama untuk remaja Arka','kilas balik sehari setelah kebakaran gudang','event','Dr. Elias Vale masih hidup dan berdiri di antara pecahan kaca'),
 ('Bab 8 — Helios Terbuka','2048-04-17','Arka membuka seluruh rahasia Project Helios kepada Mira','pengakuan di ruang arsip','reveal','Untuk pertama kalinya Mira mengetahui bahwa Project Helios itu nyata'),
 ('Bab 9 — Garis Darah','2048-04-19','Surat peninggalan mengungkap Mira adalah saudara tiri Arka','pengungkapan garis darah','reveal','Mira Voss adalah saudara tiri Arka Vale'),
 ('Bab 10 — Sinyal Terakhir','2048-04-21','Konvergensi di Helios Station; sinyal mengucapkan kalimat pertamanya','penyalaan panel konfigurasi','event','Konvergensi terakhir membawa mereka ke Helios Station')
) as v(chapter_title, story_time, title, description, event_type, quote)
join public.projects f on f.title = 'Eval Fixture — The Last Signal'
join public.chapters c on c.project_id = f.id and c.title = v.chapter_title
join public.story_chunks sc on sc.chapter_id = c.id and sc.chunk_index = 0;

-- Knowledge (F3 + supporting transitions; F2 asserted by absence of a pre-Ch8 Helios row)
insert into public.character_knowledge (project_id, character_id, fact_key, statement, knows, learned_at_chapter_id, learned_at_story_time, chunk_id, quote, status)
select f.project_id, ch.id, v.fact_key, v.statement, true, c.id, v.story_time, sc.id, v.quote, 'CANON'
from (values
 ('Arka Vale','helios_exists','Arka tahu Project Helios ada sejak sebelum Bab 1',
  '2048-03-02','Bab 1 — Deteksi Pertama','Ia tahu proyek yang bersembunyi di balik sinyal itu bernama Project Helios'),
 ('Mira Voss','helios_exists','Mira mengetahui bahwa Project Helios itu nyata',
  '2048-04-17','Bab 8 — Helios Terbuka','Untuk pertama kalinya Mira mengetahui bahwa Project Helios itu nyata'),
 ('Mira Voss','trauma_senjata_arka','Mira tidak mengetahui asal trauma senjata api Arka',
  '2048-03-04','Bab 2 — Arsip Terkunci','tetapi tidak mengetahui asal trauma senjata api yang membuat Arka begitu'),
 ('Arka Vale','kematian_dr_vale','Arka menerima kabar kematian ayahnya',
  '2048-03-11','Bab 5 — Kanal yang Mati','Arka menerima telepon itu di menara, diam'),
 ('Mira Voss','hubungan_saudara','Mira mengetahui ia saudara tiri Arka',
  '2048-04-19','Bab 9 — Garis Darah','Mira Voss adalah saudara tiri Arka Vale'),
 ('Arka Vale','hubungan_saudara','Arka mengetahui Mira adalah saudara tirinya',
  '2048-04-19','Bab 9 — Garis Darah','Mira Voss adalah saudara tiri Arka Vale')
) as v(character_name, fact_key, statement, story_time, chapter_title, quote)
join public.projects f on f.title = 'Eval Fixture — The Last Signal'
join public.characters ch on ch.project_id = f.id and ch.name = v.character_name
join public.chapters c on c.project_id = f.id and c.title = v.chapter_title
join public.story_chunks sc on sc.chapter_id = c.id and sc.chunk_index = 0;

commit;
