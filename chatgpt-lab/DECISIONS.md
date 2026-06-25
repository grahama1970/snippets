# Decision Ledger

Append new decisions. Do not rewrite old entries merely because later work changes direction.

## 2026-06-25 — D-001: GitHub is the external project source

**Decision:** Use a versioned GitHub control plane because this ChatGPT session cannot add or update Project Sources directly.

**Consequence:** Every session must bootstrap from `SOURCE_INDEX.md`; conversational memory is not the source of truth.

## 2026-06-25 — D-002: Use an isolated branch until a dedicated repository exists

**Decision:** Host the control plane at `grahama1970/snippets@chatgpt-lab:chatgpt-lab/`.

**Reason:** The GitHub connector supports branches and file writes but does not expose repository creation.

**Migration rule:** When `grahama1970/chatgpt-lab` exists, copy this directory unchanged, preserve history where practical, and update `source-manifest.json`.

## 2026-06-25 — D-003: Evidence has explicit precedence

**Decision:** Git source proves code, GitHub Actions proves execution, Netlify proves deployment, and fresh screenshots plus interaction results prove rendered behavior. Model prose cannot override those artifacts.

## 2026-06-25 — D-004: No separate coding agent is required

**Decision:** ChatGPT may implement and review the website directly.

**Guardrail:** Builder and reviewer phases remain logically separate; the reviewer judges current source and rendered evidence rather than the builder's rationale.

## 2026-06-25 — D-005: The improvement loop must be bounded and recorded

**Decision:** Use a maximum of three rounds per run and at most five prioritized fixes per round. Each round writes an audit artifact before continuing.

## 2026-06-25 — D-006: Do not invent performance gates

**Decision:** Quantitative performance thresholds remain `NOT_ESTABLISHED` until a measured baseline and explicit acceptance decision are recorded.
