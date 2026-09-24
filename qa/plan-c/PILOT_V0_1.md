# Inkrya Indonesian Writer v0.1 — one authorized LoRA pilot

Last provider observation on 2026-09-24: **RUNNING**, 0% (not a failure). The terminal state is **unknown** because authenticated readback was interrupted after the browser session reset; do not interpret this as a failed or stalled job. Job `ftjob-48927a40e28f47ba811ed3e2ac9845d6` is the only job created under the user's approval. Phase 1 remains **INCOMPLETE**; no endpoint, inference, Writer override, Production promotion, or Phase 2 work has been performed. This record must be updated from the provider's terminal state before drawing any quality conclusion.

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

## Read-only monitoring log

| 2026-09-24 observation | Provider status | Provider last-updated time (console display timezone unverified) | Checkpoints |
| --- | --- | --- | --- |
| Initial check around 13:55 UTC | Running, 0%, ETA calculating | 8:50:42 PM | None shown |
| Subsequent read around 14:05 UTC | Running, 0%, ETA calculating | 9:05:36 PM | None shown |
| Subsequent read around 14:08 UTC | Running, 0%, ETA calculating | 9:08:17 PM | None shown |
| Last successful read around 14:12 UTC | Running, 0%, ETA calculating | 9:12:22 PM | None shown |
| 15:59 UTC follow-up | **Unverified**: old browser session had reset; account console access blocked for this browser, and automatic approval review rejected another Nebius console origin as an alternate-route probe | No fresh provider timestamp | Unknown |

The provider's updated timestamps indicate that the job record changed during the successful reads, but do not establish training progress, completion time, or actual bill. No stop/cancel/restart, second training request, or inference was made. The access restriction is local to this monitoring session; it is not evidence that Nebius is down or the job failed. Do not poll the same account via an indirect route to evade this block. Resume authorized read-only status/checkpoint/billing inspection when console access is restored.

## Serving cost gate

Current [Nebius fine-tuning model documentation](https://docs.tokenfactory.nebius.com/post-training/models) states that fine-tuned model deployment is available **only through Dedicated endpoints**. Its [Dedicated overview](https://docs.tokenfactory.nebius.com/ai-models-inference/dedicated-endpoints/overview) says custom weights require Dedicated and that billing is **per GPU hour with per-minute granularity**. The account Prices page currently lists indicative per-GPU-hour rates in `eu-north1`: L40S **$2.00**, H100 **$4.05**, H200 **$4.70**, B200 **$7.40**, and B300 **$8.10**. The viable GPU/template and replica count for this particular checkpoint have **not** been quoted by the deploy form. A superseded legacy documentation page describes serverless LoRA, but the current model list and Dedicated overview govern this pilot; verify the actual available route after the job reaches a terminal state.

The [current Dedicated FAQ](https://docs.tokenfactory.nebius.com/ai-models-inference/dedicated-endpoints/faq) adds that custom fine-tuned weights are **beta, available on request**, and may require Nebius Support to enable access and confirm the configuration. For this MoE base, Nebius also publishes a [LoRA merge guide](https://docs.tokenfactory.nebius.com/post-training/merge-moe-lora-weights); whether merge/download/storage or an additional setup charge applies to **this checkpoint** has not been established. The earlier read-only endpoint creation form priced the **public base** `openai/gpt-oss-20b` with one H100 in `eu-north1`, one replica, at **$4.05/hour = $0.0675/minute**. This is a conditional comparison, **not** an accepted custom-weight template or an exact quote for `unsloth/gpt-oss-20b-BF16` plus its LoRA checkpoint. L40S's lower published GPU price cannot be called viable for this checkpoint without its template.

The [Dedicated billing policy](https://docs.tokenfactory.nebius.com/ai-models-inference/dedicated-endpoints/billing-policy) bills provisioned/ready replicas; provisioning/not-ready, replica restarts and endpoint shutdown are listed as not billed. The [operations guide](https://docs.tokenfactory.nebius.com/ai-models-inference/dedicated-endpoints/operating) permits `enabled=false` to release capacity; the [FAQ](https://docs.tokenfactory.nebius.com/ai-models-inference/dedicated-endpoints/faq) warns that a later restart may lack capacity. The provider does not publish a guaranteed loading/startup duration or an additional minimum billed duration on these pages. One billable minute on the observed H100 **base** quote would cost $0.0675; it is **not** a verified minimum invoice for the fine-tuned deployment. A possible bounded schedule, conditional on identical checkpoint pricing and one replica, is 15 minutes for two held-out canaries ($1.0125), up to 60 minutes for all 30 held-out cases ($4.05), 15 minutes for four golden cases ($1.0125) and 15 minutes for repeatability ($1.0125): **105 active minutes, $7.0875** before tax, custom setup/merge/storage or contractual charges. Stop the endpoint after each inference stage and review outputs offline; the intervals are planning caps, not measured runtime or guaranteed cost. If review requires restarting later, released capacity may be unavailable.

**Exact minimum serving/evaluation cost and a deployable GPU/template cannot yet be established** without terminal checkpoint metadata, account-specific custom-weight enablement/template, a confirmed minimum-billing rule, and any associated setup charges. Do not infer the exact answer from the public base quote.

**Do not create a paid Dedicated endpoint or run fine-tuned inference without a separate serving-cost decision.** Once the original job is readable and terminal, record provider status/errors, processed tokens/steps, actual billing evidence, metrics and checkpoint/model ID. On success, inspect inference options and Support prerequisites without deploying. Report the exact compatible configuration and charge, then stop for approval. On failure save safe error evidence and stop without a second job.
