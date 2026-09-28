# Working on Personal OS

Rules for AI coding sessions (Claude Code or Claude) on this repo. Read `docs/PRD.md` for what to build and `docs/ARCHITECTURE.md` for how.

## Commands

```bash
npm install
npm test           # Vitest unit tests (Node, in-memory SQLite)
npm run typecheck  # tsc --noEmit
npm run build      # typecheck + production build
npm run dev        # dev server
```

Run `npm test` and `npm run build` before every commit. Both must pass.

## Conventions

- TypeScript strict mode; no `any` unless unavoidable and commented.
- Database SQL and logic go in `src/db/` (later `src/engine/`) as plain functions that take a `Database`, with Vitest tests next to them (`*.test.ts`). The UI never touches SQLite directly; it calls the worker through `db().call(...)`, and every call is typed in `src/db/protocol.ts`.
- Schema changes: append to `MIGRATIONS` in `src/db/core.ts`. Never edit or reorder a migration that has shipped.
- UI: iOS look and feel. Use the colour tokens from `src/index.css` (`bg-card`, `text-label-2`, `text-accent`, …) and the components in `src/ui/`. Inputs at 17px so iOS doesn't zoom. Respect safe areas with `env(safe-area-inset-*)`.
- Every screen has its own URL (react-router).
- User-facing text: plain English, sentence case, no jargon. Dates in `en-IN` format, currency INR by default.
- Nothing leaves the device except to the user's OneDrive and (read-only) Google Calendar. No analytics, no third-party scripts at runtime.
- Keep bundles lean: load heavy libraries (editor, charts, graph) per screen with dynamic `import()`.

## Workflow

- Work in small steps; commit after each working step with a clear message.
- Update `CHANGELOG.md` for anything the user will notice, and `docs/ARCHITECTURE.md` when structure or decisions change.
- Features that can only be verified on the iPhone: say so in the commit or changelog, and list what the user should check.
- Never commit secrets. OAuth client IDs are public and may be committed; client secrets never are (v1 needs none).

## Target

iPhone, iOS 18 or later (the owner's phone runs iOS 18.1 as of Sep 2026), installed to the Home Screen from Safari. Features that need a newer Safari (for example Screen Wake Lock, Safari 18.4) must check for support and degrade gracefully. Also usable in desktop Chrome, Edge and Safari for development.
