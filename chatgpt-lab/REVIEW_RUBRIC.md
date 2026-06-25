# Review Rubric

A revision passes only when its Git commit, CI results, Netlify deployment, desktop screenshot, mobile screenshot, and interaction evidence all refer to the same candidate.

Required checks:

- the site builds and renders without browser errors or broken assets;
- navigation, mobile menu, film modal, keyboard controls, and external film link work;
- images load and crop correctly at desktop and mobile sizes;
- headings, control names, focus, reduced motion, and automated accessibility checks pass;
- typography, hierarchy, spacing, color, imagery, and motion form a coherent modern editorial design;
- changed behavior is tested and the source remains understandable;
- no review relies on stale screenshots or source inspection alone.

Verdicts:

- `PASS`: all required evidence is current and blocking checks pass.
- `NEEDS_CHANGES`: an agent-fixable defect remains.
- `BLOCKED`: an external permission, service, credential, or human decision is required.
- `INSUFFICIENT_EVIDENCE`: required test, deployment, screenshot, or interaction proof is missing or stale.

Limit each round to five prioritized fixes. A code pass cannot override a visual failure, and a screenshot cannot override a functional failure.
