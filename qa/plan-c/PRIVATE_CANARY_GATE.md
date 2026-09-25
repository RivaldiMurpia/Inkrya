# Plan C v0.1: private, two-case Nebius AI Cloud canary gate — 2026-09-25

**Status: the user approved one private canary on 2026-09-25, but account preflight is BLOCKED; no paid resource was launched.** Phase 1 remains INCOMPLETE. Keep Production Gateway, the existing `WRITER_MODEL`, the one successful SFT job, and Phase 2 unchanged. This is a single on-demand H100 proposal for **two** synthetic held-out prompts, comparing the exact BF16 base and its LoRA in one running process. It never merges or publishes weights and never reads application manuscripts.

**Execution checkpoint, 2026-09-25 02:45 UTC:** Before any VM creation or payment, the authenticated Nebius AI Cloud console at `console.nebius.com` showed a Cloudflare security block ("Sorry, you have been blocked"); one allowed reload showed the same block. The workspace has no installed Nebius CLI or other authenticated AI Cloud account route. The adapter/two-prompt local preflight still passed. **Account payment state, H100 quota/stock, displayed GPU and disk prices, region/image availability, and service-account GET/STOP permissions could not be verified.** The first-payment/top-up amount was **not observed**; do not infer that it is required or waived. Stop under the user's pre-create guardrail. No payment, VM, endpoint, extra training, model download, inference, disk, or other billed resource was created. Resume only when an authorized account route enables all pre-create checks; do not substitute public rate information for the account quote or bypass the security block.

## Serving decision and runtime compatibility

The user reports Nebius Support confirmed that this private fine-tuned LoRA has no standard shared/serverless route or cheaper managed evaluation option; Dedicated requires merging the adapter with its exact base to full weights and custom weights remain beta, with no published minimum compatible template. **Do not create a Token Factory Dedicated Endpoint.** This support response was supplied in the conversation, not independently accessed as an email.

The downloaded `adapter_config.json` names **`unsloth/gpt-oss-20b-BF16`**, `peft_type=LORA`, PEFT 0.19.1, rank/alpha 8/8, dropout 0.05 and attention projections `q_proj/k_proj/v_proj/o_proj`; its revision is unspecified. The safetensors header contains **192 BF16 rank-8 tensors: four projections × A/B × 24 layers**. `adapter_model.safetensors` SHA-256 is `9f4aa0e1b3a3213829ae816b5b6cf1362bd379ed280241261d7505f843938c20`; packaged tokenizer and template hashes match the exact repo content previously measured. The **base repo ID is exact**, but the SFT job did not record an immutable base-weight revision. We propose pinning currently verified Hugging Face revision `cc89b3e7fd423253264883a80a4fa5abc619649f` and checking the tokenizer/template hashes and base architecture/weight index before inference. This does **not** prove bitwise identity with the training-time weight revision; stop if a mismatch emerges.

