#!/usr/bin/env bash
# To install inside an approved Nebius VM with a VM-attached service account.
# Boot/user-data must write /etc/inkrya-plan-c-budget.env before calling arm.
set -euo pipefail

config_file="${PLAN_C_BUDGET_FILE:-/etc/inkrya-plan-c-budget.env}"
[[ -f "$config_file" ]] || { echo "missing $config_file" >&2; exit 2; }
# Config is provisioned from fixed IDs/timestamp at VM creation, never from a project file.
# shellcheck source=/dev/null
source "$config_file"
: "${PLAN_C_PROJECT_ID:?}"
: "${PLAN_C_VM_NAME:?}"
: "${PLAN_C_DEADLINE_EPOCH:?}"
[[ "$PLAN_C_PROJECT_ID" =~ ^[a-zA-Z0-9_-]{8,128}$ ]] || exit 2
[[ "$PLAN_C_VM_NAME" =~ ^[a-zA-Z0-9_-]{8,128}$ ]] || exit 2
[[ "$PLAN_C_DEADLINE_EPOCH" =~ ^[0-9]{10,12}$ ]] || exit 2
command -v nebius >/dev/null || { echo 'Nebius CLI missing in VM' >&2; exit 2; }

if ! vm_id="$(timeout 30s nebius compute instance get-by-name --name "$PLAN_C_VM_NAME" --parent-id "$PLAN_C_PROJECT_ID" --format json | python3 -c 'import json,sys; print(json.load(sys.stdin)["metadata"]["id"])')" || [[ ! "$vm_id" =~ ^[a-zA-Z0-9_-]{8,128}$ ]]; then
  echo 'VM ID lookup failed; guest shutdown under recovery-policy fail' >&2
  /sbin/poweroff
  exit 2
fi

stop_or_poweroff() {
  # The provider API is authoritative; a guest poweroff is the FAIL-policy backup.
  if timeout 30s nebius compute instance stop --id "$vm_id"; then
    return 0
  fi
  echo 'Provider stop failed; guest shutdown under recovery-policy fail' >&2
  /sbin/poweroff
}

case "${1:-}" in
  arm)
    # Deadline is absolute from BEFORE the create request, including boot and downloads.
    remaining=$((PLAN_C_DEADLINE_EPOCH - $(date +%s)))
    if (( remaining <= 300 )); then
      stop_or_poweroff
      exit
    fi
    if (( remaining > 3600 )); then
      echo 'deadline exceeds approved 60-minute cap' >&2
      exit 2
    fi
    command -v systemd-run >/dev/null || { echo 'systemd-run missing' >&2; exit 2; }
    # Stop at minute 55; allow five minutes for provider stop completion.
    systemd-run --unit inkrya-plan-c-stop --on-active="$((remaining - 300))s" --collect \
      /usr/local/sbin/plan-c-budget-watchdog.sh stop-now
    systemctl list-timers inkrya-plan-c-stop.timer --no-pager
    ;;
  stop-now)
    stop_or_poweroff
    ;;
  *)
    echo 'usage: plan-c-budget-watchdog.sh arm|stop-now' >&2
    exit 2
    ;;
esac
