"""Offline preflight and bounded, synthetic-only base-versus-LoRA canary.

Preflight never makes an inference request. Run requires an already approved VM,
an independently armed VM stop watchdog, and a localhost-only vLLM server.
"""

import argparse
from hashlib import sha256
import json
import os
from pathlib import Path
import random
import re
import struct
import time
from urllib.parse import urlparse
from urllib.request import Request, urlopen


ROOT = Path(__file__).resolve().parent.parent
CORPUS = ROOT / "qa" / "plan-c"
BASE_ID = "unsloth/gpt-oss-20b-BF16"
LORA_ID = "inkrya-writer-v0-1-synthetic"
CANARY_IDS = ("pc-09-1-tenang", "pc-10-1-tegang")
BASE_REVISION = "cc89b3e7fd423253264883a80a4fa5abc619649f"
EXPECTED = {
    "records": "ac24f3a72f02aa5f06ed1823be9cecfa005e7521373b0a1dcbb301731cffd632",
    "reference": "9901b1b46e4d723a3952e29bf5371e4c59002aaffd8f6b7cec6b68c6aad66c67",
    "adapter": "9f4aa0e1b3a3213829ae816b5b6cf1362bd379ed280241261d7505f843938c20",
    "tokenizer": "0614fe83cadab421296e664e1f48f4261fa8fef6e03e63bb75c20f38e37d07d3",
    "template": "445c3a7c29d9cf61860179de179f60b6cf24834518b491016993eba63c8b1ecc",
    "canary_input": "3a365d37b92d542b81f919be3e8711ebeda5f48e083fb1ed5eb0db605af3482f",
}
FOREIGN = re.compile(r"\b(?:the|and|with|without|she|he|they|her|his|then|suddenly|meanwhile|however|was|were)\b", re.I)
META = re.compile(r"<\/?(?:think|analysis|final)\b|```|\b(?:as an ai|here is|berikut adalah)\b", re.I)
UNSAFE = re.compile("[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f\u200b-\u200f\u202a-\u202e\u2060\u2066-\u2069\ufffd]")
FIRST_PERSON = re.compile(r"\b(?:aku|saya|kami|kita)\b", re.I)
MAX_GPU_SECONDS = 3600
CLIENT_CUTOFF_SECONDS = 3240  # Stop inference at 54m; watchdog requests VM stop at 55m.
MAX_COMPLETION_TOKENS = 768


def checked_hash(path: Path, expected: str) -> str:
    digest = sha256()
    with path.open("rb") as source:
        for chunk in iter(lambda: source.read(4 * 1024 * 1024), b""):
            digest.update(chunk)
    actual = digest.hexdigest()
    if actual != expected:
        raise ValueError(f"SHA-256 mismatch: {path.name}: {actual}")
    return actual


def check_adapter_tensors(path: Path) -> None:
    with path.open("rb") as source:
        header_length, = struct.unpack("<Q", source.read(8))
        if header_length > 100_000:
            raise ValueError("unexpected adapter header length")
        header = json.loads(source.read(header_length))
    modules = ("k_proj", "o_proj", "q_proj", "v_proj")
    expected_keys = {f"model.layers.{layer}.self_attn.{module}.lora_{part}.weight"
                     for layer in range(24) for module in modules for part in "AB"}
    if set(header) - {"__metadata__"} != expected_keys:
        raise ValueError("adapter tensor names do not match the 24-layer attention-only LoRA")
    if any(header[key]["dtype"] != "BF16" or 8 not in header[key]["shape"] for key in expected_keys):
        raise ValueError("adapter tensor dtype/rank differs from approved BF16 rank-8 LoRA")


def rows(path: Path) -> list[dict]:
    return [json.loads(line) for line in path.read_text("utf-8").splitlines()]


