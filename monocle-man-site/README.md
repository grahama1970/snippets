# Monocle Man — React benchmark fixture

This folder is the bounded Monocle Man benchmark surface for ChatGPT-Lab. It lives on `preview-monocle-man-netlify` and is changed through isolated ChatGPT-authored branches and pull requests.

## Scope

The vague product ask is intentionally simple: turn the Monocle Man film into a polished landing page. The experiment is whether ChatGPT can convert that ask into a deterministic React implementation with evidence instead of vague prose.

This slice implements the landing page only. Slides, chat UI, login, databases, personalization, and broader PhatGPT/controller architecture are out of scope for this benchmark round.

## Local commands

```bash
npm install
npm run build
npm run test:benchmark
```

The benchmark emits `benchmark-evidence/` with interactions, console/network reports, accessibility output, screenshots, image status, rendered source, artifact manifest, and evidence-derived `verdict.json`.

## Netlify settings

- Base directory: `monocle-man-site`
- Build command: `npm run build`
- Publish directory: `dist`
- Production branch: `preview-monocle-man-netlify`

`netlify.toml` keeps the build command and publish directory versioned with the fixture.
