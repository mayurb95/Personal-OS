# Personal OS

An offline-first Progressive Web App (PWA) for iPhone that brings Obsidian-style notes, Notion-style databases, tasks, habits, workouts, journal, expenses and reading into one private app, backed up to OneDrive.

It is a personal, single-user app. There is no server of its own: the app is static files on Cloudflare Pages, and all data lives on the iPhone, with backups in the owner's OneDrive.

**Status:** Phase 0 (setup and feasibility checks). See [CHANGELOG.md](CHANGELOG.md).

## Documents

| File | What it holds |
| --- | --- |
| [docs/PRD.md](docs/PRD.md) | Product requirements: what the app does and why |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | How the code is organised and the technical decisions |
| [docs/SETUP.md](docs/SETUP.md) | One-time setup: hosting, installing on the iPhone, accounts |
| [CLAUDE.md](CLAUDE.md) | Working rules for AI coding sessions on this repo |
| [CHANGELOG.md](CHANGELOG.md) | What changed in each version |

## Install on iPhone

1. Open the app's address (for example `https://personal-os.pages.dev`) in **Safari**.
2. Tap **Share**, then **Add to Home Screen**, then **Add**.
3. Open **Personal OS** from its Home Screen icon. Always use the icon, not a Safari tab: the two have separate storage.

## Develop

Requires Node.js 22 and Git.

```bash
npm install
npm run dev        # local dev server
npm test           # unit tests (Vitest)
npm run typecheck  # TypeScript
npm run build      # production build into dist/
npm run preview    # serve the production build locally
```

Pushing to `main` deploys automatically through Cloudflare Pages.

## Tech stack

TypeScript, React, Vite, Tailwind CSS, vite-plugin-pwa (Workbox), SQLite WebAssembly on the Origin Private File System, Vitest. Later phases add CodeMirror 6, ECharts, Sigma.js, MSAL.js and Google Identity Services.