def selected_inputs(canary_input: Path | None) -> list[tuple[dict, list[dict]]]:
    if canary_input is not None:
        checked_hash(canary_input, EXPECTED["canary_input"])
        source = json.loads(canary_input.read_text("utf-8"))
        if len(source) != 2 or [case["record"]["id"] for case in source] != list(CANARY_IDS):
            raise ValueError("canary bundle contains an incorrect case set")
        if any("target_id" in case["record"] or len(case["messages"]) != 2
               or [message["role"] for message in case["messages"]] != ["system", "user"]
               for case in source):
            raise ValueError("canary bundle contains an answer or invalid prompt")
        return [(case["record"], case["messages"]) for case in source]

    records_path = CORPUS / "heldout.records.jsonl"
    reference_path = CORPUS / "heldout.reference.jsonl"
    checked_hash(records_path, EXPECTED["records"])
    checked_hash(reference_path, EXPECTED["reference"])
    records, reference = rows(records_path), rows(reference_path)
    if len(records) != 30 or len(reference) != 30:
        raise ValueError("held-out corpus is not the sealed 30-row split")
    by_id = {record["id"]: record for record in records}
    if len(by_id) != 30:
        raise ValueError("duplicate held-out IDs")
    selected = []
    for case_id in CANARY_IDS:
        record = by_id[case_id]
        ref = reference[records.index(record)]["messages"]
        if [message["role"] for message in ref] != ["system", "user", "assistant"]:
            raise ValueError(f"unexpected message roles for {case_id}")
        if ref[2]["content"] != record["target_id"]:
            raise ValueError(f"reference mismatch for {case_id}")
        if json.loads(ref[1]["content"]) != {
            key: record[key]
            for key in ("source_draft_en", "required_facts", "forbidden_changes", "pov", "target_word_range", "scene_goal", "paragraphs")
        }:
            raise ValueError(f"prompt mismatch for {case_id}")
        selected.append((record, ref[:2]))
    return selected


def preflight(adapter_dir: Path, base_dir: Path | None = None,
              canary_input: Path | None = None) -> tuple[list[tuple[dict, list[dict]]], dict]:
    selected = selected_inputs(canary_input)

    adapter_dir = adapter_dir.resolve(strict=True)
    checked_hash(adapter_dir / "adapter_model.safetensors", EXPECTED["adapter"])
    check_adapter_tensors(adapter_dir / "adapter_model.safetensors")
    adapter = json.loads((adapter_dir / "adapter_config.json").read_text("utf-8"))
    if (adapter.get("base_model_name_or_path") != BASE_ID
            or adapter.get("peft_type") != "LORA" or adapter.get("r") != 8
            or adapter.get("lora_alpha") != 8 or adapter.get("lora_dropout") != 0.05
            or set(adapter.get("target_modules", [])) != {"q_proj", "k_proj", "v_proj", "o_proj"}
            or adapter.get("revision") is not None):
        raise ValueError("adapter config differs from the approved exact-base LoRA checkpoint")
    checked_hash(adapter_dir / "tokenizer.json", EXPECTED["tokenizer"])
    checked_hash(adapter_dir / "chat_template.jinja", EXPECTED["template"])

    if base_dir is not None:
        base_dir = base_dir.resolve(strict=True)
        config = json.loads((base_dir / "config.json").read_text("utf-8"))
        index = json.loads((base_dir / "model.safetensors.index.json").read_text("utf-8"))
        if "GptOssForCausalLM" not in config.get("architectures", []):
            raise ValueError("incorrect BF16 base architecture")
        if index.get("metadata", {}).get("total_size") != 41829514368:
            raise ValueError("incorrect BF16 base weight index")
        shards = set(index["weight_map"].values())
        if len(shards) != 9 or any(not (base_dir / name).is_file() for name in shards):
            raise ValueError("incomplete nine-shard BF16 base")
        checked_hash(base_dir / "tokenizer.json", EXPECTED["tokenizer"])
        checked_hash(base_dir / "chat_template.jinja", EXPECTED["template"])

    manifest = {
        "base_model": BASE_ID,
        "base_revision_requested": BASE_REVISION,
        "base_files_present": base_dir is not None,
        "adapter_sha256": EXPECTED["adapter"],
        "heldout_records_sha256": EXPECTED["records"],
        "heldout_reference_sha256": EXPECTED["reference"],
        "two_prompt_bundle_sha256": EXPECTED["canary_input"],
        "canary_ids": list(CANARY_IDS),
        "model_ids": [BASE_ID, LORA_ID],
        "batch_size": 1,
        "sampling": {"temperature": 0, "seed": 42, "max_tokens": MAX_COMPLETION_TOKENS, "n": 1},
        "human_semantic_review": "pending; mechanical checks cannot establish factual fidelity or literary quality",
    }
    return selected, manifest


