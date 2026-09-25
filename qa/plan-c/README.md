# Phase 1 Plan C — small LoRA pilot, prepared 2026-09-24

**Status: one user-authorized LoRA pilot SUCCEEDED on 2026-09-24; Phase 1 INCOMPLETE.** See [final checkpoint, artifact and bill](PILOT_V0_1.md), [historical Token Factory serving gate](SERVING_GATE_V0_1.md) and [current private two-case H100 canary proposal](PRIVATE_CANARY_GATE.md). Nebius Support's answer rules out standard shared LoRA serving; no Dedicated or paid private VM has been created for evaluation. The model has not passed quality evaluation. No Writer route change, Production promotion or Phase 2 work has occurred. This corpus is entirely original, deterministic synthetic microfiction. The builder reads only its checked-in synthetic scene atoms. It never reads application projects or manuscripts. The cost-gate sections below record the evidence and proposal **before** the pilot and must not be read as current job status.

## Files and split

| File | Use | Count |
| --- | --- | ---: |
| `train.records.jsonl` | Auditable records with constraints, provenance, family and Indonesian reference | 120 |
| `train.nebius.jsonl` | **Only submitted training file**, Nebius conversational JSONL | 120 |
| `heldout.records.jsonl` | External held-out evaluation prompts and sealed references | 30 |
| `heldout.reference.jsonl` | Local evaluation reference, **never supply as `validation_file` or `training_file`** | 30 |

Each user prompt contains an English source draft, `required_facts`, `forbidden_changes`, `pov`, `target_word_range`, `scene_goal` and paragraph count. The assistant message is an original Indonesian paragraph. Nemotron remains the application reasoning/Planner/QA model; this dataset tests only a prospective surface Writer. No runtime route changes are part of this preparation.