Official [vLLM 0.29.0 LoRA documentation](https://docs.vllm.ai/en/v0.29.0/features/lora/) supports static `--lora-modules` with an explicit `base_model_name` and independent model IDs; its [supported-model table](https://docs.vllm.ai/en/v0.29.0/models/supported_models/) marks `GptOssForCausalLM` as LoRA-capable. The intended runtime is **Ubuntu 24.04/CUDA 13**, Python **3.12**, `vllm==0.29.0`, `torch==2.13.0` from the CUDA 12.9 wheel index, with the LoRA loaded directly by vLLM. CUDA 13 driver compatibility with CUDA 12.9 binaries follows NVIDIA's [backward-compatibility rule](https://docs.nvidia.com/deploy/cuda-compatibility/). vLLM installs its transitive dependencies; the VM captures their exact versions in `/mnt/inkrya/dependencies.actual.txt`. **No physical H100, dependency resolution, model download or model/adapter loading was exercised locally.** If install, hashes, driver, memory or model registry fail on the one approved VM, stop that VM without creating another.

Nebius lists a recommended [Ubuntu 24.04/CUDA 13 GPU image family](https://docs.nebius.com/compute/storage/boot-disk-images) `ubuntu24.04-cuda13.0` for `gpu-h100-sxm`; the [one-GPU preset](https://docs.nebius.com/compute/virtual-machines/types) is `1gpu-16vcpu-200gb` in `eu-north1` (one H100 with 80 GB HBM). The exact BF16 weight index is **41,829,514,368 bytes = 38.957 GiB**, adapter **7,984,752 bytes ≈ 7.61 MiB**. Even interpreting H100's advertised 80 GB conservatively as **74.5 GiB**, the configured `--gpu-memory-utilization 0.85` targets ~63.3 GiB, leaving ~24.3 GiB within that target after raw weights for engine/KV/LoRA overhead; this is a feasibility estimate, **not measured peak VRAM**. Serving restricts context to 2,048 tokens, one concurrent sequence, tensor parallel 1, BF16, and localhost only. `nvidia-smi`, CUDA, Python and both `/v1/models` routes must pass before any canary request.

## Two-prompt fixture and rubric

Local full-corpus SHA checks validate 30 sealed held-out prompts and references, then package **only** `pc-09-1-tenang` (38–51 words) and `pc-10-1-tegang` (40–53 words), both third-person, one paragraph. The private transfer file `canary-input.json` has SHA-256 `3a365d37b92d542b81f919be3e8711ebeda5f48e083fb1ed5eb0db605af3482f` and contains **two records and two system/user prompts, zero reference assistant answers and no other held-out cases**. No training file, golden acceptance case, private novel or application project is transferred. Source split SHA-256: records `ac24f3a72f02aa5f06ed1823be9cecfa005e7521373b0a1dcbb301731cffd632`; references `9901b1b46e4d723a3952e29bf5371e4c59002aaffd8f6b7cec6b68c6aad66c67`.

The same `messages`, `temperature=0`, `seed=42`, `max_tokens=768`, `n=1` are sent once to base and once to LoRA for each case: **4 total requests, batch size 1, no repair/retry/fallback**. Response `model` must equal the requested explicit route. Raw synthetic responses, usage, completion reason and mechanical results are saved privately outside Git. Mechanical checks reject word-count, paragraph, incomplete, meta/reasoning, obvious English leakage, unsafe Unicode and first-person heuristic failures. A **blind human review** then grades natural Indonesian, coherence, every required fact, every forbidden change, no invented action/fact, diction, foreign leakage, POV, paragraph and range for both arms. Mechanical scores do not substitute for fact or literary review. **Stop after these two** if the LoRA lacks clear improvement over the base. The remaining 28 held-out and all four golden cases require a separate decision.

## Cost gate, stop budget and loading window

Current [Nebius on-demand GPU price](https://nebius.com/prices) is **$3.85 per H100-hour** through 2026-09-30 and **$4.50 per H100-hour from 2026-10-01**. [Compute bills running GPU time per second and provisioned Network SSD at $0.071/GiB/730 h](https://docs.nebius.com/compute/resources/pricing). Choose one **200 GiB VM-managed network SSD boot disk**, no second disk, no shared filesystem or snapshots. Public pricing lists network ingress/egress and public IP as free. Taxes, actual account quote/discount/credits and possible payment funding are unverified; the provider lists a **$25 first-payment minimum**, distinct from consumption.

| Component | Budget arithmetic before tax |
| --- | ---: |
| GPU, at most 60 min of *observed running time* | $3.8500 now; $4.5000 starting Oct 1 |
| Managed boot disk, provisioned up to 24 h | 200 × $0.071 × 24/730 = **$0.46685** |
| Network/public IP per currently published schedule | **$0.00** |
| **One-canary evaluation planning allowance** | **$4.31685 ≈ $4.32 now**; **$4.96685 ≈ $4.97 starting Oct 1** |
| Disk left allocated a further 24 h | **+$0.46685/day** until VM/disk deletion |

The **absolute deadline is rendered immediately before the create call**, so boot/provisioning, package installation, ~39 GiB base download, model load, four responses, result export and stop all consume the same 60 minutes. Working allowance: boot 3–8 min, Python wheels 5–12 min, model download 7–20 min at roughly 100–300 MiB/s (13+ min at 50 MiB/s), loading 4–10 min, canary 4–8 min, result export 2–5 min, provider stop buffer 5 min. These are **planning ranges, not measured loading/network SLAs**. At minute 54 the client refuses another request; an independently armed systemd timer requests the Nebius API stop at minute 55; `--recovery-policy fail` and guest shutdown are backups if the API fails. Operator should issue `stop` immediately after exporting results and confirm `STOPPED`. A cloud-side stop delay can push actual GPU billing above 60 minutes; **this is a hard execution plan, not a provider-enforced spending cap**. Stop early if readiness has fewer than 15 minutes left.

## Verified local preparation; no paid action

Run locally from the repository, with the downloaded adapter files in a **private directory outside Git**. The checkpoint/adapter download was done in the earlier gate; replace the path if the scratch workspace is lost, and verify its hashes again. The private two-prompt bundle is already staged at `/workspace/scratch/dada79a7c05d/inkrya-plan-c-private/canary-input/` in the current workspace; repackage to a **new** directory if needed.

```bash
node scripts/plan-c-validate.mjs
PYTHONDONTWRITEBYTECODE=1 python3 scripts/plan-c-canary.test.py
python3 scripts/plan-c-canary.py preflight \
  --adapter-dir /workspace/scratch/dada79a7c05d/inkrya-plan-c-private/adapter \
  --canary-input /workspace/scratch/dada79a7c05d/inkrya-plan-c-private/canary-input/canary-input.json
# Recreate the bundle only when the original private path is absent, using a NEW output directory:
python3 scripts/plan-c-canary.py package --adapter-dir "$PLAN_C_PRIVATE_ROOT/adapter" \
  --output-dir "$PLAN_C_PRIVATE_ROOT/canary-input-new"
```

The local checks were **6/6 Python offline guard tests PASS**, **36/36 Node unit tests PASS**, Node corpus validator PASS and shell syntax PASS. A mocked Nebius CLI verified the minute-55 scheduled stop, the explicit provider stop command, and the cleanup export guard. No model inference was made. `scripts/plan-c-serve-canary.sh` and `scripts/plan-c-run-canary.sh` remain untested on real GPU hardware.

## Single-VM commands, for use **only after explicit paid-canary approval**

Before running the create command, the operator must have a configured `nebius` CLI, actual project/subnet/service-account IDs, service-account permission for **its own instance GET and STOP**, an SSH key, one on-demand GPU quota/capacity slot, a current account quote that does not materially exceed $4.32, and a public `ubuntu24.04-cuda13.0` image recommended for `gpu-h100-sxm` in `eu-north1`. This account's Cloud console was blocked at a security screen when last checked; these account-specific facts **cannot be independently verified in this workspace**. Check image/permissions/read-only price before approval-to-create; **stop rather than substitute a different platform/image/rate**.

```bash
# 1. Read-only checks and private operator variables (never commit IDs or SSH keys).
nebius compute image list-public --region eu-north1 --format json
export PLAN_C_PROJECT_ID='<actual-project-id>'
export PLAN_C_SUBNET_ID='<actual-eu-north1-subnet-id>'
export PLAN_C_SERVICE_ACCOUNT_ID='<actual-limited-service-account-id>'
export PLAN_C_VM_NAME='inkryaqa-canary-v0-1'
export PLAN_C_PRIVATE_ROOT='/path/outside/repo/inkrya-plan-c-private'
export PLAN_C_SSH_PUBLIC_KEY='/path/to/operator/id_ed25519.pub'
export PLAN_C_SSH_PRIVATE_KEY='/path/to/operator/id_ed25519'

# 2. Create a single-use 60-minute absolute deadline JUST before create.
python3 scripts/plan-c-render-cloud-init.py --project-id "$PLAN_C_PROJECT_ID" \
  --vm-name "$PLAN_C_VM_NAME" --ssh-public-key-file "$PLAN_C_SSH_PUBLIC_KEY" \
  --output "$PLAN_C_PRIVATE_ROOT/cloud-init-once.yml"
nebius compute instance create --name "$PLAN_C_VM_NAME" --parent-id "$PLAN_C_PROJECT_ID" \
  --resources-platform gpu-h100-sxm --resources-preset 1gpu-16vcpu-200gb \
  --on-demand --recovery-policy fail --service-account-id "$PLAN_C_SERVICE_ACCOUNT_ID" \
  --boot-disk-managed-disk-name inkryaqa-canary-boot --boot-disk-managed-disk-type network_ssd \
  --boot-disk-managed-disk-size-gibibytes 200 \
  --boot-disk-managed-disk-source-image-family-image-family ubuntu24.04-cuda13.0 \
  --boot-disk-attach-mode read_write \
  --cloud-init-user-data "$(cat "$PLAN_C_PRIVATE_ROOT/cloud-init-once.yml")" \
  --network-interfaces "[{\"name\":\"eth0\",\"subnet_id\":\"$PLAN_C_SUBNET_ID\",\"ip_address\":{},\"public_ip_address\":{}}]" \
  --format json

# 3. Record the sole VM ID returned by the create call. Verify the timer before download.
export PLAN_C_VM_ID='<ID-from-create-response>'
bash scripts/plan-c-vm-control.sh check
export PLAN_C_VM_IP='<public-ip-from-check>'
ssh -i "$PLAN_C_SSH_PRIVATE_KEY" "inkryaqa@$PLAN_C_VM_IP" \
  'sudo systemctl is-active inkrya-plan-c-stop.timer && sudo systemctl list-timers inkrya-plan-c-stop.timer --no-pager && sudo install -d -o inkryaqa -g inkryaqa -m 0700 /mnt/inkrya /mnt/inkrya/bundle'
```

The documented [Nebius CLI quickstart](https://docs.nebius.com/compute/quickstart) supplies the managed boot disk, network and image flags; its [CLI reference](https://docs.nebius.com/cli/reference/compute/instance/create) documents `--on-demand`, service account, cloud-init and `--recovery-policy fail`. The renderer requires a fresh filename and writes a root-only VM watchdog config; it performs **no create call**. Use shell history/security appropriate to the user's account. The `check|stop|cleanup` commands are in `scripts/plan-c-vm-control.sh`, based on Nebius's [instance stop](https://docs.nebius.com/cli/reference/compute/instance/stop) and [delete](https://docs.nebius.com/cli/reference/compute/instance/delete) API. If creation fails **after** an instance ID exists, immediately call `stop`; never issue another create automatically.

Transfer only the two-prompt bundle and private adapter (not the 30-row reference JSONL). Set the real VM public IP from `check`, then, on the **operator workstation**, run:

```bash
mkdir -p "$PLAN_C_PRIVATE_ROOT/bundle/scripts"
cp scripts/plan-c-canary.py scripts/plan-c-serve-canary.sh scripts/plan-c-run-canary.sh \
  "$PLAN_C_PRIVATE_ROOT/bundle/scripts/"
cp "$PLAN_C_PRIVATE_ROOT/canary-input/canary-input.json" "$PLAN_C_PRIVATE_ROOT/bundle/"
tar -C "$PLAN_C_PRIVATE_ROOT/bundle" -czf "$PLAN_C_PRIVATE_ROOT/canary-bundle.tar.gz" \
  scripts canary-input.json
# Adapter staging may consist of local symlinks; dereference them into a private archive.
tar --dereference -C "$PLAN_C_PRIVATE_ROOT" -czf "$PLAN_C_PRIVATE_ROOT/adapter.tar.gz" adapter
scp -i "$PLAN_C_SSH_PRIVATE_KEY" "$PLAN_C_PRIVATE_ROOT/canary-bundle.tar.gz" \
  "inkryaqa@$PLAN_C_VM_IP:/mnt/inkrya/"
scp -i "$PLAN_C_SSH_PRIVATE_KEY" "$PLAN_C_PRIVATE_ROOT/adapter.tar.gz" \
  "inkryaqa@$PLAN_C_VM_IP:/mnt/inkrya/"
ssh -i "$PLAN_C_SSH_PRIVATE_KEY" "inkryaqa@$PLAN_C_VM_IP" \
  'tar -C /mnt/inkrya/bundle -xzf /mnt/inkrya/canary-bundle.tar.gz && tar -C /mnt/inkrya -xzf /mnt/inkrya/adapter.tar.gz && cd /mnt/inkrya/bundle && bash scripts/plan-c-serve-canary.sh'
ssh -i "$PLAN_C_SSH_PRIVATE_KEY" "inkryaqa@$PLAN_C_VM_IP" \
  'cd /mnt/inkrya/bundle && bash scripts/plan-c-run-canary.sh'
scp -i "$PLAN_C_SSH_PRIVATE_KEY" -r \
  "inkryaqa@$PLAN_C_VM_IP:/mnt/inkrya/private-results/canary-v0.1" \
  "$PLAN_C_PRIVATE_ROOT/"
# Verify local files include all four raw JSONs, mechanical.json, blind-review.json,
# unblind-key.json, manifest.json. Store private hashes, then immediately:
bash scripts/plan-c-vm-control.sh stop
# Confirm STOPPED; after output export, delete the VM and its VM-managed boot disk:
PLAN_C_OUTPUTS_EXPORTED=YES PLAN_C_CLEANUP_CONFIRMED=YES \
  bash scripts/plan-c-vm-control.sh cleanup
```

Use the two generated human review forms **offline after stop**. If the download/install/serve stage exceeds its bound, the runtime fails, either canary is unpromising, or the timer/stop command fails, **STOP; no second job, alternate GPU, 30-row inference or golden inference**. Even a successful canary does not change `WRITER_MODEL` or finish Phase 1; request a separate decision for any subsequent quality evaluation.
