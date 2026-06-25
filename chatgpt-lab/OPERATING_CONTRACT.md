# ChatGPT-Lab Operating Contract

## Mission

Build and validate a reusable, evidence-driven website self-improvement system. The Monocle Man SPA is the first benchmark fixture; improvement of the fixture is a means of testing the system, not the final objective.

ChatGPT is the controller, implementer, and evidence adjudicator. A separate coding agent is optional, not required. Builder and reviewer phases must remain logically separate even when performed by the same model.

## Inner loop

Every website iteration follows this bounded sequence:

1. **Bootstrap context**
   - Read the control-plane source index and current state.
   - Refresh the skill registry.
   - Select the smallest applicable skill chain.
   - Load each selected `SKILL.md` and required `composes` dependencies.
   - Record skill paths, refs, and hashes.

2. **Establish the baseline**
   - Read the website at an exact Git commit.
   - Run or retrieve deterministic tests.
   - Capture fresh desktop and mobile renders.
   - Inspect images, fonts, responsive behavior, interactions, console errors, and network failures.
   - Mark missing evidence as `INSUFFICIENT_EVIDENCE`.

3. **Define the round**
   - State the user job and design classification.
   - Define observable acceptance and rejection criteria.
   - Choose at most five prioritized changes.
   - Preserve accepted design decisions unless current evidence invalidates them.

4. **Implement**
   - Work on an isolated branch.
   - Make the smallest coherent patch that addresses the selected findings.
   - Avoid unrelated refactors.
   - Update tests when behavior changes.

5. **Execute and prove**
   - Run GitHub Actions for the exact commit.
   - Require deterministic interaction, accessibility, responsive, console, image, and build checks.
   - Require fresh screenshot artifacts from the same commit.
   - Retrieve logs and artifacts rather than relying on status prose.

6. **Deploy and inspect**
   - Deploy the verified commit to Netlify.
   - Confirm deployment metadata identifies that commit.
   - Inspect the live site at desktop and mobile widths.
   - Verify actual images, fonts, layout, navigation, modal/video behavior, focus behavior, and reduced motion.

7. **Review independently**
   - Run a code review against source and tests.
   - Run a visual review against fresh screenshots and the live deployment.
   - The reviewer must not accept the builder's rationale as evidence.
   - Findings must identify observable defects, exact locations, and a verifiable fix condition.

8. **Gate**
   - `PASS`: all required evidence exists and all blocking criteria pass.
   - `NEEDS_CHANGES`: agent-fixable defects remain.
   - `BLOCKED`: an external capability, permission, credential, or human decision is required.
   - `INSUFFICIENT_EVIDENCE`: required tests, deployment proof, or screenshots are missing or stale.

9. **Retry or stop**
   - Apply only evidence-backed fixes.
   - Repeat up to the configured maximum rounds.
   - Stop at `PASS`, a documented blocker, insufficient evidence that cannot be produced, or round exhaustion.
   - Never report a pass merely because code was written successfully.

## Outer loop

After each run, inspect the improvement process itself:

- Was the correct skill chain selected?
- Did a skill add value or create conflict/noise?
- Were acceptance gates observable and complete?
- Did CI detect the defects a human or visual reviewer found?
- Did the reviewer produce false positives or false greens?
- Did the deployment correspond to the tested commit?
- Did the system stop too early, skip a phase, or require avoidable human intervention?

Record system-level lessons separately from website findings. Update the router, skills, schemas, tests, or operating contract only when evidence shows the process should change.

## Role separation

### Builder phase

May write source, tests, workflow files, and iteration artifacts. Must cite the finding or gate addressed by each material change.

### Reviewer phase

Must be read-only with respect to the candidate revision until findings are finalized. Must inspect current artifacts, not builder summaries. It may recommend changes but may not silently alter the evidence it is judging.

### Gate phase

Consumes deterministic evidence and reviewer findings. It must distinguish test truth, deployment truth, visual judgment, and unresolved human preference.

## Evidence contract

Each completed round should record:

- control-plane ref;
- skill-registry ref/hash;
- selected skills;
- website branch and commit;
- CI run and job identifiers;
- test and accessibility results;
- deployment identifier and URL;
- desktop and mobile screenshot paths;
- code-review findings;
- design-review findings;
- changes applied;
- unresolved issues;
- verdict and stop reason.

Evidence must be produced after the candidate commit. Stale artifacts cannot prove a newer revision.

## Non-negotiable rules

- Do not invent test results, deployment status, metrics, screenshots, or transcript content.
- Do not accept DOM existence as proof that an interaction works.
- Do not accept source inspection as proof of visual quality.
- Do not accept a screenshot as proof of keyboard or behavioral correctness.
- Do not hide broken/degraded states behind optimistic prose.
- Do not load all skills indiscriminately; use progressive disclosure.
- Do not modify historical iteration records to make later results appear cleaner.
- Do not run an unbounded conversational retry loop.
- Do not claim asynchronous or background work will complete later.

## Source maintenance

After a material capability, repository, deployment, or policy change:

1. update `source-manifest.json`;
2. update `CURRENT_STATE.md`;
3. append a dated entry to `DECISIONS.md` when the change affects architecture or policy;
4. preserve prior iteration evidence;
5. validate the control-plane files.

## Current default limits

- Maximum improvement rounds per run: 3
- Maximum prioritized website changes per round: 5
- Required viewport classes: desktop and mobile
- Required visual evidence age: same commit/deployment as the review
- Quantitative performance thresholds: `NOT_ESTABLISHED` until a measured baseline and explicit project gate are recorded
