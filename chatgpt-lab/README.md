# ChatGPT-Lab Control Plane

This directory is the persistent, versioned source of truth for the **ChatGPT-Lab verified self-improvement system**.

The Monocle Man SPA is the first benchmark fixture. The larger objective is a reusable system in which ChatGPT can:

1. discover and load relevant skills;
2. modify website code;
3. run deterministic GitHub CI;
4. deploy and inspect the rendered Netlify site;
5. review code and design as separate phases;
6. apply evidence-backed fixes;
7. repeat within a bounded loop; and
8. improve the loop itself from recorded failures and successes.

## Session bootstrap

At the beginning of work in the ChatGPT-Lab Project, read these files in order:

1. `SOURCE_INDEX.md`
2. `source-manifest.json`
3. `OPERATING_CONTRACT.md`
4. `CURRENT_STATE.md`
5. `REVIEW_RUBRIC.md`
6. `DECISIONS.md`

Then load only the relevant skills from `grahama1970/agent-skills` using its generated registry.

## Evidence hierarchy

1. GitHub source and commit SHA prove what code exists.
2. GitHub Actions logs and artifacts prove what executed.
3. Netlify proves what is deployed.
4. Fresh screenshots and interaction results prove what users see and can do.
5. Review findings guide changes but do not override deterministic evidence.
6. Conversation memory is context, never execution proof.

## Current location

This control plane is temporarily hosted at:

- Repository: `grahama1970/snippets`
- Branch: `chatgpt-lab`
- Root: `chatgpt-lab/`

The GitHub connector available to ChatGPT can update files and branches but cannot create repositories. When an empty private `grahama1970/chatgpt-lab` repository becomes available, this directory can be migrated unchanged and the manifest updated.
