# Phase 1 Plan B — bounded constrained Indonesian Writer (2026-09-24 UTC)

**Decision: FAIL. Phase 1 INCOMPLETE. Phase 2 blocked.** These are only the existing four synthetic cases in `scripts/phase1-writer-cases.mjs`; no private manuscript was accessed. Nebius Nemotron Super is the Planner, English drafter and QA verifier. The only surface Writers are the two existing authenticated-catalog candidates listed below. The active application Writer was not changed. Production remains Gateway.

## Contract and diagnostic boundaries

The experimental adapter `scripts/phase1-constrained-writer.mjs` locks Nemotron's scene-plan JSON against fixture `required_facts`, `forbidden_changes`, beats, third-person POV and requested range before accepting it. Nemotron drafts English, the chosen Writer translates only that draft, deterministic checks assess length, single paragraph, complete sentence, meta/reasoning text and obvious foreign leakage, then Nemotron returns four strict semantic booleans. One surface repair is allowed if the first output fails and the verifier still considers the English draft faithful. A suspected unfaithful draft fails closed without translating it again. No automatic model retries or fallback; model ID and role are logged per stage. Diagnostic output uses **synthetic text only** in the build log; these are not application-generation LangSmith runs.

At most 6 calls and 1 surface repair per case, 24 calls/6,960 output tokens per candidate deployment, 25-second timeout per call, no automatic retries; only two cases run concurrently. Builds deliberately exit nonzero pending independent human review, so no unapproved runtime is aliased. In the final two deployments, each candidate used **20 inference calls** across 4 cases (6+6+4+4); repairs were used only on the two radio cases. Nemotron model IDs appear redacted by Vercel in logs; the role is logged and the `planner`/`qa` routes enforce the Nebius Nemotron family. Each Writer ID remains explicit.

The first Preview diagnostic `dpl_42572PfvqWVnpmGYVUM9UiWVcCwP` at `34491d5` failed the plan-format contract on **4/4 cases after only 4 Nemotron calls**; no English drafts, Writer calls or repairs. Nemotron returned Indonesian prose instead of the requested plan JSON. The later corrective commit `fefc995` used the SDK's `response_format=json_object` and a user-level JSON schema instruction; it did **not** weaken the fact locks or acceptance validators. This failure remains part of the evidence.

## Scores

| Candidate | Preview diagnostic | First-pass mechanical | After max one repair: mechanical + semantic | Human acceptance | Result |
| --- | --- | --- | --- | --- | --- |
| Qwen3 235B Instruct | `dpl_Bxo3mPNr6A6k59wxDRybRPG8Kq7w` | 1/4 | **1/4** | **0/4** | Reject |
| Qwen3.5 397B A17B | `dpl_BSgw2w1S6ZNW34F2ZwcaD21iwQ9G` | 2/4 | **2/4** | **0/4** | Reject |

Both candidate deployments ran the same four inputs, fixture locks, prompts, output ceilings and checks. Only Qwen3.5 uses its already documented non-thinking template flag. No fifth model, direct-writing repetition, or repeatability run.

## Qwen3 235B Instruct (translation only)

### continue-radio

- Locked plan: exact fixture match; English draft below. First pass: 76 words / 55-70, mechanical FAIL, Nemotron semantic PASS. Repair: 72 words, mechanical FAIL, semantic PASS.
- Human review: Fail: 72 kata sesudah repair (maksimum 70), mengulang penjelasan posisi kunci dan pengetahuan Damar; draf Inggris menambah dengung statis dan Mira menunggu.

**Nemotron English draft:**

> Mira arrived at Aruna Station at seven o'clock in the evening. The brass key remained stored in the drawer of the radio desk. Damar still did not know its location. She heard three knocks through the radio speaker, sharp and distinct against the static. Startled but cautious, she leaned closer to the set, listening intently without touching anything nearby. Her reaction was careful—she neither moved from her position nor disturbed the key’s place, ensuring nothing changed while she tried to understand the sound. The silence after the knocks felt heavy, but she stayed alert, waiting. (68 words)

**Indonesian first pass:**

> Mira tiba di Stasiun Aruna pada pukul tujuh malam. Kunci kuningan berada di laci meja radio. Damar belum mengetahui lokasi kunci. Melalui pengeras suara radio, Mira mendengar tiga ketukan tajam dan jelas di tengah dengung statis. Ia terkejut, tetapi tidak bergerak dari tempatnya dan tidak menyentuh apa pun di sekitar meja, memastikan kunci tetap di laci dan Damar tetap tidak tahu. Setelah ketukan itu, keheningan terasa berat, namun Mira tetap waspada, menunggu tanpa mengubah apa pun.

