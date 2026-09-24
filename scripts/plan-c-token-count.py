"""Measure the fixed synthetic Plan C corpus with the gpt-oss-20b-BF16 tokenizer.

Install tiktoken, tokenizers and jinja2 in an isolated environment; download the
model's tokenizer.json and chat_template.jinja as described in qa/plan-c/README.md.
This is an offline estimate of serialized training examples, not a Nebius bill.
"""

import argparse
from datetime import datetime
from hashlib import sha256
import json
from pathlib import Path

import jinja2
import tiktoken
from tokenizers import Tokenizer


ROOT = Path(__file__).resolve().parent.parent
EXPECTED = {
    "tokenizer": "0614fe83cadab421296e664e1f48f4261fa8fef6e03e63bb75c20f38e37d07d3",
    "template": "445c3a7c29d9cf61860179de179f60b6cf24834518b491016993eba63c8b1ecc",
    "train": "d809ffde13b3fb2031bd7a0ccffa19070af28fa69818aeb4189b9d058e9ed1f7",
    "heldout": "9901b1b46e4d723a3952e29bf5371e4c59002aaffd8f6b7cec6b68c6aad66c67",
}


def verified(path: Path, key: str) -> bytes:
    data = path.read_bytes()
    actual = sha256(data).hexdigest()
    if actual != EXPECTED[key]:
        raise ValueError(f"{key} SHA-256 mismatch: {actual}")
    return data


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--tokenizer", type=Path, required=True)
    parser.add_argument("--chat-template", type=Path, required=True)
    parser.add_argument("--date", default="2026-09-24", help="UTC date used by the model template")
    args = parser.parse_args()
    date = datetime.strptime(args.date, "%Y-%m-%d")

    verified(args.tokenizer, "tokenizer")
    template_source = verified(args.chat_template, "template").decode("utf-8")
    tokenizer = Tokenizer.from_file(str(args.tokenizer))
    harmony = tiktoken.encoding_for_model("gpt-oss-20b")
    if harmony.name != "o200k_harmony":
        raise ValueError("unexpected gpt-oss tokenizer encoding")

    env = jinja2.Environment(trim_blocks=True, lstrip_blocks=True)
    template = env.from_string(template_source)
    results = {}
    for key, filename in (("train", "train.nebius.jsonl"), ("heldout", "heldout.reference.jsonl")):
        corpus = verified(ROOT / "qa" / "plan-c" / filename, key)
        lengths = []
        completion_content = 0
        for number, line in enumerate(corpus.splitlines(), start=1):
            row = json.loads(line)
            messages = row["messages"]
            if [m["role"] for m in messages] != ["system", "user", "assistant"]:
                raise ValueError(f"{filename}:{number}: unexpected roles")
            rendered = template.render(
                messages=messages,
                add_generation_prompt=False,
                strftime_now=lambda fmt: date.strftime(fmt),
            )
            ids = tokenizer.encode(rendered, add_special_tokens=False).ids
            if ids != harmony.encode(rendered, allowed_special="all"):
                raise ValueError(f"{filename}:{number}: Hugging Face and Harmony tokenizers differ")
            lengths.append(len(ids))
            completion_content += len(tokenizer.encode(messages[-1]["content"], add_special_tokens=False).ids)
        results[key] = {
            "examples": len(lengths),
            "rendered_tokens": sum(lengths),
            "assistant_content_tokens": completion_content,
            "min_tokens": min(lengths),
            "max_tokens": max(lengths),
            "sha256": EXPECTED[key],
        }

    print(json.dumps({"model": "unsloth/gpt-oss-20b-BF16", "date_utc": args.date,
                      "tokenizer": harmony.name, "results": results}, indent=2))


if __name__ == "__main__":
    main()
