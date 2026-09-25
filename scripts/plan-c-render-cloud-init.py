"""Render a single-use Nebius cloud-init watchdog, without creating any VM.

Run immediately before an already approved creation request. The absolute
deadline is set from this invocation, so a stale file must never be reused.
"""

import argparse
import json
from pathlib import Path
import re
import time


ROOT = Path(__file__).resolve().parent


def render(project: str, vm_name: str, public_key: str, deadline: int) -> str:
    if not re.fullmatch(r"[A-Za-z0-9_-]{8,128}", project):
        raise ValueError("invalid project ID")
    if not re.fullmatch(r"[A-Za-z0-9_-]{8,128}", vm_name):
        raise ValueError("invalid VM name")
    if not re.fullmatch(r"ssh-ed25519 [A-Za-z0-9+/=]+(?: [A-Za-z0-9_.@-]+)?", public_key):
        raise ValueError("use a single SSH ed25519 public key, not a private key")
    if deadline <= int(time.time()) or deadline > int(time.time()) + 3600:
        raise ValueError("deadline must be within 60 minutes from now")
    watchdog = (ROOT / "plan-c-budget-watchdog.sh").read_text("utf-8")
    budget = f"PLAN_C_PROJECT_ID='{project}'\nPLAN_C_VM_NAME='{vm_name}'\nPLAN_C_DEADLINE_EPOCH='{deadline}'\n"
    block = lambda value: "\n".join("      " + line for line in value.splitlines())
    return ("#cloud-config\n"
            "users:\n"
            "  - name: inkryaqa\n"
            "    sudo: ALL=(ALL) NOPASSWD:ALL\n"
            "    shell: /bin/bash\n"
            "    ssh_authorized_keys:\n"
            f"      - {json.dumps(public_key)}\n"
            "write_files:\n"
            "  - path: /usr/local/sbin/plan-c-budget-watchdog.sh\n"
            "    owner: root:root\n"
            "    permissions: '0700'\n"
            "    content: |\n" + block(watchdog) + "\n"
            "  - path: /etc/inkrya-plan-c-budget.env\n"
            "    owner: root:root\n"
            "    permissions: '0600'\n"
            "    content: |\n" + block(budget) + "\n"
            "runcmd:\n"
            # Recovery policy FAIL is mandatory. If the provider stop call fails,
            # halt the guest to avoid indefinite billed uptime.
            "  - [bash, -lc, '/usr/local/sbin/plan-c-budget-watchdog.sh arm || /sbin/poweroff']\n")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--project-id", required=True)
    parser.add_argument("--vm-name", required=True)
    parser.add_argument("--ssh-public-key-file", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    if args.output.exists():
        parser.error("refusing to reuse or overwrite an earlier deadline file")
    key = args.ssh_public_key_file.read_text("utf-8").strip()
    deadline = int(time.time()) + 3600
    text = render(args.project_id, args.vm_name, key, deadline)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(text, encoding="utf-8")
    args.output.chmod(0o600)
    print(json.dumps({"cloud_init_path": str(args.output), "deadline_epoch": deadline,
                      "requires_recovery_policy": "fail", "creates_resource": False}))


if __name__ == "__main__":
    main()