def package_canaries(selected: list[tuple[dict, list[dict]]], out_dir: Path) -> None:
    if out_dir.resolve().is_relative_to(ROOT.resolve()):
        raise ValueError("private canary bundle must be outside the public repository")
    old_umask = os.umask(0o077)
    try:
        out_dir.mkdir(mode=0o700, parents=True, exist_ok=False)
        payload = [{"record": {key: value for key, value in record.items() if key != "target_id"},
                    "messages": messages} for record, messages in selected]
        path = out_dir / "canary-input.json"
        path.write_text(json.dumps(payload, ensure_ascii=False, sort_keys=True, separators=(",", ":")) + "\n", "utf-8")
        path.chmod(0o600)
        checked_hash(path, EXPECTED["canary_input"])
    finally:
        os.umask(old_umask)


def mechanical(text: str, record: dict, finish_reason: str | None) -> dict:
    word_count = len(text.strip().split())
    checks = {
        "word_range": record["target_word_range"]["min"] <= word_count <= record["target_word_range"]["max"],
        "one_paragraph": record["paragraphs"] == 1 and "\n" not in text and "\r" not in text,
        "complete": finish_reason == "stop" and bool(re.search(r"[.!?][”\"']?$", text.strip())),
        "no_meta_or_reasoning": META.search(text) is None,
        "no_obvious_foreign_leakage": FOREIGN.search(text) is None,
        "no_unsafe_unicode": UNSAFE.search(text) is None and text == __import__("unicodedata").normalize("NFC", text),
        "third_person_heuristic": record["pov"] == "third_person" and FIRST_PERSON.search(text) is None,
    }
    return {"word_count": word_count, "checks": checks, "all_mechanical_pass": all(checks.values())}


def checked_url(base_url: str) -> str:
    url = urlparse(base_url)
    if url.scheme != "http" or url.hostname not in {"127.0.0.1", "localhost", "::1"} or url.port != 8000 or url.path not in {"", "/"}:
        raise ValueError("vLLM must be reached on loopback port 8000 only")
    return base_url.rstrip("/")


def deadline_remaining(start_epoch: int) -> int:
    elapsed = time.time() - start_epoch
    if elapsed < 0 or elapsed >= CLIENT_CUTOFF_SECONDS:
        raise TimeoutError("canary client budget exceeded; stop VM by the cloud API now")
    return int(CLIENT_CUTOFF_SECONDS - elapsed)


def get_json(base_url: str, path: str, start_epoch: int, payload: dict | None = None) -> dict:
    remaining = deadline_remaining(start_epoch)
    request = Request(base_url + path, headers={"Content-Type": "application/json"},
                      data=json.dumps(payload, ensure_ascii=False).encode("utf-8") if payload is not None else None,
                      method="POST" if payload is not None else "GET")
    with urlopen(request, timeout=min(90, max(1, remaining - 1))) as response:
        return json.load(response)


def write_private(path: Path, data: object) -> None:
    with path.open("x", encoding="utf-8") as output:
        json.dump(data, output, ensure_ascii=False, indent=2)
        output.write("\n")
    path.chmod(0o600)


