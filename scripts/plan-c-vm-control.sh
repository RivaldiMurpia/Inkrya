#!/usr/bin/env bash
# Operator-side Nebius stop and cleanup. Requires an already approved VM ID.
set -euo pipefail

mode="${1:-}"
if [[ "$mode" != check && "$mode" != stop && "$mode" != cleanup ]]; then
  echo 'usage: PLAN_C_VM_ID=<id> plan-c-vm-control.sh check|stop|cleanup' >&2
  exit 2
fi

: "${PLAN_C_VM_ID:?set the single approved canary VM ID}"
if [[ ! "$PLAN_C_VM_ID" =~ ^[a-zA-Z0-9_-]{8,128}$ ]]; then
  echo 'invalid VM ID' >&2
  exit 2
fi
command -v nebius >/dev/null || { echo 'Nebius CLI is required on the operator host' >&2; exit 2; }

case "$mode" in
  check)
    nebius compute instance get --id "$PLAN_C_VM_ID" --format json
    ;;
  stop)
    nebius compute instance stop --id "$PLAN_C_VM_ID"
    nebius compute instance get --id "$PLAN_C_VM_ID" --format json
    ;;
  cleanup)
    if [[ "${PLAN_C_OUTPUTS_EXPORTED:-}" != YES || "${PLAN_C_CLEANUP_CONFIRMED:-}" != YES ]]; then
      echo 'export and verify synthetic output first, then set PLAN_C_OUTPUTS_EXPORTED=YES and PLAN_C_CLEANUP_CONFIRMED=YES' >&2
      exit 2
    fi
    # Nebius deletes the managed boot disk declared in the VM spec with the VM.
    # Independently created disks require a separate, ID-checked deletion.
    nebius compute instance delete --id "$PLAN_C_VM_ID"
    if [[ -n "${PLAN_C_EXTRA_DISK_ID:-}" ]]; then
      nebius compute disk delete --id "$PLAN_C_EXTRA_DISK_ID"
    fi
    ;;
esac
