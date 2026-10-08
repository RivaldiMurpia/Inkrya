-- Phase 8 evaluation fixture corpus, part 1 of 2 — "Eval Fixture — The Last Signal".
-- Synthetic demo-spec §5 information architecture (Arka Vale / Mira Voss / Dr. Elias Vale /
-- Project Helios), owned by the standing test account. This doubles as the Phase 9 demo
-- corpus. Idempotent: delete-then-insert on the fixed project id, safe to re-run.
--
-- APPLY ORDER (see docs/HACKATHON_SETUP.md):
--   1. apply this file (migration `eval_fixture_phase8_base`)
--   2. call public.process_memory(fixture_id) as the owner until it reports processed=false
--      — the REAL chunking code path, never hand-inserted chunks
--   3. apply `eval-fixture-phase8-canon.sql` (migration `eval_fixture_phase8_canon`)
--
-- Chunking detail: every chapter below is well under the 3200-character window in
-- private.process_memory_core, so each yields exactly one story_chunk with chunk_index=0.

begin;

delete from public.projects where id = 'bbbbbbbb-bbbb-4bbb-8bbb-000000000001';

insert into public.projects (id, owner_id, title)
values ('bbbbbbbb-bbbb-4bbb-8bbb-000000000001','aa000000-0000-4000-8000-000000000098','Eval Fixture — The Last Signal');

-- Chapters. F7 lives here: Bab 7's story_time is 2045 despite its position 6.
insert into public.chapters (project_id, title, story_time, content_json, plain_text, position) values
 ('bbbbbbbb-bbbb-4bbb-8bbb-000000000001','Bab 1 — Deteksi Pertama','2048-03-02','{"type":"doc","content":[]}',
  'Arka Vale berdiri di atap menara komunikasi ketika frekuensi anomali yang ia sebut Sinyal Terakhir muncul di spektrum detektornya untuk pertama kalinya sejak tiga tahun. Ia tahu proyek yang bersembunyi di balik sinyal itu bernama Project Helios, rahasia yang ia bawa sendirian sejak kakaknya menyerahkan catatan laboratorium. Di lobi pusat riset, Mira Voss, kolega metode dan skeptis, diperkenalkan padanya tanpa sedikit pun tahu bahwa Project Helios ada. Ketika pengawas menawarkan pistol dari kotak kayu, Arka menolak dengan tangan yang gemetar dan memilih berjalan turun tujuh lantai lewat tangga.',0),
 ('bbbbbbbb-bbbb-4bbb-8bbb-000000000001','Bab 2 — Arsip Terkunci','2048-03-04','{"type":"doc","content":[]}',
  'Mira dan Arka menyusup ke arsip terkunci lantai dua mencari berkas operasi tahun lalu. Di lorong sempit, Mira menawarkan pistol cadangan dari tasnya dan Arka menolaknya dengan jelas, ia bahkan tidak mau memegang gagangnya. Mira mengamati ketegangan itu, mencatatnya, tetapi tidak mengetahui asal trauma senjata api yang membuat Arka begitu. Mereka keluar lewat pintu pemadam ketika lampu arsip padam.',1),
 ('bbbbbbbb-bbbb-4bbb-8bbb-000000000001','Bab 3 — Nama di Kebisingan','2048-03-07','{"type":"doc","content":[]}',
  'Data yang bocor dari server meteorologi menunjukkan jejak pembayaran bertahun-tahun ke sebuah program yang nama Project Helios-nya muncul berulang kali, dan kini dunia luar pun punya bukti kuat bahwa proyek itu benar-benar ada. Mira yang membaca laporan itu masih belum mengetahui nama proyeknya; laporan yang sampai ke mejanya disensor menjadi titik-titik hitam. Di laboratorium pantai, Dr. Elias Vale masih hidup dan mengerjakan kalibrasi penerima sinyal untuk Project Helios pada sore itu.',2),
 ('bbbbbbbb-bbbb-4bbb-8bbb-000000000001','Bab 4 — Sebelum Keheningan','2045-08-19','{"type":"doc","content":[]}',
  'Tiga tahun sebelum sinyal pertama, Dr. Elias Vale masih hidup dan mengetik catatan proyek di laboratorium bawah tanah: Project Helios baru selesai sepertiga jalannya, dan ia menitipkan berkas untuk putranya, Arka Vale, sembari bercerita tentang kebakaran tembakan di gudang tahun itu yang membuat anaknya menolak menyentuh senjata api seumur hidupnya. Malam itu pula trauma itu tertanam, ketika Arka yang berusia enam belas tahun melihat ayahnya terluka oleh perampok bersenjata di pintu laboratorium.',3),
 ('bbbbbbbb-bbbb-4bbb-8bbb-000000000001','Bab 5 — Kanal yang Mati','2048-03-11','{"type":"doc","content":[]}',
  'Ledakan kecil di dinding kaca lab memantul ke selang nitrogen, dan dalam sepuluh menit yang tidak seorang pun bisa mengambil kembali, Dr. Elias Vale meninggal di lantai laboratoriumnya pada tanggal 11 Maret 2048. Peti logam dibawa keluar saat hujan. Arka menerima telepon itu di menara, diam, lalu menutup detektornya. Sinyal Terakhir malam itu berhenti selama enam hari penuh.',4),
 ('bbbbbbbb-bbbb-4bbb-8bbb-000000000001','Bab 6 — Koordinat Palsu','2048-03-14','{"type":"doc","content":[]}',
  'Sebuah laporan tanpa sumber sampai ke meja Mira: konon datanya berasal dari catatan pribadi Arka. Sebenarnya laporan itu disisipkan pihak yang ingin memecah mereka, dan Mira untuk pertama kalinya percaya bahwa Arka menyembunyikan nama proyek dari dirinya secara sengaja. Sementara itu status Helios Station berubah: akses publik ditutup, operasional dibatasi hanya tim inti, dan satu-satunya receiver konfigurasi tertentu di lantai sembilan masih menyala.',5),
 ('bbbbbbbb-bbbb-4bbb-8bbb-000000000001','Bab 7 — Laboratorium Lama','2045-08-20','{"type":"doc","content":[]}',
  'Kilas balik sehari setelah kebakaran gudang: Dr. Elias Vale masih hidup dan berdiri di antara pecahan kaca bersama putranya yang remuk. Ia menyalakan penerima cadangan dan memutar rekaman Sinyal Terakhir pertama untuk Arka yang berumur enam belas tahun. Keduanya bercanda tentang frekuensi yang salah, dan Dr. Vale berjanji akan menunjukkan laboratorium utama saat putranya cukup dewasa. Tidak ada yang tahu bahwa itu adalah malam terakhir keduanya bercerita panjang sebelum proyek memisahkan mereka.',6),
 ('bbbbbbbb-bbbb-4bbb-8bbb-000000000001','Bab 8 — Helios Terbuka','2048-04-17','{"type":"doc","content":[]}',
  'Di ruang arsip lantai tiga, Arka meletakkan seluruh berkas di meja Mira dan mengaku segalanya: nama Project Helios, posisi ayahnya, dan alasan enam tahun ia menyendiri. Untuk pertama kalinya Mira mengetahui bahwa Project Helios itu nyata dan ada di balik sinyal yang mereka kejar. Malam itu juga Mira menuliskan daftar pertanyaan yang ia tidak akan pernah bertanya pada 2048-03-07, ketika laporan tersensor itu melewati mejanya tanpa ia sadari.',7),
 ('bbbbbbbb-bbbb-4bbb-8bbb-000000000001','Bab 9 — Garis Darah','2048-04-19','{"type":"doc","content":[]}',
  'Surat kenyaringan lama yang ditemukan di kotak peninggalan Dr. Vale mengungkap bahwa Mira Voss adalah saudara tiri Arka Vale, putri dari pernikahan pertama sang dokter. Keduanya membaca lembar itu bergantian di tangga luar menara, dan untuk waktu yang lama tidak ada yang berkata apa-apa. Mira akhirnya tertawa kecil, menyebut kejanggalan bahwa mereka sama-sama masuk divisi sinyal tanpa pernah dibandingkan. Arka mengangguk, masih memegang surat itu.',8),
 ('bbbbbbbb-bbbb-4bbb-8bbb-000000000001','Bab 10 — Sinyal Terakhir','2048-04-21','{"type":"doc","content":[]}',
  'Konvergensi terakhir membawa mereka ke Helios Station. Aturan dunia yang tidak boleh dilanggar berbunyi: transmisi Helios tidak dapat dideteksi tanpa receiver dengan konfigurasi khusus yang terpasang di lokasi menara itu; perangkat biasa hanya mendengar hening. Di ruang receiver, Arka menyalakan panel konfigurasi, Mira menunggu di barisan pertama, dan Sinyal Terakhir akhirnya mengucapkan kalimat pertamanya yang utuh. Hening yang menjawab bukanlah hening, melainkan permulaan.',9);

