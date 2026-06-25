# Monocle Man — Netlify review build

This folder is an isolated review build on the `preview-monocle-man-netlify` branch. It does not alter the repository's `master` branch.

## Netlify settings

- Base directory: `monocle-man-site`
- Build command: leave blank
- Publish directory: `.`
- Production branch: `preview-monocle-man-netlify`

The site uses Netlify Image CDN for optimized YouTube stills. `netlify.toml` allowlists `i.ytimg.com` as the remote image source.

## Review loop

1. Netlify deploys the connected branch.
2. Review the live URL at desktop and mobile widths.
3. Make changes on a new review branch or update this preview branch.
4. Netlify deploys the revision automatically.
5. Merge an approved design into the eventual production repository/branch.
