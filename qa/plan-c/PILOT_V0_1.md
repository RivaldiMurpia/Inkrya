# Inkrya Indonesian Writer v0.1 — one authorized LoRA pilot

Status at the initial 2026-09-24 check: **RUNNING**. Job `ftjob-48927a40e28f47ba811ed3e2ac9845d6` is the only job created under the user's approval. Phase 1 remains **INCOMPLETE**; no endpoint, inference, Writer override, Production promotion, or Phase 2 work has been performed. This record must be updated from the provider's terminal state before drawing any quality conclusion.

## Submission and provenance

| Item | Observed value |
| --- | --- |
| Branch and validated source commit | `hackathon/nebius-2026` at `8ad7c12a95e34a432425dfff82057b6c1eb18c00` |
| Training file | `qa/plan-c/train.nebius.jsonl`, 120 original synthetic conversational pairs, 192,839 bytes |
| File SHA-256 | `d809ffde13b3fb2031bd7a0ccffa19070af28fa69818aeb4189b9d058e9ed1f7`, checked from both the repo and the browser-visible upload path *before* selecting the file |
| Dataset | `inkrya-writer-v0-1-train-120-d809ffde`, ID `4455edcfc0f84f728498154941093a58`, version ID `b2b8cfaad0b8482bbd51e02f636ec51e`; ready in Data Lab |
| Training job | `ftjob-48927a40e28f47ba811ed3e2ac9845d6`; console creation time `Sep 24, 2026, 8:50:21 PM` (console display timezone not established); observed running around 13:55 UTC |
| Job type and model | **Supervised Fine-Tuning → LoRA**, `unsloth/gpt-oss-20b-BF16` |
| Output suffix | `inkrya-writer-v0-1-synthetic` |
| Held-out | 30 sealed pairs / 13,206 model tokens; **no validation dataset uploaded or selected** |
| Legacy cases | `continue-radio`, `rewrite-radio`, `continue-menara`, `rewrite-surat` excluded from both splits by validator |

The locally rerun corpus validator passed and checked disjoint train/held-out families and the four reserved acceptance cases. The upload used the file whose SHA-256 matched the committed blob; the console recognized the `messages` JSON column and selected **Conversational** data type. The synthetic corpus builder reads checked-in scene atoms, not application projects. A scoped name/provenance check and the validator found no private manuscript content. This is provenance evidence, not an independent server-side byte-for-byte export or a full human editorial audit of all 150 reference paragraphs.

## Submitted configuration and cost

| Parameter | Console job overview |
| --- | ---: |
| Epochs | 1 |
| Batch size | 8 |
| Learning rate | 0.00001 |
| LoRA rank / alpha / dropout | 8 / 8 / 0.05 |
| Warmup ratio | 0.1 |
| Packing | Yes |
| Seed | 42 |
| Context length | 8,192 |
| Weight decay / max gradient norm | 0 / 1 |

The authenticated job overview lists **$2.00 per 1M training tokens**, unchanged from the accepted cost gate. The local Unsloth tokenizer plus chat-template count is **52,877 train tokens**; the corresponding one-epoch token-price component is **$0.105754 before tax**, packing/accounting differences, or an unconfirmed minimum. The console did **not** display an all-in estimated charge or a provider-enforced spend cap. Actual processed tokens and billed amount await provider readback. Account-specific balance and console screenshots are retained privately outside the public repository.

Private screenshots captured after creation show the job ID, source version, job type, and submitted hyperparameters. They are deliberately excluded from this public repo.

## Serving cost gate

Current [Nebius fine-tuning model documentation](https://docs.tokenfactory.nebius.com/post-training/models) states that fine-tuned model deployment is available **only through Dedicated endpoints**. Its [Dedicated overview](https://docs.tokenfactory.nebius.com/ai-models-inference/dedicated-endpoints/overview) says custom weights require Dedicated and that billing is **per GPU hour with per-minute granularity**. The account Prices page currently lists indicative per-GPU-hour rates in `eu-north1`: L40S **$2.00**, H100 **$4.05**, H200 **$4.70**, B200 **$7.40**, and B300 **$8.10**. The viable GPU/template and replica count for this particular checkpoint have **not** been quoted by the deploy form. A superseded legacy documentation page describes serverless LoRA, but the current model list and Dedicated overview govern this pilot; verify the actual available route after the job reaches a terminal state.

**Do not create a paid Dedicated endpoint or run fine-tuned inference without a separate serving-cost decision.** Once terminal, record provider status/errors, processed tokens/steps, actual billing evidence and checkpoint/model ID. On success, inspect inference options without deploying. If a fixed/hourly endpoint remains necessary, report its exact available configuration and charge, then stop. No automatic second job on failure.
