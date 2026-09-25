#!/usr/bin/env bash
# Run on the ONE approved H100 VM only, after its boot-time stop timer is active.
# This script installs/downloads/serves; it does not create a VM or other model jobs.
set -euo pipefail
umask 077

base_dir="${PLAN_C_BASE_DIR:-/mnt/inkrya/base}"
adapter_dir="${PLAN_C_ADAPTER_DIR:-/mnt/inkrya/adapter}"
work_dir="${PLAN_C_WORK_DIR:-/mnt/inkrya}"
canary_input="${PLAN_C_CANARY_INPUT:-/mnt/inkrya/bundle/canary-input.json}"
base_revision='cc89b3e7fd423253264883a80a4fa5abc619649f'

[[ -f /etc/inkrya-plan-c-budget.env ]] || { echo 'VM watchdog config missing; stop VM' >&2; exit 2; }
systemctl is-active --quiet inkrya-plan-c-stop.timer || { echo 'VM stop timer is not active; stop VM' >&2; exit 2; }
# Budget file is root-only on purpose; never relax its permissions.
# shellcheck source=/dev/null
source <(sudo -n cat /etc/inkrya-plan-c-budget.env)
[[ $((PLAN_C_DEADLINE_EPOCH - $(date +%s))) -ge 1200 ]] || { echo 'less than 20m remain; stop VM' >&2; exit 2; }
[[ -f "$adapter_dir/adapter_config.json" && -f "$adapter_dir/adapter_model.safetensors" ]] || { echo 'approved adapter missing' >&2; exit 2; }
[[ -f "$canary_input" ]] || { echo 'two-prompt canary bundle missing' >&2; exit 2; }
command -v nvidia-smi >/dev/null || { echo 'NVIDIA driver missing; stop VM' >&2; exit 2; }
command -v python3.12 >/dev/null || { echo 'Python 3.12 missing; stop VM' >&2; exit 2; }

gpu_count="$(nvidia-smi --list-gpus | wc -l)"
gpu_name="$(nvidia-smi --query-gpu=name --format=csv,noheader | head -n 1)"
gpu_mem_mib="$(nvidia-smi --query-gpu=memory.total --format=csv,noheader,nounits | head -n 1 | tr -d ' ')"
cuda_max="$(nvidia-smi | sed -n 's/.*CUDA Version: \([0-9.]*\).*/\1/p' | head -n 1)"
if [[ "$gpu_count" != 1 || "$gpu_name" != *H100* || ! "$gpu_mem_mib" =~ ^[0-9]+$ ]] \
    || (( gpu_mem_mib < 76000 )) || [[ -z "$cuda_max" ]] || ! python3.12 - "$cuda_max" <<'PY'
import sys
major, minor = (int(x) for x in sys.argv[1].split('.')[:2])
sys.exit(0 if (major, minor) >= (12, 9) else 1)
PY
then
  echo 'requires exactly one unpartitioned H100 >=76000 MiB and driver supporting CUDA >=12.9; stop VM' >&2
  exit 2
fi

mkdir -p "$work_dir" "$base_dir"
python3.12 -m venv "$work_dir/venv"
"$work_dir/venv/bin/python" -m pip install --disable-pip-version-check --no-cache-dir --only-binary=:all: \
  --extra-index-url https://download.pytorch.org/whl/cu129 'vllm==0.29.0' 'torch==2.13.0'
"$work_dir/venv/bin/python" - <<'PY'
import torch, vllm
assert vllm.__version__ == '0.29.0', vllm.__version__
assert torch.__version__.split('+')[0] == '2.13.0', torch.__version__
assert torch.cuda.is_available() and torch.cuda.device_count() == 1
assert 'H100' in torch.cuda.get_device_name(0)
print({'vllm': vllm.__version__, 'torch': torch.__version__, 'gpu': torch.cuda.get_device_name(0)})
PY
"$work_dir/venv/bin/python" -m pip freeze --all > "$work_dir/dependencies.actual.txt"

"$work_dir/venv/bin/python" - "$base_dir" "$base_revision" <<'PY'
import sys
from huggingface_hub import HfApi, snapshot_download
base_dir, revision = sys.argv[1:]
model_id = 'unsloth/gpt-oss-20b-BF16'
actual = HfApi().model_info(model_id, revision=revision).sha
if actual != revision:
    raise ValueError(f'base revision mismatch: {actual}')
snapshot_download(repo_id=model_id, revision=revision, local_dir=base_dir,
                  allow_patterns=['*.safetensors', '*.json', 'chat_template.jinja'])
print({'base': model_id, 'pinned_revision': actual})
PY

"$work_dir/venv/bin/python" scripts/plan-c-canary.py preflight --adapter-dir "$adapter_dir" \
  --base-dir "$base_dir" --canary-input "$canary_input" > "$work_dir/preflight.json"
[[ $((PLAN_C_DEADLINE_EPOCH - $(date +%s))) -ge 900 ]] || { echo 'less than 15m remain after download; stop VM' >&2; exit 2; }

# Both explicit model names are served by the same unquantized BF16 base.
# vLLM static startup LoRA avoids dynamic loads and silent adapter fallback.
lora_module="$("$work_dir/venv/bin/python" - "$adapter_dir" <<'PY'
import json,sys
print(json.dumps({'name': 'inkrya-writer-v0-1-synthetic', 'path': sys.argv[1],
                  'base_model_name': 'unsloth/gpt-oss-20b-BF16'}))
PY
)"
"$work_dir/venv/bin/vllm" serve "$base_dir" \
  --served-model-name unsloth/gpt-oss-20b-BF16 \
  --enable-lora --lora-modules "$lora_module" --max-lora-rank 8 --max-loras 1 \
  --dtype bfloat16 --tensor-parallel-size 1 --max-model-len 2048 \
  --max-num-seqs 1 --gpu-memory-utilization 0.85 \
  --reasoning-parser openai_gptoss --host 127.0.0.1 --port 8000 \
  > "$work_dir/vllm.log" 2>&1 &
server_pid=$!
printf '%s\n' "$server_pid" > "$work_dir/vllm.pid"
while :; do
  [[ $((PLAN_C_DEADLINE_EPOCH - $(date +%s))) -ge 900 ]] || { echo 'server did not become ready with 15m left; stop VM' >&2; exit 2; }
  kill -0 "$server_pid" 2>/dev/null || { echo "vLLM exited; inspect $work_dir/vllm.log and stop VM" >&2; exit 2; }
  if curl --fail --silent --max-time 2 --output /dev/null http://127.0.0.1:8000/v1/models; then
    break
  fi
  sleep 3
done
echo 'Local-only base/LoRA server ready; run scripts/plan-c-run-canary.sh before the deadline.'