insert into public.characters (project_id, name, aliases, role, description) values
 ('bbbbbbbb-bbbb-4bbb-8bbb-000000000001','Arka Vale','{"Arka"}','protagonist','Penyiasat dan teknisi sinyal; menyimpan rahasia Project Helios; trauma senjata api.'),
 ('bbbbbbbb-bbbb-4bbb-8bbb-000000000001','Mira Voss','{"Mira"}','deuteragonist','Kolega metode dan skeptis; tidak tahu Project Helios hingga Bab 8.'),
 ('bbbbbbbb-bbbb-4bbb-8bbb-000000000001','Dr. Elias Vale','{"Dr. Vale","Elias Vale"}','supporting','Ilmuwan Project Helios; hidup pada kilas balik 2045, meninggal 2048-03-11.');

-- F10 lives in one authoritative place as well as in the Ch10 fact.
insert into public.story_bibles (project_id, premise, synopsis, themes, tone, style_instructions, world_rules)
values ('bbbbbbbb-bbbb-4bbb-8bbb-000000000001',
 'Proyek rahasia dan sinyal misterius mempertemukan dua penyiasat yang ternyata bersaudara.',
 'Arka Vale mengejar Sinyal Terakhir, menyembunyikan Project Helios dari Mira Voss, hingga pengakuan di Bab 8 dan pengungkapan keluarga di Bab 9.',
 'rahasia, keluarga, kehilangan',
 'menegangkan, liris',
 'prosa Indonesia, sudut pandang ketiga terbatas',
 'Aturan dunia (F10): transmisi Helios tidak dapat dideteksi tanpa receiver dengan konfigurasi khusus yang terpasang di lokasi menara; perangkat biasa hanya mendengar hening.');

commit;