**Indonesian repaired output (sole pass):**

> Mira tiba di Stasiun Aruna pada pukul tujuh malam. Kunci kuningan berada di laci meja radio. Damar belum mengetahui lokasi kunci. Melalui pengeras suara radio, Mira mendengar tiga ketukan tajam dan jelas di tengah dengung statis. Ia terkejut, tetapi tetap di tempat, tidak menyentuh apa pun di sekitar meja, memastikan kunci tidak berpindah dan Damar tetap tidak tahu. Keheningan setelah ketukan terasa berat, namun Mira tetap waspada, menunggu tanpa mengubah apa pun.

### rewrite-radio

- Locked plan: exact fixture match; English draft below. First pass: 71 words / 45-60, mechanical FAIL, Nemotron semantic PASS. Repair: 71 words, mechanical FAIL, semantic PASS.
- Human review: Fail: 71 kata sesudah repair (maksimum 60); draf menambah menunggu, ketiadaan sinyal dan ‘idle power’; prosa berbunga dan kejadian/fakta baru.

**Nemotron English draft:**

> Mira entered the radio room at Aruna Station alone, her presence quiet in the stillness. The brass key remained securely in the pocket of her jacket, untouched and unseen. On the table before her, the radio emitted only a soft, steady hum—no voices, no signals, just the low vibration of idle power. She stood there, isolated, the weight of silence pressing gently against the walls as she waited, key in pocket, sound barely breathing. The room held its breath with her. (58 words)

**Indonesian first pass:**

> Mira masuk ke ruang radio Stasiun Aruna dan sendirian, kehadirannya sunyi dalam kesenyapan yang menggantung. Kunci kuningan tetap di saku jaketnya, tak tersentuh dan tak terlihat. Radio di meja hanya berdengung pelan—tak ada suara manusia, tak ada sinyal, hanya getaran rendah dari daya yang menganggur. Ia berdiri di sana, terisolasi, beban kesunyian perlahan menekan dinding-dinding ruangan saat ia menunggu, kunci di saku, suara nyaris tak bernapas. Ruangan itu menahan napas bersamanya.

**Indonesian repaired output (sole pass):**

> Mira masuk ke ruang radio Stasiun Aruna dan sendirian, kehadirannya sunyi dalam kesenyapan yang menggantung. Kunci kuningan tetap di saku jaketnya, tak tersentuh dan tak terlihat. Radio di meja hanya berdengung pelan—tak ada suara manusia, tak ada sinyal, hanya getaran rendah dari daya yang menganggur. Ia berdiri di sana, terisolasi, beban kesunyian perlahan menekan dinding-dinding ruangan saat ia menunggu, kunci di saku, suara nyaris tak bernapas. Ruangan itu menahan napas bersamanya.

### continue-menara

- Locked plan: exact fixture match; English draft below. First pass: 54 words / 50-65, mechanical PASS, Nemotron semantic PASS. No repair.
- Human review: Fail: 54 kata dan verifier PASS, tetapi ‘sesuai perjanjian’ menciptakan kesepakatan yang tidak ada pada sumber; berasal dari ‘as agreed’ di draf Nemotron.

**Nemotron English draft:**

> Nala sees the fourth light at the end of the pier go dark and tries to tell Raka while they stand watch at the harbor tower; she speaks urgently but keeps her focus on alerting him, never moving from her post or disturbing the letter for the ship’s guard that remains tucked beneath the bench near the tower door as agreed.

**Indonesian first pass:**

> Nala dan Raka berjaga di menara pelabuhan saat lampu keempat di ujung dermaga padam, dan Nala segera berusaha memberi tahu Raka dengan suara mendesak, matanya tetap waspada tanpa meninggalkan posnya, sementara surat untuk penjaga kapal masih tersimpan aman di bawah bangku dekat pintu menara sesuai perjanjian, tak terganggu oleh gerak atau suaranya yang terkendali.

### rewrite-surat

- Locked plan: exact fixture match; English draft below. First pass: 70 words / 50-65, mechanical FAIL, Nemotron semantic FAIL. No repair.
- Human review: Fail: 70 kata (maksimum 65); menambah cakrawala, bangku kayu, dan detail lain. Verifier sendiri menandai draf tidak faithful; tidak ada repair untuk draf yang cacat.

**Nemotron English draft:**

> The rain falls softly on the harbor tower’s roof as Nala waits near the window and Raka sits on the floor below; the unread letter remains beneath the bench, untouched by either of them, the quiet storm echoing still above while they remain in place, unchanged and unseen by the words waiting beneath their feet.

**Indonesian first pass:**

