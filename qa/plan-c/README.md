# Phase 1 Plan C — small LoRA pilot, prepared 2026-09-24

**Status: DATASET PREPARED; TRAINING NOT AUTHORIZED; Phase 1 INCOMPLETE.** No files have been uploaded to Nebius; no fine-tuning job or dedicated endpoint was created. This corpus is entirely original, deterministic synthetic microfiction. The builder reads only its checked-in synthetic scene atoms. It never reads application projects or manuscripts.

## Files and split

| File | Use | Count |
| --- | --- | ---: |
| `train.records.jsonl` | Auditable records with constraints, provenance, family and Indonesian reference | 120 |
| `train.nebius.jsonl` | **Only prospective upload file**, Nebius conversational JSONL | 120 |
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

Local verification on 2026-09-24: corpus validator **PASS**, **36/36** Node tests **PASS**, non-incremental typecheck **PASS**, and local Next.js build **PASS**. Application runtime and hosting settings were not modified, so no new paid inference or Preview deployment was triggered by the dataset preparation.

The 150 references come from 50 original scene atoms rendered into three controlled phrasing variants. The wording is deliberately constrained. This is a **small pilot**, with repeated structure and only ten independent held-out scenes; held-out scores alone cannot prove naturalness or generalization to long fiction. A human Indonesian editor must inspect the complete training/evaluation references for idiom and unintended implications before upload. After any approved pilot, evaluate all 30 held-out prompts and the four existing acceptance prompts with blind human review of naturalness, coherence, preserved facts, length, one paragraph, unwanted foreign words, nonsensical phrasing and contradiction. Keep the current semantic/grounding validation unchanged. A training job alone never completes Phase 1.

## Verified model IDs and API contract

Nebius's [current fine-tuning model list](https://docs.tokenfactory.nebius.com/post-training/models) lists all three for **LoRA and full-parameter fine-tuning**:

| User shorthand | Exact `model` value for a job | Language/cost judgment |
| --- | --- | --- |
| Meta-Llama-3.1-8B-Instruct | `meta-llama/Meta-Llama-3.1-8B-Instruct` | Smallest dense base; Meta does not list Indonesian among its eight supported languages; fine-tuning additional languages is allowed under its license and safeguards. |
| gpt-oss-20b | `unsloth/gpt-oss-20b-BF16` | BF16 Unsloth packaging is the **Nebius training ID**. Harmony chat formatting/reasoning behavior deserves an explicit compatibility test; no Indonesian advantage is established here. |
| Qwen3-30B-A3B-Instruct-2507 | `Qwen/Qwen3-30B-A3B-Instruct-2507` | Provisional linguistic favorite: Qwen's model card claims multilingual and creative-writing improvements. Its 30.5B total/3.3B active MoE parameters do **not** establish a cheaper training price. |

The [Nebius supervised fine-tuning specification](https://docs.tokenfactory.nebius.com/post-training/how-to-fine-tune) uses `POST https://api.tokenfactory.nebius.com/v1/files` with multipart `purpose=fine-tune` and the uploaded `train.nebius.jsonl`, then `POST /v1/fine_tuning/jobs` with `model`, `training_file`, optional `validation_file`, optional `suffix`, optional `seed`, and nested `hyperparameters`. Its guide's older example spells the 8B Llama ID differently; the **current model list** is the source for the exact model ID, subject to an account catalog check before job creation. `learning_rate` is the documented current key; do not substitute a legacy `learning_rate_multiplier`. The job object returns `trained_tokens`, `trained_steps`, status and errors. These are documented API shapes, **not** claims of a live API validation or accepted paid request.

Proposed request **after price, account availability, editorial review and explicit training approval** (placeholder training file ID, no code here issues the request):

```json
{
  "model": "Qwen/Qwen3-30B-A3B-Instruct-2507",
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
    "packing": true,
    "context_length": 8192
  }
}
```

Keep `validation_file` **absent**: all 30 held-out pairs must remain sealed for post-training evaluation. A single epoch limits pilot spend and memorization risk; do not start full fine-tuning. The [current Nebius model page](https://docs.tokenfactory.nebius.com/post-training/models) says fine-tuned model deployment is currently on **Dedicated endpoints**; a separate serving quote is required before any integration or deployment.

## Cost worksheet — quote required before approval

Official [Nebius pricing](https://tokenfactory.nebius.com/organization/prices) currently redirects to a sign-in-only console in this session. The public [post-training product page](https://nebius.com/services/token-factory/post-training) describes token-based pricing, but gives **no model-specific LoRA rate, minimum job charge or serving quote**. Therefore the exact pilot price is **unverified**, and no paid training approval should be requested yet.

Measured training input: 120 examples, **192,839 UTF-8 JSONL bytes** and **21,000+ whitespace words** across system, user and assistant messages. Rough planning bound: **33,000–75,000 model tokens for one epoch**, based on 1.5–3 tokens/word plus chat-template/JSON overhead. This is **not** a measured count from the three model tokenizers; Nebius may bill differently for packing, validation or a job minimum. Final cost per model requires Nebius's authenticated LoRA rate and model-specific tokenization or an official pre-submit quote:

`estimated training USD = (verified billable training tokens / 1,000,000) × verified LoRA USD per million tokens + any verified minimum/compute fees`

| Model | Verified LoRA rate / 1M trained tokens | Approx. one-epoch token range | Exact USD estimate |
| --- | ---: | ---: | ---: |
| Meta 8B | **Not publicly verified** | 33k–75k (model-specific count pending) | **Blocked** |
| gpt-oss 20B | **Not publicly verified** | 33k–75k (model-specific count pending) | **Blocked** |
| Qwen3 30B A3B | **Not publicly verified** | 33k–75k (model-specific count pending) | **Blocked** |

Cost ranking cannot be asserted from parameter counts. Provisional first pilot is **Qwen3 30B A3B Instruct** based on the manufacturer's multilingual and creative-writing claims, while Llama 3.1 does not explicitly support Indonesian. This is a **suitability inference**, not a demonstrated prose win over the other two; its earlier large-Qwen direct-writing failures still stand. If Nebius's account-specific LoRA quote makes Qwen materially more expensive, compare the verified total before choosing. Do not spend or update `WRITER_MODEL` from this recommendation.

**Next decision gate:** obtain the three authenticated per-model LoRA tariffs, minimum fees, effective tokenizer/billable-token estimate and Dedicated serving cost; record exact one-epoch USD estimates and any credit cap; finish the reference-text human audit. Then present a priced pilot for approval. Until then, no upload, training request, deployment, or Phase 2 work.
