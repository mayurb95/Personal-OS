# Architecture

How Personal OS is built, and why. Read this before changing structure. The product requirements are in [PRD.md](PRD.md).

## Shape of the app

```
Installed web app (Safari, Home Screen)
  React UI  ──messages──►  Database Web Worker  ──►  SQLite (WebAssembly) in OPFS
  Service worker: caches the app shell for offline use
Outside (later phases): OneDrive (backups, vault mirror, Reminders bridge files), Google Calendar
```

- **No server.** The app is static files served by Cloudflare (Workers static assets, `wrangler.jsonc`). Nothing about the user's data is sent anywhere except their OneDrive and (read-only) Google Calendar.
- **The iPhone holds the only editable copy.** OneDrive gets one-way backups and a read-only vault mirror (Phase 1 and 3).

## Folders

| Path | Holds |
| --- | --- |
| `src/app/` | App shell: router, startup sequence, update banner |
| `src/screens/` | One file per screen |
| `src/ui/` | Reusable iOS-style components (lists, screen header, tab bar) |
| `src/db/` | Database plumbing: `core.ts` (migrations, launch counter), `worker.ts` (owns the connection), `client.ts` (UI-side handle and change notifications), `protocol.ts` (message types), `mutations.ts` (calls that change data) |
| `src/engine/` | The engine, plain functions over a `Database`: `collections.ts`, `records.ts` (CRUD, trash, search), `tasks.ts`, `quickadd.ts`, `recurrence.ts`, `habits.ts`, `today.ts`, `dates.ts`; `api.ts` lists every call the UI can make |
| `src/app/data.ts` | `useDbQuery` (auto-refreshing reads), `act` (writes with error toasts), `useToday` |
| `src/screens/<area>/` | Screens by area: `tasks/`, `habits/`, `collections/` |
| `src/lib/` | Browser helpers with no UI |
| `public/` | Static files copied as-is: icons, `_headers` for Cloudflare |
| `scripts/` | One-off tools, e.g. icon generation |
| `docs/` | PRD, architecture, setup |

Later phases add `src/vault/` (Markdown notes), `src/sync/` (OneDrive) and more modules under `src/engine/` and `src/screens/`.

## Data model

| Table | Holds |
| --- | --- |
| `collections` | Built-in (`tasks`, `habits`) and user collections; `settings` JSON keeps the default view (layout, sort) |
| `fields` | Each collection's fields: key, type, options (choices, rating max), order; built-in fields can't be removed |
| `records` | Every item: `title`, `data` (JSON keyed by field key), `body` (notes), timestamps, `deleted_at` for the trash |
| `records_fts` | FTS5 index over title and body, kept in sync by triggers |
| `habit_logs` | One row per habit per day: value, skipped (rest day) |
| `app_meta` | Key/value facts such as the launch counter |

Tasks and habits are records in their built-in collections, so later features (custom fields, views, search) work on them too. Habit check-ins live in their own table because streaks read hundreds of days at once.

## Decisions

| Decision | Why |
| --- | --- |
| **SQLite WebAssembly with the `opfs-sahpool` storage mode** | Real SQL, JSON functions and FTS5 search on the phone. `opfs-sahpool` works in Safari without the cross-origin isolation headers the plain `opfs` mode needs. Limitation: only one connection at a time, so the app must not be open in two tabs. |
| **All database access in one Web Worker** | Keeps the UI smooth; the worker is the only place with a connection. The UI calls it through `db().call(name, payload)`, typed by `src/db/protocol.ts`. |
| **SQL logic in `core.ts`, separate from the worker** | The same functions run against an in-memory database in Vitest, so the engine is tested without a browser. |
| **Migrations in `MIGRATIONS`, tracked by `PRAGMA user_version`** | Simple and reliable. Shipped migrations are never edited; add a new entry instead. The app refuses a database newer than itself. |
| **Every UI read is `useDbQuery`, every write is `act`** | After any write listed in `src/db/mutations.ts`, all open queries re-run, so screens never show stale data. A test checks that write-like calls are listed. |
| **Dates as local `YYYY-MM-DD` strings** | Due dates, habit days and "today" are calendar days in the phone's time zone; arithmetic in `src/engine/dates.ts` never shifts a day. Timestamps (created, completed) stay in UTC ISO. |
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

## Device results

| Date | Device | Result |
| --- | --- | --- |
| 28 Sep 2026 | iPhone, iOS 18.1.1 | Installed, offline ready, protected storage granted, SQLite in OPFS opened in 49 ms, data survived restarts; 1,000-record write 48 ms, summary 12 ms, search 1 ms |

## Known workarounds

- iOS 18.1 lacks Screen Wake Lock (Safari 18.4+). Feature-detect it; on older versions the workout screen may dim.
