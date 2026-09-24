# Phase 1 writer prose comparison — 2026-09-24 UTC

Scope: **synthetic fragments only** from the four-case `continue`/`rewrite` corpus in the [Phase 1 activation record](../PHASE1_ACTIVATION.md). No private novel was accessed; no generated text was inserted into a chapter. `continue-radio` must keep the brass key in Mira's radio-desk drawer and Damar unaware of its location. `rewrite-radio` must keep the key in Mira's jacket pocket and the radio only humming. Both require one third-person paragraph, ordinary Indonesian prose and no new contradictory story fact. Requested word intervals are **55–70** and **45–60**, respectively. The other two fixed corpus cases (`continue-menara`, `rewrite-surat`) remain required for full acceptance; no alternative model reached that stage.

The Super baseline and two prompt/budget variants were recorded in the activation document. Super's reasoning-mode trial did not yield a reviewable sample. The following **eight** additional calls were capped at **260 output tokens each**, with zero automatic retries and a 35-second per-call timeout. The model IDs were verified against the authenticated Nebius catalog before inference. The exact-commit, Preview-only diagnostic was configured to fail the build pending human review; all three comparison deployments ended ERROR by design. `LANGSMITH_TRACING=false` applied only inside the synthetic diagnostic process; application tracing remains unchanged. The stable application still routes all roles to Super. It has **not** switched its Writer route to either alternative.

| One-variable comparison | Deployment | Model | Continue words | Rewrite words | Manual decision |
| --- | --- | --- | ---: | ---: | --- |
| Same baseline system, JSON prompt, temperature 1, top-p 0.95, reasoning off | [`dpl_3rSJwPJnZm9sXzUhT1Wm6zYjjQHL`](https://vercel.com/rivaldi-murpias-projects/inkrya/3rSJwPJnZm9sXzUhT1Wm6zYjjQHL) | `nvidia/Nemotron-3-Ultra-550b-a55b` | 91 ❌ | 24 ❌ | Continue invents a photo/sound source and has broken words; rewrite preserves key/radio but is too short. |
| Same settings and prompts, change only model ID | Same deployment | `nvidia/Nemotron-3_5-Lightning` | 43 ❌ | 42 ❌ | Both miss length and contain nonsensical phrases; continue invents a cassette and Damar falling. |
| Change only system message to plain English constraints on Indonesian output | [`dpl_4qxwFMov8gZn8HAsGMFjhkpbNx97`](https://vercel.com/rivaldi-murpias-projects/inkrya/4qxwFMov8gZn8HAsGMFjhkpbNx97) | Ultra | 57 ✓ mechanical | 28 ❌ | Continue moves the key to Mira's hand and emits “gemeris.static”; human quality/fact review fails despite valid length. Rewrite is too short. |
| Add only sentence-count hint to JSON input, keeping preceding system/model/settings | [`dpl_Et6HuLwBdWtFWFUxjkvojHh6MuXh`](https://vercel.com/rivaldi-murpias-projects/inkrya/Et6HuLwBdWtFWFUxjkvojHh6MuXh) | Ultra | 47 ❌ | 31 ❌ | Continue invents antenna motion; rewrite changes the radio hum into a ring and invents a dim lamp. |

Automated length, one-paragraph, no-meta, known foreign-script/term, sentence-completion and reasoning-tag checks rejected **7/8** samples. The single mechanical pass failed human review. The no-known-leakage check is a narrow screen and **does not** prove fluent Indonesian: invented “gemeris.static”, “eman dari kaset”, “berdebar-trampel”, “tanpa cesar” and “memetikam” require manual rejection. The benchmark did not relax grounding/abstention, and it did not use a word-count suffix as a substitute for real length.

## Raw synthetic outputs for review

### Ultra, baseline system

**Continue (91 words):**

> Tiga ketukan itu memotong statis, ritmis dan sengaja, seolah seseorang mengetuk pintu yang sengaja dibiarkan terkunci dari dalam. Mira menahan napas, jari-jarinya mengait natural frekuensi radio lama itu, mencari sumber suara di balik kerakusan putih — bukan dari speaker, pasti bukan dari speaker, melainkan dari dinding kayu di belakangnya, tempat Damar masih sibuk memetikam bingkai foto yang tidak pernah dibuka, tidak sadar bahwa kunci kuningan yang dicarinya kini beristirah hanya selebar lengan di dalam laci meja radio, menunggu detak jantung Mira yang berdesakan untuk mengubahnya dari benda mati jadi bukti pembuka.

**Rewrite (24 words):**

> Mira melangkah ke ruang radio Stasiun Aruna sendirian, kunci kuningan tertahan aman di saku jaketnya, sementara radio di meja terus berdengung pelan memecah keheningan.

### Lightning, baseline system

**Continue (43 words):**

> Rasa dingin eman dari kaset memaksanya untuk tetap diam. Saat ketukan ketiga bergema melalui speaker, tangannya mengait-ait di laci, namun ingatannya tentang lokasi itu menghilang seketika. Damar bergelincir ke lantai, bicara tak bisa menemukan jejeran logis yang menghubungkan ia dengan tempat penyimpanan aslinya.

**Rewrite (42 words):**

> Mira memasukkan diri ke ruang radio, detak jantungnya berdebar-trampel di tengah ketegangan. Kunci kuningan tersembunyi di dalam saku jaketnya sambil itu, radio di meja mendengung pelan tanpa cesar. Setiap detik terdengar terlalu panjang seiring mendengung sinyal yang monoton di ruangan sunyi tersebut.

### Ultra, English system guidance

**Continue (57 words):**

> Mira mendengar tiga ketukan datang dari speaker radio, suara itu tajam di ruang kendali yang sunyi. Ia menatap kotak hitam di meja, jari tangan ia yang berisi kunci kuningan tadi saja diletakkan di laci bawahnya. Damar berdiri di ambang pintu, wajahnya datar, ia tidak menahu apa-apa soal kunci itu. Ketukan keempat tak datang, hanya gemeris.static yang menipis.

**Rewrite (28 words):**

> Mira melangkah masuk ruang radio Stasiun Aruna, kunci kuningan tetap tersimpan aman di saku jaketnya, sementara radio di meja terus berdengung pelan memenuhi ruangan dengan nada yang menegangkan.

### Ultra, English system guidance plus sentence hint

**Continue (47 words):**

> Mira mendengar tiga ketukan pelan dari radio. Suara itu memecah keheningan ruang kontrol. Damar tetap diam di kursinya, wajah datar, tidak tahu kunci kuningan tersimpan di laci meja. Jari-jari antena bergetar sejenak lalu diam kembali. Mira menahan napas, menunggu apakah pola ketukan akan berulang atau berhenti total.

**Rewrite (31 words):**

> Mira melangkah ke ruang radio Stasiun Aruna. Kunci kuningan tetap tersimpan aman di saku jaketnya. Mesin radio di meja mendering pelan mengisi ruang sunyi. Cahaya lampu redup menari wajahnya yang tegang.

## Gate decision

**FAIL / Phase 1 INCOMPLETE.** The eight pilot calls are enough to reject these configurations. A full four-case quality acceptance run and repeatability check are still required for any *new* Writer candidate. Do not infer success from transport, a single length pass, or generated self-reported word count. Preview's paid diagnostic exact-commit toggle was disabled again after the measurements. Production remains Gateway and Phase 2 is blocked.
