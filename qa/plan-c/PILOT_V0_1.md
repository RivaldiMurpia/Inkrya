# Inkrya Indonesian Writer v0.1 — one authorized LoRA pilot

**Terminal readback on 2026-09-24: SUCCEEDED.** Job `ftjob-48927a40e28f47ba811ed3e2ac9845d6` is the only job created under the user's approval. The one-epoch LoRA checkpoint has training loss `1.6433256`; no validation loss, because the held-out set was not given to the job. Success is **not** evidence of Indonesian prose quality. Phase 1 remains **INCOMPLETE**; no endpoint, inference, Writer override, Production promotion, or Phase 2 work has been performed.

## Submission and provenance

| Item | Observed value |
| --- | --- |
| Branch and validated source commit | `hackathon/nebius-2026` at `8ad7c12a95e34a432425dfff82057b6c1eb18c00` |
| Training file | `qa/plan-c/train.nebius.jsonl`, 120 original synthetic conversational pairs, 192,839 bytes |
| File SHA-256 | `d809ffde13b3fb2031bd7a0ccffa19070af28fa69818aeb4189b9d058e9ed1f7`, checked from both the repo and the browser-visible upload path *before* selecting the file |
| Dataset | `inkrya-writer-v0-1-train-120-d809ffde`, ID `4455edcfc0f84f728498154941093a58`, version ID `b2b8cfaad0b8482bbd51e02f636ec51e`; ready in Data Lab |
| Training job | `ftjob-48927a40e28f47ba811ed3e2ac9845d6`; console creation `Sep 24, 2026, 8:50:21 PM`, terminal last update `10:39:13 PM` in the same display timezone; elapsed **1 h 48 m 52 s** from creation to last update, not measured active GPU time |
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

The authenticated job overview lists **$2.00 per 1M training tokens**, unchanged from the accepted cost gate. The local Unsloth tokenizer plus chat-template count was **52,877 train tokens** with a projected **$0.105754** component. Authenticated billing Usage in **Full numbers** format subsequently reported **0.05311 million (~53,110 training tokens at displayed precision)** and **$0.10622** for `Fine-tuning gpt-oss-20b BF16 LoRa 8K` in `eu-north1` (usage page last updated `20:04 UTC`, 2026-09-24). The displayed figures imply **~233 tokens / $0.000466 above** the local estimate, subject to the Usage page's rounding. This is a product-level charge for the only LoRA training job, not a per-job token-counter export, tax invoice or proof of a global spend cap. The console did **not** display an all-in estimate before submission. Account-specific balance and screenshots remain outside the public repository.

Private screenshots captured after creation show the job ID, source version, job type, and submitted hyperparameters. They are deliberately excluded from this public repo.

## Read-only monitoring log

| 2026-09-24 observation | Provider status | Provider last-updated time (console display timezone unverified) | Checkpoints |
| --- | --- | --- | --- |
| Initial check around 13:55 UTC | Running, 0%, ETA calculating | 8:50:42 PM | None shown |
| Subsequent read around 14:05 UTC | Running, 0%, ETA calculating | 9:05:36 PM | None shown |
| Subsequent read around 14:08 UTC | Running, 0%, ETA calculating | 9:08:17 PM | None shown |
| Last successful read around 14:12 UTC | Running, 0%, ETA calculating | 9:12:22 PM | None shown |
| 15:59 UTC follow-up | **Unverified**: old browser session had reset; account console access blocked for this browser, and automatic approval review rejected another Nebius console origin as an alternate-route probe | No fresh provider timestamp | Unknown |
| Later authenticated readback | **Succeeded**; exactly one SFT LoRA job listed, Running 0, Failed 0 | Sep 24, 2026, 10:39:13 PM | One epoch-1 checkpoint; loss 1.6433256, no validation loss |

The transient browser restriction was resolved by a later direct signed-in visit to the normal Token Factory console after the user requested read-only terminal/artifact/serving inspection. It did not change the earlier observations. The provider's `finished_at` and `trained_steps` job API fields were **not** surfaced in the UI; the elapsed created-to-last-updated interval above is a wall-clock bound, not a measured training compute duration. No stop/cancel/restart, second training request, or inference was made.

## Final checkpoint and downloaded artifact inspection

The selected epoch-1 `checkpoint.meta` contains ID **`ftckpt_dd236eab-9bc0-4cad-9b2e-6d5f508a9104`**, `step_number=1`, `created_at=1790264256` (**2026-09-24 15:37:36 UTC**), `train_loss=1.6433255672454834`, and `valid_loss=null`. The console's `10:39:13 PM` last update is 1 m 37 s after the checkpoint if its display offset is UTC+7; the display timezone itself is not labelled. The model name shown is `unsloth/gpt-oss-20b-BF16:inkrya-writer-v0-1-synthetic`.

The **Download files** menu exposes six files for this checkpoint. They were inspected as local copies **outside the public repository**; no upload or publication of weights occurred.