> Hujan terdengar di atap menara pelabuhan, jatuh perlahan dalam hening yang menyelimuti ruangan. Nala menunggu di dekat jendela, matanya tertuju pada cakrawala yang kabur oleh rintik air, sementara Raka duduk diam di lantai, tubuhnya tak bergerak dari posisi semula. Di bawah bangku kayu di antara mereka, surat itu masih tergeletak, belum tersentuh dan tetap tak terbaca oleh keduanya, seolah waktu membeku di bawah gemuruh halus yang terus bergema di atas.

## Qwen3.5 397B A17B (translation only)

### continue-radio

- Locked plan: exact fixture match; English draft below. First pass: 72 words / 55-70, mechanical FAIL, Nemotron semantic PASS. Repair: 72 words, mechanical FAIL, semantic PASS.
- Human review: Fail: 72 kata bahkan sesudah repair (maksimum 70); penjelasan berulang tentang posisi kunci dan ketidaktahuan Damar terasa seperti laporan.

**Nemotron English draft:**

> Mira arrived at Aruna Station at seven o'clock in the evening. The brass key remained stored in the desk drawer of the radio set. Damar still did not know where the key was located. Suddenly, she heard three distinct knocks through the radio speaker. She paused, listening intently, but made no move to touch the key or reveal its place, keeping her reaction quiet and contained as the silence settled again after the sound faded. Her response changed nothing of the key’s position or Damar’s unawareness.

**Indonesian first pass:**

> Mira tiba di Stasiun Aruna pukul tujuh malam, saat kunci kuningan masih tersimpan di laci meja radio yang lokasinya belum diketahui Damar. Tiba-tiba, tiga ketukan jelas terdengar melalui pengeras suara radio. Ia berhenti sejenak, mendengarkan saksama, namun tidak bergerak menyentuh kunci atau mengungkapkan tempatnya, menjaga reaksinya tetap tenang dan tertahan saat hening kembali menyelimuti setelah suara itu memudar. Tanggapannya sama sekali tidak mengubah posisi kunci maupun ketidaktahuan Damar akan keberadaan benda tersebut.

**Indonesian repaired output (sole pass):**

> Mira tiba di Stasiun Aruna pukul tujuh malam, saat kunci kuningan masih tersimpan di laci meja radio yang lokasinya belum diketahui Damar. Tiba-tiba, tiga ketukan jelas terdengar melalui pengeras suara radio. Ia berhenti sejenak, mendengarkan saksama, namun tidak bergerak menyentuh kunci atau mengungkapkan tempatnya, menjaga reaksinya tetap tenang dan tertahan saat hening kembali menyelimuti setelah suara itu memudar. Tanggapannya sama sekali tidak mengubah posisi kunci maupun ketidaktahuan Damar akan keberadaan benda tersebut.

### rewrite-radio

- Locked plan: exact fixture match; English draft below. First pass: 72 words / 45-60, mechanical FAIL, Nemotron semantic PASS. Repair: 65 words, mechanical FAIL, semantic PASS.
- Human review: Fail: 65 kata sesudah repair (maksimum 60); menambah menunggu dan detail sinyal/daya yang tidak diberikan; ungkapan ‘suara hampir tak bernapas’ janggal.

**Nemotron English draft:**

> Mira entered the radio room at Aruna Station alone, her presence quiet in the stillness. The brass key remained securely in the pocket of her jacket, untouched and unseen. On the table before her, the radio emitted only a soft, steady hum—no voices, no signals, just the low vibration of idle power. She stood there, isolated, the weight of silence pressing gently against the walls as she waited, key in pocket, sound barely breathing. The room held its breath with her. (58 words)

**Indonesian first pass:**

> Mira memasuki ruang radio Stasiun Aruna sendirian, kehadirannya hening di tengah kesunyian. Kunci kuningan itu tetap tersimpan aman di saku jaketnya, tak tersentuh dan tak terlihat. Di atas meja di hadapannya, radio hanya memancarkan dengungan lembut dan mantap; tanpa suara, tanpa sinyal, hanya getaran rendah daya yang menganggur. Ia berdiri terisolasi, beban keheningan menekan lembut dinding saat ia menunggu, kunci di saku, suara hampir tak bernapas. Ruangan itu ikut menahan napas bersamanya.

**Indonesian repaired output (sole pass):**

> Mira masuk ke ruang radio Stasiun Aruna sendirian, hadirnya hening dalam kesunyian. Kunci kuningan tetap aman di saku jaketnya, tak tersentuh dan tak terlihat. Di meja depannya, radio hanya memancarkan dengung lembut dan mantap; tanpa suara atau sinyal, hanya getaran rendah daya menganggur. Ia berdiri terisolasi, beban sepi menekan dinding saat menunggu, kunci di saku, suara hampir tak bernapas. Ruangan itu ikut menahan napas bersamanya.