Build: `node scripts/plan-c-build-corpus.mjs`. Validate: `node scripts/plan-c-validate.mjs` or `npm run test:plan-c`. The input/output pair format is the conversational `messages` JSONL specified in the [current Nebius dataset documentation](https://docs.tokenfactory.nebius.com/post-training/datasets). The held-out corpus has **different settings, characters and scene families** from train; the four earlier synthetic acceptance cases in `scripts/phase1-writer-cases.mjs` are also excluded from both splits. The train SHA-256 is `d809ffde13b3fb2031bd7a0ccffa19070af28fa69818aeb4189b9d058e9ed1f7`.

| Mechanical statistic | Train | Held-out |
| --- | ---: | ---: |
| Pairs | 120 | 30 |
| Independent scene families | 40 | 10 |
| Distinct settings | 8 | 2 |
| Indonesian answer words, total | 5,559 | 1,409 |
| Indonesian answer words, range | 41–50 | 44–51 |
| JSONL bytes including newline | 192,839 | 48,659 |

`scripts/plan-c-validate.mjs` rejects incorrect schemas, non-NFC/control/zero-width Unicode, missing constraints, missing/extra Nebius message fields, answer/prompt mismatches, answers outside the requested word range, multipart/incomplete answers, obvious English/meta leakage, duplicate prompts/answers, answer copied into a prompt, reused source drafts across scene families, near-duplicate 5-gram answers across scene families (Jaccard ≥ 0.70), shared families/settings across splits and direct reuse of the four earlier acceptance cases. All these checks are **mechanical**: they do not prove literary quality or semantic faithfulness. Seven independent corruption/positive tests cover the validator.

Local verification on 2026-09-24: corpus validator **PASS**, **36/36** Node tests **PASS**, non-incremental typecheck **PASS**, and local Next.js build **PASS**. The cost-gate check reran the validator, the **36/36** tests and the tokenizer cross-check; no application runtime changed. No new paid inference or Preview deployment was triggered.

The 150 references come from 50 original scene atoms rendered into three controlled phrasing variants. The wording is deliberately constrained. This is a **small pilot**, with repeated structure and only ten independent held-out scenes; held-out scores alone cannot prove naturalness or generalization to long fiction. The earlier plan requested a full Indonesian editorial audit before upload; the user later authorized the pilot based on the validated synthetic corpus, and **the full editorial audit has not been completed**. This limits quality claims, not provenance. If serving is separately approved, evaluate all 30 held-out prompts and the four existing acceptance prompts with blind human review of naturalness, coherence, preserved facts, length, one paragraph, unwanted foreign words, nonsensical phrasing and contradiction. Keep the current semantic/grounding validation unchanged. A training job alone never completes Phase 1.

## Verified model IDs and API contract

Nebius's [current fine-tuning model list](https://docs.tokenfactory.nebius.com/post-training/models) lists all three for **LoRA and full-parameter fine-tuning**:

| User shorthand | Exact `model` value for a job | Language/cost judgment |
| --- | --- | --- |
| Meta-Llama-3.1-8B-Instruct | `meta-llama/Meta-Llama-3.1-8B-Instruct` | Smallest dense base; Meta does not list Indonesian among its eight supported languages; fine-tuning additional languages is allowed under its license and safeguards. |
| gpt-oss-20b | `unsloth/gpt-oss-20b-BF16` | **First costed pilot candidate.** BF16 Unsloth packaging is the Nebius training ID; its account-console 8K LoRA rate is verified below. Fine-tuning is an experiment, not a proven Indonesian prose improvement. |
| Qwen3-30B-A3B-Instruct-2507 | `Qwen/Qwen3-30B-A3B-Instruct-2507` | Qwen's model card claims multilingual and creative-writing improvements, but its account-specific training price remains unverified; defer this alternate pilot. |

The [Nebius supervised fine-tuning specification](https://docs.tokenfactory.nebius.com/post-training/how-to-fine-tune) uses `POST https://api.tokenfactory.nebius.com/v1/files` with multipart `purpose=fine-tune` and the uploaded `train.nebius.jsonl`, then `POST /v1/fine_tuning/jobs` with `model`, `training_file`, optional `validation_file`, optional `suffix`, optional `seed`, and nested `hyperparameters`. Its guide's older example spells the 8B Llama ID differently; the **current model list** is the source for the exact model ID, subject to an account catalog check before job creation. `learning_rate` is the documented current key; do not substitute a legacy `learning_rate_multiplier`. The job object returns `trained_tokens`, `trained_steps`, status and errors. These are documented API shapes, **not** claims of a live API validation or accepted paid request.

Proposed **one-epoch, LoRA-only** request **after a full human reference audit and explicit training approval** (placeholder file ID; no code here issues the request):

```json
{
  "model": "unsloth/gpt-oss-20b-BF16",
  "training_file": "<ID of approved train.nebius.jsonl>",
  "suffix": "inkrya-plan-c-synthetic-pilot",
  "seed": 42,
  "hyperparameters": {
    "lora": true,
    "lora_r": 8,
    "lora_alpha": 8,
    "lora_dropout": 0.05,
    "n_epochs": 1,
    "batch_size": 8,
    "learning_rate": 0.00001,
    "warmup_ratio": 0.1,
    "weight_decay": 0,
    "max_grad_norm": 1,
    "packing": true,
    "context_length": 8192
  }
}
```

Keep `validation_file` **absent**: all 30 held-out pairs must remain sealed for post-training evaluation. A single epoch, rank 8, alpha 8, 0.05 dropout, and default 1e-5 learning rate limit memorization risk; this small pilot may underfit and does not promise a 4/4 prose pass. Packing is enabled; because it combines short examples, the actual number of optimizer steps and effective examples per step cannot be inferred from the UI's batch size alone. No gradient accumulation control is exposed. The [current Nebius model page](https://docs.tokenfactory.nebius.com/post-training/models) says fine-tuned model deployment is currently on **Dedicated endpoints**; a separate serving quote is required before deployment.

## Authenticated console and token cost gate — 2026-09-24 UTC

The signed-in account's [Prices page](https://tokenfactory.nebius.com/organization/prices) lists **Fine-tuning gpt-oss-20b BF16 LoRa 8K: $2.00 per 1M tokens**, region `eu-north1`, valid from **2025-12-01**. The selected model's SFT console sidebar independently shows **8,192 context / $2.00 per 1M** with the caveat “Prices are approximate. Actual cost depends on usage.” These prices exclude applicable taxes. The account-specific balance is deliberately omitted from this public repository; its presence is not a spend cap. [Nebius's billing guide](https://docs.tokenfactory.nebius.com/other-capabilities/billing-new) says a bank card may be charged when the configured threshold is met or if the monthly balance is negative.

The authenticated SFT screen offered `gpt-oss-20b` under OpenAI and LoRA/full training. We selected LoRA, opened **Training configuration** and **Integrations**, and stopped before **Create job**. No training dataset was selected. The [model list](https://docs.tokenfactory.nebius.com/post-training/models) supplies the fully qualified API ID `unsloth/gpt-oss-20b-BF16` (the UI shows the short label). The console parameters seen were:

| Console group | Available controls and observed defaults |
| --- | --- |
| Model/data | SFT or Custom Speculator; LoRA or Full; base model; required training dataset, optional validation dataset. |
| Hyperparameters | Context length `8192` (menu `8192`, `16384`, `32768`, `65536`, `131072`); batch size `8` (menu `1`, `2`, `4`, `8`, `12`, `16`, `24`, `32`, `64`); learning rate input labeled **“Learning rate multiplier”** `0.00001`; epochs `3`; warmup ratio `0`; weight decay `0`; max gradient norm `1`; packing checked. The [API schema](https://docs.tokenfactory.nebius.com/post-training/how-to-fine-tune) uses **`learning_rate`**, not a `learning_rate_multiplier` key; epochs range 1–20 and default to 3. |
| LoRA | Rank `8`, alpha `8`, dropout `0`. API rank range 8–128, alpha ≥8, dropout range 0–1. |
| Output/integrations | Optional output model suffix and seed; optional Weights & Biases key/project and Hugging Face repo/token. No checkpoint interval, effective batch, or gradient accumulation control shown. At this **pre-submit configuration checkpoint**, no training checkpoint existed; the subsequent successful job has one, detailed in the pilot record. |

Tokenization used the actual [Unsloth BF16 tokenizer](https://huggingface.co/unsloth/gpt-oss-20b-BF16/blob/main/tokenizer.json) (`tokenizer.json` SHA-256 `0614fe83...37d07d3`) and its [chat template](https://huggingface.co/unsloth/gpt-oss-20b-BF16/blob/main/chat_template.jinja) (SHA-256 `445c3a7c...b1ecc`), rendered at **2026-09-24 UTC** without a generation prompt. `scripts/plan-c-token-count.py` verifies both full SHA-256 values and dataset hashes, tokenizes every serialized conversation, and checks all 150 rows against the model's `o200k_harmony` tiktoken encoding: **0 mismatches**. The template supplies its default medium-reasoning system header and treats the JSONL system instruction as the model's developer instruction. This is the measured base-model serialization, **not a Nebius processed-token or invoice readback**; the service may apply different packing, padding, token accounting or minimum billing.

| Corpus | Examples | Model tokens including chat template | Assistant content tokens | Max example | Submitted to training job? |
| --- | ---: | ---: | ---: | ---: | --- |
| `train.nebius.jsonl` | 120 | **52,877** | 9,518 | 464 (≤8,192) | **Yes**, once after approval; see pilot record |
| `heldout.reference.jsonl` | 30 | **13,206** | 2,352 | 448 (≤8,192) | **No**; sealed for external evaluation |

Reproduce without touching application data:

```bash
python3 -m venv /tmp/inkrya-count
/tmp/inkrya-count/bin/pip install jinja2 tiktoken tokenizers
curl -L https://huggingface.co/unsloth/gpt-oss-20b-BF16/raw/main/chat_template.jinja -o /tmp/inkrya-chat-template.jinja
curl -L https://huggingface.co/unsloth/gpt-oss-20b-BF16/resolve/main/tokenizer.json -o /tmp/inkrya-tokenizer.json
/tmp/inkrya-count/bin/python scripts/plan-c-token-count.py --chat-template /tmp/inkrya-chat-template.jinja --tokenizer /tmp/inkrya-tokenizer.json
```

With **one epoch**, no `validation_file`, and unchanged token count, the calculated token component is `52,877 × $2 / 1,000,000 = $0.105754` (**about $0.11 before tax**); held-out validation contributes **zero processed job tokens**. As a *hypothetical* one-pass validation billing scenario, `13,206 × $2 / 1,000,000 = $0.026412` extra; our proposed job does not include it. Two train epochs without validation would be **105,754 tokens / $0.211508**. A **$2 planning allowance** is ~18.9× the one-epoch token estimate, but it is **not a provider-enforced cap**. We did not find a minimum job charge or a validation-billing rule in the current [SFT](https://docs.tokenfactory.nebius.com/post-training/how-to-fine-tune), [dataset](https://docs.tokenfactory.nebius.com/post-training/datasets), [overview](https://docs.tokenfactory.nebius.com/post-training/overview) or [billing](https://docs.tokenfactory.nebius.com/other-capabilities/billing-new) documentation or in the inspected SFT console. **Absence of documentation does not prove there is no minimum**; exact invoice total and upper bound remain unknown. Dedicated serving, evaluation inference and taxes are separate and excluded.

The [Nebius conversational format](https://docs.tokenfactory.nebius.com/post-training/datasets) requires one `.jsonl` conversation per line, a `messages` array, a final assistant answer, and ≤20GB via Files API. The 192,839-byte `train.nebius.jsonl` has exactly those fields and roles on all 120 lines; the local validator passes and the UI explicitly offers Conversational dataset uploads. **At this cost-gate checkpoint**, server acceptance had not yet been observed. The subsequent authorized upload was accepted as a ready Conversational dataset with a `messages` JSON column; see the pilot record. The four external acceptance cases remain out of both splits by the validator's reserved-name check, disjoint scene families/settings, and manual fixture review; no acceptance case is fed as training or validation data.

**Historical next action at this cost-gate checkpoint:** upload `train.nebius.jsonl` and start one job after approval. The user subsequently approved it, and the SFT console accepted one Conversational dataset and **Create job**. See [the actual pilot record](PILOT_V0_1.md). No inference/deployment, Writer override, Production promotion or Phase 2 work was included in that approval.
