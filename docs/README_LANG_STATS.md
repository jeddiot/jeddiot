# Language stats (auto-generated)

This repo contains an auto-generated SVG showing language breakdown for a repository. The SVG is created by scripts/generate-lang-stats.js and updated by a scheduled GitHub Action (.github/workflows/update-lang-stats.yml).

Embed the image in your README.md like this (replace owner/repo/branch if different):

```md
![Languages](https://raw.githubusercontent.com/jeddiot/jeddiot/main/docs/languages.svg)
```

Notes:
- The Action uses the repository's GITHUB_TOKEN (no extra secrets needed) to commit the generated file.
- For local testing, run:
  ```
  node scripts/generate-lang-stats.js --repo=jeddiot/jeddiot --out=docs/languages.svg
  ```
  Make sure you use Node 18+ (or run inside the Action runner).
- If your repo is private or you need higher rate limits, provide a token with repo:read access via env GITHUB_TOKEN or pass --token=YOUR_TOKEN when running locally.