def run(selected: list[tuple[dict, list[dict]]], manifest: dict, base_url: str, start_epoch: int, out_dir: Path) -> None:
    if time.time() - start_epoch >= MAX_GPU_SECONDS:
        raise TimeoutError("60-minute VM cap reached")
    base_url = checked_url(base_url)
    if out_dir.resolve().is_relative_to(ROOT.resolve()):
        raise ValueError("raw results must be outside the public repository")
    old_umask = os.umask(0o077)
    try:
        out_dir.mkdir(mode=0o700, parents=True, exist_ok=False)
        if out_dir.is_symlink():
            raise ValueError("output directory must not be a symlink")
        listed = get_json(base_url, "/v1/models", start_epoch)
        ids = {item["id"] for item in listed.get("data", [])}
        if not set(manifest["model_ids"]).issubset(ids):
            raise RuntimeError(f"explicit base/LoRA routes unavailable: {sorted(ids)}")
        manifest["run_start_epoch"] = start_epoch
        manifest["model_registry_ids"] = sorted(ids)
        write_private(out_dir / "manifest.json", manifest)
        results = []
        for record, messages in selected:
            for role, model in (("base", BASE_ID), ("lora", LORA_ID)):
                payload = {"model": model, "messages": messages,
                           "temperature": 0, "seed": 42, "max_tokens": MAX_COMPLETION_TOKENS,
                           "n": 1, "stream": False}
                raw = get_json(base_url, "/v1/chat/completions", start_epoch, payload)
                write_private(out_dir / f"{record['id']}.{role}.raw.json", raw)
                if raw.get("model") != model or len(raw.get("choices", [])) != 1:
                    raise RuntimeError(f"unexpected response route/choice for {record['id']} {role}; no fallback")
                choice = raw["choices"][0]
                content = choice.get("message", {}).get("content")
                if not isinstance(content, str):
                    content = ""
                results.append({"case_id": record["id"], "role": role, "model": model,
                                "text": content, "usage": raw.get("usage"),
                                "finish_reason": choice.get("finish_reason"),
                                "mechanical": mechanical(content, record, choice.get("finish_reason"))})
        write_private(out_dir / "mechanical.json", results)
        blind = []
        unblind = {}
        rng = random.Random(42)
        for record, _ in selected:
            options = [result for result in results if result["case_id"] == record["id"]]
            rng.shuffle(options)
            unblind[record["id"]] = {label: result["role"] for label, result in zip("AB", options)}
            blind.append({"case_id": record["id"],
                          "required_facts": record["required_facts"],
                          "forbidden_changes": record["forbidden_changes"],
                          "scene_goal": record["scene_goal"], "pov": record["pov"],
                          "target_word_range": record["target_word_range"], "paragraphs": record["paragraphs"],
                          "candidates": [{"label": label, "text": result["text"],
                                          "mechanical": result["mechanical"],
                                          "human": {key: None for key in (
                                              "natural_indonesian", "coherent", "all_required_facts_preserved",
                                              "all_forbidden_changes_absent", "no_invented_action_or_fact",
                                              "no_malformed_diction", "no_irrelevant_foreign_leakage",
                                              "pov_compliant", "paragraph_compliant", "word_range_compliant")},
                                          "notes": ""}
                                         for label, result in zip("AB", options)]})
        write_private(out_dir / "blind-review.json", {"cases": blind, "human_review_complete": False,
                                                       "go_no_go": "STOP unless both LoRA canaries clearly improve over base"})
        write_private(out_dir / "unblind-key.json", unblind)
    finally:
        os.umask(old_umask)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("action", choices=("preflight", "package", "run"))
    parser.add_argument("--adapter-dir", type=Path, required=True)
    parser.add_argument("--base-dir", type=Path)
    parser.add_argument("--canary-input", type=Path)
    parser.add_argument("--output-dir", type=Path)
    parser.add_argument("--run-start-epoch", type=int)
    parser.add_argument("--api-base", default="http://127.0.0.1:8000")
    args = parser.parse_args()
    if args.action == "package" and args.canary_input is not None:
        parser.error("package reads the sealed local corpus, not an existing bundle")
    selected, manifest = preflight(args.adapter_dir, args.base_dir, args.canary_input)
    if args.action == "package":
        if args.output_dir is None:
            parser.error("package requires a new --output-dir outside the repo")
        package_canaries(selected, args.output_dir)
        print(json.dumps({"case_ids": list(CANARY_IDS), "bundle": str(args.output_dir / 'canary-input.json'),
                          "sha256": EXPECTED["canary_input"]}))
        return
    if args.action == "preflight":
        print(json.dumps(manifest, indent=2))
        return
    if args.base_dir is None or args.output_dir is None or args.run_start_epoch is None:
        parser.error("run requires --base-dir, --output-dir and --run-start-epoch")
    run(selected, manifest, args.api_base, args.run_start_epoch, args.output_dir)
    print(f"Canary raw responses and unreviewed rubric written privately to {args.output_dir}")


if __name__ == "__main__":
    main()
