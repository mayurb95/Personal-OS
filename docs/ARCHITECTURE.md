# Architecture

How Personal OS is built, and why. Read this before changing structure. The product requirements are in [PRD.md](PRD.md).

## Shape of the app

```
Installed web app (Safari, Home Screen)
  React UI  ──messages──►  Database Web Worker  ──►  SQLite (WebAssembly) in OPFS
  Service worker: caches the app shell for offline use
Outside (later phases): OneDrive (backups, vault mirror, Reminders bridge files), Google Calendar
```

- **No server.** The app is static files on Cloudflare Pages. Nothing about the user's data is sent anywhere except their OneDrive and (read-only) Google Calendar.
- **The iPhone holds the only editable copy.** OneDrive gets one-way backups and a read-only vault mirror (Phase 1 and 3).

## Folders

| Path | Holds |
| --- | --- |
| `src/app/` | App shell: router, startup sequence, update banner |
| `src/screens/` | One file per screen |
| `src/ui/` | Reusable iOS-style components (lists, screen header, tab bar) |
| `src/db/` | Database: `core.ts` (SQL logic, testable in Node), `worker.ts` (owns the connection), `client.ts` (UI-side handle), `protocol.ts` (message types) |
| `src/lib/` | Browser helpers with no UI |
| `public/` | Static files copied as-is: icons, `_headers` for Cloudflare |
| `scripts/` | One-off tools, e.g. icon generation |
| `docs/` | PRD, architecture, setup |

Later phases add `src/engine/` (collections, fields, views, formulas), `src/modules/<name>/` (tasks, habits, workouts, …), `src/vault/` (Markdown notes) and `src/sync/` (OneDrive).

## Decisions

| Decision | Why |
| --- | --- |
| **SQLite WebAssembly with the `opfs-sahpool` storage mode** | Real SQL, JSON functions and FTS5 search on the phone. `opfs-sahpool` works in Safari without the cross-origin isolation headers the plain `opfs` mode needs. Limitation: only one connection at a time, so the app must not be open in two tabs. |
| **All database access in one Web Worker** | Keeps the UI smooth; the worker is the only place with a connection. The UI calls it through `db().call(name, payload)`, typed by `src/db/protocol.ts`. |
| **SQL logic in `core.ts`, separate from the worker** | The same functions run against an in-memory database in Vitest, so the engine is tested without a browser. |
| **Migrations in `MIGRATIONS`, tracked by `PRAGMA user_version`** | Simple and reliable. Shipped migrations are never edited; add a new entry instead. The app refuses a database newer than itself. |
| **Record values as JSON (from Phase 1)** | User-defined fields change at runtime; a JSON column plus indexes on hot fields avoids migrations for every new field. |
| **Service worker in "prompt" mode** | New versions download in the background; the app shows an "Update" banner rather than reloading while the user is typing. Update checks also run when the app returns to the foreground, since iOS rarely checks on its own. |
| **Request persistent storage at startup (Home Screen only)** | WebKit grants it more readily to installed apps; it protects data from automatic clean-up. OneDrive backups remain the safety net. |
| **React + Tailwind with iOS system colours** | Colour tokens in `src/index.css` mirror Apple's system colours in light and dark mode. Components use token names (`bg-card`, `text-label-2`), never raw colours. |
| **TypeScript 7 (native compiler)** | Fast type-checks. If a tool needs the JavaScript TypeScript API, pin `typescript@5` alongside. |
| **Content Security Policy in report-only mode for Phase 0** | Avoids an untested policy blocking WebAssembly on the iPhone. Switch `_headers` to enforcing once Phase 0 checks pass on the device. |

## iPhone constraints to design around

- No background execution: sync runs on open, on return to foreground, and after edits.
- Storage can be evicted: persistent-storage request, frequent OneDrive backups, one-tap restore.
- Links from other apps open in Safari, not in the installed app, and Safari has separate storage.
- No widgets, share-sheet target or direct access to Reminders/Calendar/Health (see PRD).
- Test on the real iPhone after every iOS update; note any workaround here.

## Known workarounds

_None yet._
