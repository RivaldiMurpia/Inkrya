# Phase 1 Writer routing — bounded synthetic evidence (2026-09-24 UTC)

The four cases are exactly the `continue-radio`, `rewrite-radio`, `continue-menara`, and `rewrite-surat` synthetic inputs in `scripts/phase1-writer-benchmark.mjs`. No private manuscript was read, changed, or sent. The previous Super/Ultra/Lightning failures remain recorded in `phase1-prose-2026-09-24.md`; no new Nemotron Writer tuning was attempted here.

## Catalog and shortlist

On Preview `dpl_6TQUug9pGyKvgPviBFssNb5tm32F` (commit `0cc132f`), an authenticated Nebius Token Factory `/v1/models` read produced `PHASE1_WRITER_CATALOG` with `inferenceRequests:0`. The account catalog included the exact IDs below. Vercel redacted one separate model ID matching a configured value; none of these shortlisted IDs was redacted. Selection used only the authenticated IDs and the model makers' published cards, not a guessed endpoint or cross-provider fallback.

| Candidate (diagnostic mode) | Reason for shortlist | Official model reference |
| --- | --- | --- |
| `Qwen/Qwen3-235B-A22B-Instruct-2507` (`writer-qwen`) | Non-thinking text generation, multilingual open-ended text and instruction-following; first test. | [Qwen model card](https://huggingface.co/Qwen/Qwen3-235B-A22B-Instruct-2507) |
| `google/gemma-3-27b-it` (`writer-gemma`) | Text-output instruction model with multilingual support; distinct model family. | [Google Gemma 3 model card](https://ai.google.dev/gemma/docs/core/model_card_3) |
| `Qwen/Qwen3.5-397B-A17B` (`writer-qwen35`) | Multilingual text generation. The documented `chat_template_kwargs.enable_thinking=false` is applied only to this model so the fixed output ceiling is devoted to prose. | [Qwen3.5 model card](https://huggingface.co/Qwen/Qwen3.5-397B-A17B) |

Every deployment tests at most **4 calls × 260 output tokens**, 35 seconds per call, zero automatic retries. Each candidate uses the identical four inputs, Writer system instruction, requested lengths, mechanical checks and manual fact/language criteria; only Qwen3.5 uses the documented non-thinking template setting. The diagnostic exits nonzero even if mechanical checks pass, pending human review. No unapproved model becomes the active Preview Writer through this diagnostic.

## Qwen3 235B — rejected

Preview `dpl_HvAdB56jzonF5jNBPYd6RkbPncdT` (commit `9fee270`) attempted all four calls; **2/4 objective checks** passed, **0/4 human acceptance**. The synthetic outputs below are quoted in full to make fact assessment reproducible.

| Case | Words / required | Mechanical | Human assessment |
| --- | --- | --- | --- |
| continue-radio | 55 / 55–70 | Pass | Fail: changes key from drawer to behind a frequency box; invents basement, Damar's search and his hearing radio. |
| rewrite-radio | 43 / 45–60 | Fail | Fail: misses length; “satu-satunya harapan” introduces an unsupported claim and the imagery becomes generic. |
| continue-menara | 47 / 50–65 | Fail | Fail: blows the letter from under the bench and has Nala grab Raka; extra actions and letter-location conflict. |
| rewrite-surat | 50 / 50–65 | Pass | Fail: adds fog, wooden bench and unsupported internal state; the rewrite constraint explicitly bars new facts. |

**continue-radio**

> Mira menahan napas, jemarinya bergetar di atas tombol radio saat tiga ketukan pendek terdengar lagi—jelas, perlahan, tak terbantahkan. Di ruang bawah tanah yang redup, Damar mengernyit, telinganya menangkap gemerisik suara tanpa makna, sama sekali tak menyadari bahwa kunci kuningan yang dicarinya telah berada dalam jangkauan, tersembunyi di balik kotak frekuensi yang tak pernah ia periksa.

**rewrite-radio**

> Mira melangkah masuk ke ruang radio yang sunyi, jantung berdebar dalam hening. Kunci kuningan terasa dingin di saku jaketnya, satu-satunya harapan di antara dinding yang menekan. Radio di meja hanya mengeluarkan dengungan pelan, tak ada suara, tak ada sinyal—hanya kesunyian yang semakin menggigit.

**continue-menara**

> Nala memicingkan mata ke arah dermaga, jantungnya berdebar saat melihat lampu keempat tiba-tiba padam. Ia menoleh cepat mencari Raka, napasnya tertahan. “Raka!” panggilnya serak, tangannya meraih lengan sang penjaga. “Lampu keempat—mati. Kita harus periksa.” Angin malam menerbangkan surat di bawah bangku, tepat saat Raka menoleh, wajahnya tegang.

**rewrite-surat**

> Hujan turun perlahan, gemerisiknya menyelimuti atap menara yang sepi. Nala berdiri dekat jendela, matanya menatap kabut di luar tanpa berkedip. Raka duduk bersandar di lantai, diam, pikirannya melayang entah ke mana. Di bawah bangku kayu yang usang, surat itu masih tergeletak, utuh, belum disentuh, belum diketahui isinya oleh siapa pun.

## Gemma 3 27B — rejected

Preview `dpl_DZa2XbwpPRMEfoXgDxKp2pHc3Stj` (same commit, `writer-gemma`) attempted all four calls; **2/4 objective checks** passed, **0/4 human acceptance**. No foreign-language leakage was observed, but mechanical success concealed incompatible events and ungrounded setting details.

| Case | Words / required | Mechanical | Human assessment |
| --- | --- | --- | --- |
| continue-radio | 53 / 55–70 | Fail | Fail: invents Damar across from Mira with a city map, waiting for a secret code and searching for the key. |
| rewrite-radio | 47 / 45–60 | Pass | Fail: Mira takes out the key and radio hum grows louder, both new events; static becomes radio noise not stated. |
| continue-menara | 51 / 50–65 | Pass | Fail: lamp merely dims, Nala explicitly does *not* warn Raka, who is newly inspecting a map. Opposes the requested event. |
| rewrite-surat | 45 / 50–65 | Fail | Fail: adds fog, sea view, folded letter and internal states; new facts expressly disallowed. |

**continue-radio**

> Mira tertegun mendengar tiga ketukan pelan dari radio, seolah kode rahasia yang ditunggu-tunggu akhirnya tiba. Jantungnya berdegup kencang, namun ia tetap berusaha tenang. Damar, yang duduk di seberangnya, tampak asyik mengutak-atik peta kota, sama sekali tidak menyadari sinyal penting tadi. Ia masih mencari-cari di mana Mira mungkin menyembunyikan kunci kuningan itu, tanpa hasil.

**rewrite-radio**

> Ruang radio terasa pengap saat Mira melangkah masuk, jantungnya berdebar seirama dengungan statis dari radio tua di atas meja. Kunci kuningan dingin di saku jaketnya, terasa berat dan asing. Ia meraih kunci itu, ragu, seolah benda itu menyimpan rahasia yang tak ingin diungkapkannya. Dengungan radio semakin keras.

**continue-menara**

> Nala memandang kosong saat lampu keempat ikut meredup, bergabung dengan kegelapan yang mulai merayap di dermaga. Ia bangkit, hendak memperingatkan Raka yang sedang memeriksa peta, namun urung. Jantungnya berdebar tak karuan, firasat buruk menggantung di udara. Surat itu masih tergeletak tenang di bawah bangku, seolah tak menyadari apa yang sedang terjadi.

**rewrite-surat**

> Hujan meredam kebisingan pelabuhan, hanya menyisakan ritme lembut di atap menara. Nala termenung dekat jendela, memandang kabut yang menyelimuti laut. Raka duduk bersandar di lantai, pikirannya melayang tanpa arah. Di bawah bangku, terlipat rapi, surat itu masih menunggu, belum disentuh oleh tangan mereka yang gelisah.

## Qwen3.5 397B — rejected

Preview `dpl_BdwRQaDdPYT7FBpzGod8fajjf13V` (same commit, `writer-qwen35`, documented non-thinking template flag) attempted all four calls; **1/4 objective checks** passed, **0/4 human acceptance**. The one in-range continuation preserves the key's drawer location and Damar's ignorance, but introduces another person's presence and Damar searching/walking; it therefore fails the no-new-events/facts gate. The other three miss the requested length, including the otherwise closer rewrite of the letter scene. All text was Indonesian; no nonsensical foreign tokens were observed. This is an instruction/continuity and length failure, not a transport failure.

| Case | Words / required | Mechanical | Human assessment |
| --- | --- | --- | --- |
| continue-radio | 64 / 55–70 | Pass | Fail: presumes another person's presence and Damar walking/searching, none supplied. |
| rewrite-radio | 63 / 45–60 | Fail | Fail: 3 words above maximum, adds waiting, key touching and unsupported figurative claim. |
| continue-menara | 75 / 50–65 | Fail | Fail: 10 words above maximum, invents Raka looking at the sea, strong wind and both panicking. |
| rewrite-surat | 47 / 50–65 | Fail | Fail: 3 words below minimum, changes Nala's position to facing the window and adds new description. |

**continue-radio**

> Mira menatap radio tua di atas meja, jantungnya berdegup kencang saat tiga ketukan tajam tiba-tiba memecah keheningan malam. Suara itu berasal dari perangkat komunikasi yang baru saja ia periksa, mengisyaratkan kehadiran seseorang di luar sana. Di seberang sana, Damar masih berjalan mondar-mandir di lorong gelap, sama sekali tidak menyadari bahwa kunci kuningan yang dicarinya tersimpan aman di laci meja radio tempat Mira berdiri mematung.

**rewrite-radio**

> Mira menyelinap masuk ke ruang radio Stasiun Aruna, jantungnya berdebar kencang menyamai dengungan rendah yang memancar dari alat di meja. Jari-jarinya gemetar menyentuh kunci kuningan dingin yang tersembunyi rapat di saku jaketnya, satu-satunya benda nyata di tengah keheningan yang mencekam. Radio itu tetap saja berdengung pelan, suara monoton yang seolah mengejek ketegangan yang mencekik lehernya saat ia menunggu sesuatu yang tak kunjung terjadi.

**continue-menara**

> Saat lampu keempat di ujung dermaga tiba-tiba padam, Nala segera berbalik menghadap Raka yang sedang menatap laut. Ia mencoba memanggil nama rekannya, namun suaranya tertelan angin malam yang semakin kencang. Tangan Nala refleks menunjuk ke arah kegelapan itu, berusaha memberi isyarat bahaya tanpa beranjak dari posisinya di menara. Surat penting untuk penjaga kapal tetap aman terselip di bawah bangku dekat pintu, tak terusik oleh kepanikan sesaat yang melanda mereka berdua di ketinggian menara pelabuhan itu.

**rewrite-surat**

> Hujan turun dengan tenang membasuh atap menara, menciptakan irama lembut yang menyelimuti ruangan. Nala berdiri diam menatap jendela, sementara Raka terduduk santai di lantai. Di bawah bangku, selembar surat tergeletak tak tersentuh, masih menyimpan rahasia yang belum terbaca oleh Nala maupun Raka di tengah keheningan basah itu.

## Decision and limits

Across the **three preselected Writer models, 12 bounded synthetic inference calls, zero retries**, mechanical passes were **2/4, 2/4 and 1/4**, with **zero 4/4 human-accepted candidates**. No repeatability run or `WRITER_MODEL` deployment is justified. Preview remains on its last READY Super runtime; Production remains Gateway. The Preview exact-commit paid toggle was disabled immediately after the third diagnostic. Phase 1 remains **INCOMPLETE** and Phase 2 remains blocked.

The observed failure pattern suggests a bounded **Plan B to discuss before implementation**: a Nemotron Planner could produce a structured scene plan of allowed events, immutable sourced facts/locations and word interval; a separate Indonesian surface Writer would realize only that plan; a deterministic validator and Nemotron Guardian would reject unauthorized events and compare against revision-safe evidence. This is a proposal inferred from these synthetic failures, not a tested implementation or approval to begin Phase 2. More blind model trials are outside the agreed shortlist.