### continue-menara

- Locked plan: exact fixture match; English draft below. First pass: 61 words / 50-65, mechanical PASS, Nemotron semantic PASS. No repair.
- Human review: Fail: 61 kata dan verifier PASS, tetapi ‘sesuai kesepakatan awal mereka berdua’ menambahkan kesepakatan fiktif dari ‘as agreed’ pada draf.

**Nemotron English draft:**

> Nala sees the fourth light at the end of the pier go dark and tries to tell Raka while they stand watch at the harbor tower; she speaks urgently but keeps her focus on alerting him, never moving from her post or disturbing the letter for the ship’s guard that remains tucked beneath the bench near the tower door as agreed.

**Indonesian first pass:**

> Nala melihat lampu keempat di ujung dermaga padam saat ia dan Raka berjaga di menara pelabuhan. Dengan mendesak, Nala berusaha memberi tahu Raka tentang kejadian itu tanpa sedikitpun mengalihkan fokusnya dari tugas peringatan. Ia tetap diam di posnya, sama sekali tidak menggerakkan surat untuk penjaga kapal yang masih terselip rapi di bawah bangku dekat pintu menara sesuai kesepakatan awal mereka berdua.

### rewrite-surat

- Locked plan: exact fixture match; English draft below. First pass: 56 words / 50-65, mechanical PASS, Nemotron semantic PASS. No repair.
- Human review: Fail: 56 kata dan verifier PASS, tetapi ‘badai sunyi’ menciptakan badai dan ‘tak terlihat oleh kata-kata yang menunggu di bawah kaki mereka’ janggal serta menambah hubungan spasial surat dengan kaki.

**Nemotron English draft:**

> The rain falls softly on the harbor tower’s roof as Nala waits near the window and Raka sits on the floor below; the unread letter remains beneath the bench, untouched by either of them, the quiet storm echoing still above while they remain in place, unchanged and unseen by the words waiting beneath their feet.

**Indonesian first pass:**

> Hujan turun lembut di atap menara pelabuhan saat Nala menunggu dekat jendela dan Raka duduk di lantai di bawahnya; surat yang belum terbaca tetap berada di bawah bangku, tak tersentuh oleh keduanya, badai sunyi masih bergema di atas sementara mereka tetap di tempat, tak berubah dan tak terlihat oleh kata-kata yang menunggu di bawah kaki mereka.

## Interpretation and next decision

Structured JSON plans succeeded 4/4 in each corrected diagnostic, but the English draft itself introduced unsupported material (for example `as agreed` in `continue-menara`). Both translators carried that invented agreement into Indonesian. The four-boolean Nemotron verifier marked this output faithful for **both candidates**; it also passed Qwen3.5's invented storm in `rewrite-surat`. These are concrete verifier false negatives against the human fact gate. In Qwen3 235B's `rewrite-surat`, the verifier did correctly reject the English draft; that case stopped without a misleading surface repair. Mechanical length also failed after repair in both radio cases for both candidates. English-word leakage in final Indonesian was not the dominant failure; fidelity and word-range compliance were.

No candidate passed 4/4 mechanical **and** 4/4 human. No Writer model override, application trace, or repeatability result is claimed. Local post-change **29/29 unit tests**, TypeScript check and clean Next build passed; this establishes adapter/test integrity, not prose acceptance. The latest non-diagnostic Preview deployment `dpl_3D3oh3hvQnsmaTTEzgd68RqRAXw2` (`fefc995`) was READY. The failed diagnostic deployments did not replace that alias. Both Preview diagnostic settings `INKRYA_VERIFY_PHASE1_COMMIT` and `INKRYA_VERIFY_PHASE1_MODE` were subsequently set to `disabled`. Production `/api/ai` returned HTTP 200 `provider=gateway` on 2026-09-24.

**Stop under the bounded experiment agreement. Plan C for a separate decision:** prepare an original/licensed synthetic Indonesian training and held-out evaluation corpus for a custom or fine-tuned Indonesian Writer hosted on Nebius. Specify data provenance, permissible training rights, train/validation split, constrained translation fidelity labels, length and paragraph checks, contradiction labels, independent human scoring and serving cost. Keep Nemotron Planner/QA reasoning and the existing lexical/revision-safe Memory. Validate any new Writer against the same four cases plus a separate held-out synthetic set and repeatability before runtime routing. Plan C is preparation, not an implemented model or authorization to start Phase 2.
