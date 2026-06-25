#!/usr/bin/env python3
"""Validate the versioned ChatGPT-Lab control-plane source."""

from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
REQUIRED_FILES = (
    "README.md",
    "SOURCE_INDEX.md",
    "source-manifest.json",
    "OPERATING_CONTRACT.md",
    "CURRENT_STATE.md",
    "REVIEW_RUBRIC.md",
    "DECISIONS.md",
    "schemas/iteration.schema.json",
)


def load_json(relative_path: str) -> dict:
    path = ROOT / relative_path
    with path.open("r", encoding="utf-8") as handle:
        value = json.load(handle)
    if not isinstance(value, dict):
        raise ValueError(f"{relative_path} must contain a JSON object")
    return value


def main() -> int:
    errors: list[str] = []

    for relative_path in REQUIRED_FILES:
        path = ROOT / relative_path
        if not path.is_file():
            errors.append(f"missing required file: {relative_path}")
        elif path.stat().st_size == 0:
            errors.append(f"empty required file: {relative_path}")

    try:
        manifest = load_json("source-manifest.json")
        if manifest.get("schema") != "chatgpt_lab.source_manifest.v1":
            errors.append("source-manifest.json has an unexpected schema")
        sources = manifest.get("sources")
        if not isinstance(sources, list) or not sources:
            errors.append("source-manifest.json must contain at least one source")
        else:
            ids = [source.get("id") for source in sources if isinstance(source, dict)]
            if len(ids) != len(set(ids)):
                errors.append("source-manifest.json contains duplicate source ids")
            required_source_ids = {
                "agent-skills-registry",
                "monocle-man-source",
                "monocle-man-ci",
                "monocle-man-netlify",
            }
            missing = sorted(required_source_ids.difference(ids))
            if missing:
                errors.append(f"source-manifest.json is missing sources: {', '.join(missing)}")
    except (OSError, ValueError, json.JSONDecodeError) as exc:
        errors.append(f"invalid source-manifest.json: {exc}")

    try:
        iteration_schema = load_json("schemas/iteration.schema.json")
        required = set(iteration_schema.get("required", []))
        expected = {
            "schema",
            "iteration_id",
            "started_at",
            "control_plane",
            "skills",
            "candidate",
            "evidence",
            "reviews",
            "verdict",
        }
        missing = sorted(expected.difference(required))
        if missing:
            errors.append(f"iteration schema is missing required fields: {', '.join(missing)}")
    except (OSError, ValueError, json.JSONDecodeError) as exc:
        errors.append(f"invalid iteration schema: {exc}")

    result = {
        "schema": "chatgpt_lab.control_plane_validation.v1",
        "status": "PASS" if not errors else "FAIL",
        "root": str(ROOT),
        "required_files": list(REQUIRED_FILES),
        "errors": errors,
    }
    print(json.dumps(result, indent=2, sort_keys=True))
    return 0 if not errors else 1


if __name__ == "__main__":
    sys.exit(main())
