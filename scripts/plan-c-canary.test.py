"""Offline guard tests; all model responses below are synthetic fixtures."""

from importlib.util import module_from_spec, spec_from_file_location
import json
import os
from pathlib import Path
import re
import subprocess
import tempfile
import time
import unittest
from unittest.mock import patch


spec = spec_from_file_location("canary", Path(__file__).with_name("plan-c-canary.py"))
canary = module_from_spec(spec)
spec.loader.exec_module(canary)
watchdog_spec = spec_from_file_location("cloud_init", Path(__file__).with_name("plan-c-render-cloud-init.py"))
cloud_init = module_from_spec(watchdog_spec)
watchdog_spec.loader.exec_module(cloud_init)


def fixture():
    records = [json.loads(line) for line in (canary.CORPUS / "heldout.records.jsonl").read_text().splitlines()]
    refs = [json.loads(line)["messages"] for line in (canary.CORPUS / "heldout.reference.jsonl").read_text().splitlines()]
    selected = [(record, ref[:2]) for record, ref in zip(records, refs) if record["id"] in canary.CANARY_IDS]
    answers = {record["id"]: record["target_id"] for record, _ in selected}
    return selected, answers


class CanaryGuardsTest(unittest.TestCase):
    def test_watchdog_arms_provider_stop_and_operator_cleanup_requires_export(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            fake_bin = root / "bin"
            fake_bin.mkdir()
            log = root / "commands.log"
            fake_commands = {
                "nebius": """#!/usr/bin/env python3
import json, os, sys
with open(os.environ['PLAN_C_MOCK_LOG'], 'a') as f: f.write('nebius ' + ' '.join(sys.argv[1:]) + '\\n')
if 'get-by-name' in sys.argv: print(json.dumps({'metadata': {'id': 'instance_12345'}}))
elif ' get ' in ' '.join(sys.argv): print(json.dumps({'status': {'state': 'STOPPED'}}))
""",
                "systemd-run": "#!/bin/sh\nprintf 'timer %s\\n' \"$*\" >> \"$PLAN_C_MOCK_LOG\"\n",
                "systemctl": "#!/bin/sh\nprintf 'systemctl %s\\n' \"$*\" >> \"$PLAN_C_MOCK_LOG\"\n",
            }
            for name, content in fake_commands.items():
                path = fake_bin / name
                path.write_text(content)
                path.chmod(0o755)
            config = root / "budget.env"
            config.write_text("PLAN_C_PROJECT_ID='project_1234'\nPLAN_C_VM_NAME='inkryaqa_canary_1'\n"
                              f"PLAN_C_DEADLINE_EPOCH='{int(time.time()) + 3600}'\n")
            env = dict(os.environ, PATH=f"{fake_bin}:{os.environ['PATH']}",
                       PLAN_C_MOCK_LOG=str(log), PLAN_C_BUDGET_FILE=str(config),
                       PLAN_C_VM_ID="instance_12345")
            scripts = Path(__file__).parent
            subprocess.run(["bash", str(scripts / "plan-c-budget-watchdog.sh"), "arm"],
                           env=env, check=True, capture_output=True, text=True)
            commands = log.read_text()
            timer = re.search(r"--on-active=(\d+)s", commands)
            self.assertIsNotNone(timer)
            self.assertGreaterEqual(int(timer.group(1)), 3290)
            self.assertLessEqual(int(timer.group(1)), 3300)
            self.assertNotIn("nebius compute instance stop", commands)
            denied = subprocess.run(["bash", str(scripts / "plan-c-vm-control.sh"), "cleanup"],
                                    env=env, capture_output=True, text=True)
            self.assertNotEqual(denied.returncode, 0)
            self.assertNotIn("instance delete", log.read_text())
            subprocess.run(["bash", str(scripts / "plan-c-vm-control.sh"), "stop"],
                           env=env, check=True, capture_output=True, text=True)
            self.assertIn("nebius compute instance stop --id instance_12345", log.read_text())

    def test_private_bundle_contains_exactly_two_prompts_and_no_reference_answers(self):
        selected, answers = fixture()
        with tempfile.TemporaryDirectory() as temporary:
            output = Path(temporary) / "bundle"
            canary.package_canaries(selected, output)
            imported = canary.selected_inputs(output / "canary-input.json")
            self.assertEqual([record["id"] for record, _ in imported], list(canary.CANARY_IDS))
            self.assertEqual([messages for _, messages in imported], [messages for _, messages in selected])
            data = (output / "canary-input.json").read_text()
            self.assertTrue(all(answer not in data for answer in answers.values()))
            self.assertNotIn("target_id", data)
            self.assertEqual(len(json.loads(data)), 2)
            self.assertEqual((output / "canary-input.json").stat().st_mode & 0o777, 0o600)

    def test_only_two_canaries_and_same_messages_for_both_routes(self):
        selected, answers = fixture()
        calls = []

        def fake_get(_url, path, _start, payload=None):
            if path == "/v1/models":
                return {"data": [{"id": canary.BASE_ID}, {"id": canary.LORA_ID}]}
            calls.append(payload)
            case_id = next(record["id"] for record, messages in selected if payload["messages"] == messages)
            return {"model": payload["model"], "choices": [{"message": {"content": answers[case_id]}, "finish_reason": "stop"}], "usage": {"total_tokens": 50}}

        with tempfile.TemporaryDirectory() as temporary, patch.object(canary, "get_json", side_effect=fake_get):
            output = Path(temporary) / "fresh"
            canary.run(selected, {"model_ids": [canary.BASE_ID, canary.LORA_ID]}, "http://127.0.0.1:8000", int(time.time()), output)
            self.assertEqual(len(calls), 4)
            self.assertEqual([p["model"] for p in calls], [canary.BASE_ID, canary.LORA_ID] * 2)
            self.assertEqual(calls[0]["messages"], calls[1]["messages"])
            self.assertEqual(calls[2]["messages"], calls[3]["messages"])
            self.assertTrue(all(len(p["messages"]) == 2 for p in calls))
            self.assertTrue(all(record["target_id"] not in json.dumps(calls) for record, _ in selected))
            self.assertEqual({r["case_id"] for r in json.loads((output / "mechanical.json").read_text())}, set(canary.CANARY_IDS))
            blind = json.loads((output / "blind-review.json").read_text())
            key = json.loads((output / "unblind-key.json").read_text())
            for case in blind["cases"]:
                self.assertEqual({x["label"] for x in case["candidates"]}, {"A", "B"})
                self.assertEqual(set(key[case["case_id"]].values()), {"base", "lora"})
                self.assertTrue(all(all(v is None for v in x["human"].values()) for x in case["candidates"]))

    def test_wrong_model_response_stops_without_fallback(self):
        selected, answers = fixture()

        def fake_get(_url, path, _start, payload=None):
            if path == "/v1/models":
                return {"data": [{"id": canary.BASE_ID}, {"id": canary.LORA_ID}]}
            return {"model": "unexpected-model", "choices": [{"message": {"content": answers[selected[0][0]["id"]]}, "finish_reason": "stop"}]}

        with tempfile.TemporaryDirectory() as temporary, patch.object(canary, "get_json", side_effect=fake_get):
            output = Path(temporary) / "fresh"
            with self.assertRaisesRegex(RuntimeError, "no fallback"):
                canary.run(selected, {"model_ids": [canary.BASE_ID, canary.LORA_ID]}, "http://127.0.0.1:8000", int(time.time()), output)
            self.assertTrue((output / f"{canary.CANARY_IDS[0]}.base.raw.json").exists())
            self.assertFalse((output / f"{canary.CANARY_IDS[0]}.lora.raw.json").exists())

    def test_deadline_and_non_loopback_are_rejected(self):
        with self.assertRaises(ValueError):
            canary.checked_url("https://api.tokenfactory.nebius.com")
        with self.assertRaises(TimeoutError):
            canary.deadline_remaining(int(time.time()) - canary.CLIENT_CUTOFF_SECONDS - 1)
        record = fixture()[0][0][0]
        failed = canary.mechanical("The model thinks\nI moved the label", record, "length")
        self.assertFalse(failed["all_mechanical_pass"])
        self.assertFalse(failed["checks"]["one_paragraph"])
        self.assertFalse(failed["checks"]["no_obvious_foreign_leakage"])

    def test_rendered_boot_watchdog_has_absolute_deadline_and_fail_closed_poweroff(self):
        deadline = int(time.time()) + 3599
        document = cloud_init.render("project_1234", "inkryaqa_canary_1", "ssh-ed25519 AAAAB3NzaC1yc2EAAAADAQABAAABAQCtest", deadline)
        self.assertTrue(document.startswith("#cloud-config\n"))
        self.assertEqual(document.count("  - path:"), 2)
        self.assertIn(f"PLAN_C_DEADLINE_EPOCH='{deadline}'", document)
        self.assertIn("--on-active", document)
        self.assertIn("/sbin/poweroff", document)
        with self.assertRaises(ValueError):
            cloud_init.render("project_1234", "inkryaqa_canary_1", "ssh-ed25519 AAAAB3NzaC1yc2EAAAADAQABAAABAQCtest", deadline + 600)


if __name__ == "__main__":
    unittest.main()
