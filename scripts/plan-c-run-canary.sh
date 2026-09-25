#!/usr/bin/env bash
# Run on an already approved VM, after localhost vLLM reports both explicit IDs.
set -euo pipefail
umask 077

work_dir="${PLAN_C_WORK_DIR:-/mnt/inkrya}"
bundle_dir="${PLAN_C_BUNDLE_DIR:-/mnt/inkrya/bundle}"
adapter_dir="${PLAN_C_ADAPTER_DIR:-/mnt/inkrya/adapter}"
base_dir="${PLAN_C_BASE_DIR:-/mnt/inkrya/base}"
out_dir="${PLAN_C_OUTPUT_DIR:-/mnt/inkrya/private-results/canary-v0.1}"

systemctl is-active --quiet inkrya-plan-c-stop.timer || { echo 'stop timer inactive; stop VM' >&2; exit 2; }
budget_text="$(sudo -n cat /etc/inkrya-plan-c-budget.env)"
# shellcheck source=/dev/null
source /dev/stdin <<< "$budget_text"
start_epoch=$((PLAN_C_DEADLINE_EPOCH - 3600))
remaining=$((PLAN_C_DEADLINE_EPOCH - $(date +%s)))
(( remaining >= 900 )) || { echo 'less than 15m remain; stop VM' >&2; exit 2; }
[[ -f "$work_dir/preflight.json" && -x "$work_dir/venv/bin/python" ]] || { echo 'serve preflight incomplete' >&2; exit 2; }
[[ -f "$bundle_dir/canary-input.json" ]] || { echo 'canary bundle missing' >&2; exit 2; }

"$work_dir/venv/bin/python" "$bundle_dir/scripts/plan-c-canary.py" run \
  --adapter-dir "$adapter_dir" --base-dir "$base_dir" \
  --canary-input "$bundle_dir/canary-input.json" \
  --run-start-epoch "$start_epoch" --output-dir "$out_dir"
echo 'Export the private results and immediately stop the VM with scripts/plan-c-vm-control.sh stop.'
