---
project: ChatGPT-Lab
source_version: 0.1.0
updated: 2026-06-25
canonical_manifest: source-manifest.json
---

# Source Index

This file is the entry point for every ChatGPT-Lab session.

## Bootstrap rule

Before changing code, reviewing design, or claiming system status:

1. Read `source-manifest.json`.
2. Read `OPERATING_CONTRACT.md` and `CURRENT_STATE.md`.
3. Fetch the current `grahama1970/agent-skills` registry.
4. Select the smallest applicable skill chain.
5. Record the registry reference and selected skills in the iteration artifact.
6. Inspect the benchmark repository at the exact recorded branch or commit.
7. Treat missing CI, deployment, screenshot, or interaction evidence as `INSUFFICIENT_EVIDENCE` rather than success.

## Canonical sources

| Source | Location | Purpose |
|---|---|---|
| Lab control plane | `grahama1970/snippets`, branch `chatgpt-lab`, path `chatgpt-lab/` | Operating contract, state, decisions, schemas, and iteration records |
| Skill registry | `grahama1970/agent-skills`, branch `main`, `SOURCES.md` and `sources/agent-skills-registry.json` | Skill discovery and progressive loading |
| Benchmark source | `grahama1970/snippets`, branch `preview-monocle-man-netlify`, path `monocle-man-site/` | Monocle Man SPA source code |
| Execution evidence | GitHub Actions associated with the benchmark commit or pull request | Tests, logs, reports, and screenshot artifacts |
| Rendered evidence | Netlify project `monocle-man-review` | Live deployed website |
| Visual evidence | Fresh desktop/mobile screenshots from the same commit and deployment | Design and responsive verification |
| Original media | `https://youtu.be/NBxByrz5BRE` | Source film and dialogue context |

## Source precedence

When sources disagree, use this order:

1. exact GitHub file content at the recorded commit;
2. GitHub Actions output for that commit;
3. Netlify deployment metadata and rendered page;
4. fresh screenshots and interaction artifacts;
5. current selected `SKILL.md` guidance;
6. project decision records;
7. conversational recollection.

## Refresh rules

- Refresh the skill registry before each new task family or when its recorded hash changes.
- Refresh benchmark source before every patch.
- Refresh CI and deployment evidence after every commit.
- Never reuse screenshots to judge a newer commit.
- Update `CURRENT_STATE.md` whenever a capability, blocker, repository location, or deployment state changes.
- Append rather than rewrite historical entries in `DECISIONS.md` and iteration records.

## Current caveat

The ChatGPT GitHub connector does not expose repository creation. This branch is therefore the active control-plane source until a dedicated repository is created. This limitation does not prevent ChatGPT from reading, updating, versioning, or using this material as canonical context.