| File | Bytes | Artifact role |
| --- | ---: | --- |
| `adapter_config.json` | 1,091 | PEFT `LORA`; base `unsloth/gpt-oss-20b-BF16`, rank 8, alpha 8, dropout 0.05; targets `q_proj`, `k_proj`, `v_proj`, `o_proj` |
| `adapter_model.safetensors` | 7,984,752 | LoRA adapter weights (SHA-256 `9f4aa0e1b3a3213829ae816b5b6cf1362bd379ed280241261d7505f843938c20`) |
| `chat_template.jinja` | 15,078 | Base chat template; SHA-256 matches the locally validated training template |
| `checkpoint.meta` | 164 | ID, step, UTC timestamp, train and null validation metrics |
| `tokenizer.json` | 27,868,174 | Base tokenizer; SHA-256 matches the locally validated tokenizer |
| `tokenizer_config.json` | 381 | Tokenizer metadata |

No merged base-model `model-*.safetensors` shards or full weights are in this six-file manifest. The safetensors header contains **192 LoRA tensors: 96 `lora_A` and 96 `lora_B`, zero non-LoRA tensors**. The checkpoint is **adapter-only plus tokenizer/template/config metadata**. The tokenizer alone is larger than the 8 MB adapter. Local inference needs the exact BF16 base model loaded separately; the published [Nebius MoE merge guide](https://docs.tokenfactory.nebius.com/post-training/merge-moe-lora-weights) uses this base and adapter to build a merged checkpoint. This inspection does not prove that the merged artifact would be accepted in this account's Dedicated beta.

## Serving cost gate

Current [Nebius fine-tuning model documentation](https://docs.tokenfactory.nebius.com/post-training/models) states that fine-tuned model deployment is available **only through Dedicated endpoints**. Its [Dedicated overview](https://docs.tokenfactory.nebius.com/ai-models-inference/dedicated-endpoints/overview) says custom weights require Dedicated and that billing is **per GPU hour with per-minute granularity**. The account Prices page lists indicative per-GPU-hour rates in `eu-north1`: L40S **$2.00**, H100 **$4.05**, H200 **$4.70**, B200 **$7.40**, and B300 **$8.10**. The viable GPU/template and replica count for **this checkpoint** have **not** been quoted by the deploy form. The signed-in successful job's Actions menu offered Job details and Download model files, with no Deploy action. Its fine-tuned name was absent from the self-service Dedicated model selector. The current account's base `openai/gpt-oss-20b` template is FP4, while the trained base is `unsloth/gpt-oss-20b-BF16`.

The [current Dedicated FAQ](https://docs.tokenfactory.nebius.com/ai-models-inference/dedicated-endpoints/faq) adds that custom fine-tuned weights are **beta, available on request**, and may require Nebius Support to enable access and confirm the configuration. For this MoE base, Nebius also publishes a [LoRA merge guide](https://docs.tokenfactory.nebius.com/post-training/merge-moe-lora-weights); whether merge/download/storage or an additional setup charge applies to **this checkpoint** has not been established. The earlier read-only endpoint creation form priced the **public base** `openai/gpt-oss-20b` with one H100 in `eu-north1`, one replica, at **$4.05/hour = $0.0675/minute**. This is a conditional comparison, **not** an accepted custom-weight template or an exact quote for `unsloth/gpt-oss-20b-BF16` plus its LoRA checkpoint. L40S's lower published GPU price cannot be called viable for this checkpoint without its template.

The [Dedicated billing policy](https://docs.tokenfactory.nebius.com/ai-models-inference/dedicated-endpoints/billing-policy) bills provisioned/ready replicas; provisioning/not-ready, replica restarts and endpoint shutdown are listed as not billed. The [operations guide](https://docs.tokenfactory.nebius.com/ai-models-inference/dedicated-endpoints/operating) permits `enabled=false` to release capacity; the [FAQ](https://docs.tokenfactory.nebius.com/ai-models-inference/dedicated-endpoints/faq) warns that a later restart may lack capacity. The provider does not publish a guaranteed loading/startup duration or an additional minimum billed duration on these pages. One billable minute on the observed H100 **base** quote would cost $0.0675; it is **not** a verified minimum invoice for the fine-tuned deployment. A possible bounded schedule, conditional on identical checkpoint pricing and one replica, is 15 minutes for two held-out canaries ($1.0125), up to 60 minutes for all 30 held-out cases ($4.05), 15 minutes for four golden cases ($1.0125) and 15 minutes for repeatability ($1.0125): **105 active minutes, $7.0875** before tax, custom setup/merge/storage or contractual charges. Stop the endpoint after each inference stage and review outputs offline; the intervals are planning caps, not measured runtime or guaranteed cost. If review requires restarting later, released capacity may be unavailable.

**Exact minimum serving/evaluation cost and a deployable GPU/template cannot yet be established** despite having the final checkpoint metadata: account-specific custom-weight enablement/template, the BF16/FP4 compatibility or merge requirement, the identical-base comparison route, a confirmed minimum-billing rule and any associated setup charges remain unresolved. Do not infer the exact answer from the public base quote. The earlier $7.0875 scenario covers only LoRA evaluation; adding a separately hosted identical BF16 base under the same unverified 1-H100 assumption would make the conditional planning arithmetic **$13.1625 / 195 active minutes**. See the [second serving gate and evaluation plan](SERVING_GATE_V0_1.md).

**Do not create a paid Dedicated endpoint or run fine-tuned inference without a separate serving-cost decision.** The job is terminal and its checkpoint and product-level usage have been read back. Obtain a compatible custom-weight serving quote and identical-base comparator cost; then stop for approval before creating any endpoint. Do not launch a second training job.
