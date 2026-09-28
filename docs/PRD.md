# Personal OS PWA — PRD

Sep 28, 2026 · Mayur

> Copy of the living PRD, exported on 28 Sep 2026. The PRD doc in Claude is the source of truth; refresh this copy when it changes. Diagrams are written out as text below.

## Overview and vision

Build **Personal OS** as a Progressive Web App (PWA): one private, offline-first web app installed on the iPhone home screen that replaces separate note, knowledge, workout, habit, task, journal, expense and reading apps, and that Mayur can reshape whenever his needs change.

It combines Obsidian's plain-Markdown notes with links and a knowledge graph, Notion's user-defined databases and views, and purpose-built trackers on one data engine. It is built with Claude Code in TypeScript, hosted as static files, and backed up to OneDrive (Google Drive later).

**Why a PWA**

- No Mac, no Xcode and no paid Apple Developer account needed; any laptop can build it.
- Updates ship instantly: push to Git, the host redeploys, the app updates on next launch.
- The same app runs in a laptop browser, which native iOS could not offer.
- Near-zero running cost: free static hosting, and data stays in Mayur's own OneDrive.

**What it costs versus native** — no real home-screen widgets, no direct Apple Calendar or Reminders access, and no background sync. The section "PWA on iPhone" gives the workaround chosen for each.

**Guiding principles**

- **One engine, many modules.** Every module is a collection of records on a shared engine, so new trackers need configuration, not new code.
- **Customisable in the app.** Fields, views, templates, dashboards and whole modules can be changed in settings.
- **Your data, open formats.** Notes are Markdown files; structured data exports to JSON and CSV.
- **Offline-first and fast.** Everything works without a network; capture takes two taps or fewer once the app is open.
- **Private by default.** No analytics, no database server of our own; cloud storage is Mayur's own OneDrive account.

## Goals, non-goals and success criteria

v1 succeeds if Mayur uses it every day for 30 days and has stopped opening the apps it replaces.

**Goals**

1. One place for notes, knowledge, tasks, habits, workouts, journal, money and reading.
2. Add or change a field, view, template or tracker in under 2 minutes, inside the app.
3. A Today screen that shows everything due, planned or worth logging today.
4. Zero data loss: automatic backup to OneDrive on every session, plus full export.
5. Notes readable in Obsidian on a laptop from the OneDrive folder (read-only on the laptop).

**Non-goals for v1**

- Multi-user sharing, collaboration or public publishing.
- A native iOS or App Store app, or a native wrapper (Capacitor); revisit only if the PWA limits hurt in daily use.
- Editing on the laptop: notes are a read-only mirror there, and structured data lives only on the phone.
- Home-screen quick-log widgets, share-sheet capture and push notifications, and the helper service they need (deferred to a later phase).
- Importing data from other apps (Notion, Obsidian, workout or expense apps).
- A custom domain; the free host subdomain is enough.
- Bank or card auto-import for expenses; entry is manual or by bank-statement CSV.
- Apple Health and Apple Watch data (not reachable from a web app).
- Built-in AI features; possible later.

**Success criteria**

| Measure | Target |
| --- | --- |
| Daily use | Opened on 27 or more of 30 days |
| Quick capture | Note, task, expense or habit logged in 2 taps or fewer from the Today screen once the app is open |
| Launch time | Under 1.5 seconds from home-screen icon to Today |
| Search | Results in under 300 ms across 10,000 notes and records |
| New tracker | Built from scratch in the app in under 5 minutes |
| Data safety | Backup no older than the last session; restore tested monthly |

## User and key use cases

The only user is Mayur: a power-sector professional who reads and writes a lot, trains regularly, travels, and wants one system that adapts rather than several rigid apps.

**Daily flows the app must make effortless**

| When | Flow | Modules touched |
| --- | --- | --- |
| Morning | Open Today: calendar events, due tasks, habits to do, planned workout, a journal prompt | Today, Calendar, Tasks, Habits, Workouts, Journal |
| During work | Capture a meeting note, link it to a project and a person with \[\[links\]\] | Notes, Knowledge graph |
| Anytime | Log an expense or tick a habit with the quick-add buttons on the Today screen | Today, Expenses, Habits |
| Gym | Start today's routine, log sets, reps and weight, see last session's numbers, run a rest timer | Workouts |
| Reading | Add a book, save highlights, turn key ideas into flashcards | Reading & learning |
| Evening | Daily review: mood, journal entry, habit check-offs, tomorrow's top 3 tasks | Journal, Habits, Tasks |
| Weekly | Review spending vs budget, workout volume, habit streaks and open tasks on dashboards | Dashboards |
| On a laptop | Read the notes folder in Obsidian from OneDrive (read-only) | Sync |

**Example customisations he should be able to make without code**

- Add a "Sleep hours" number field to the daily tracker and chart it.
- Create a new "Regulatory filings" collection with fields for regulator, order date and status, plus a board view.
- Change the workout log to track RPE or tempo.
- Rearrange the Today screen and hide modules he isn't using.

## Core concept: one engine, many modules

Every module is a **collection** of **records** with a user-editable schema, shown through **views** and composed into **dashboards**. Built-in modules are pre-configured collections with a few specialised screens on top; custom modules use the same parts.

| Building block | What it is | Example |
| --- | --- | --- |
| Collection | A typed list of records with its own fields, like a Notion database | Workouts, Expenses, Books, Regulatory filings |
| Record | One entry; every record can also have a Markdown page body | A single expense; a book with notes |
| Field | A typed property on a collection | Amount (currency), Mood (rating 1–5), Status (select) |
| Note | A Markdown file in the vault, linkable with \[\[wiki-links\]\] | Meeting note, idea, person page |
| View | A saved way to see a collection: layout + filter + sort + group | "This month by category" as a chart |
| Template | Pre-filled record or note, with variables like {{date}} | Daily note, Push day routine |
| Dashboard | A screen of widgets pulling from any collections | Today, Weekly review, Fitness |
| Module | A packaged collection + views + templates + dashboard + optional custom screens | Workouts, Expenses, or one Mayur builds |

**Field types (v1):** text, long text, number, currency (INR default), date, date-time, duration, checkbox, select, multi-select, rating, relation (link to records in any collection), link to note, URL, photo/file, formula, and rollup (sum, count or average across relations).

**How the parts connect**

- Any record can link to any note or record; links are two-way and show as backlinks.
- Records and notes share tags, so a tag like #tariff pulls up notes, tasks and books together.
- Every day has a **daily note**, which acts as the hub where that day's journal, habits, workouts and expenses appear automatically.
- Every screen and every record has its own URL (for example /log/expense or /habit/meditate/done), so in-app links, dashboards and (later) push notifications can open an exact screen.

## Notes and knowledge graph (Obsidian-style)

Notes are plain Markdown files that Obsidian on a laptop can open unchanged; the app adds links, backlinks and a graph on top. The editor uses CodeMirror 6, the same editor engine Obsidian uses.

**Must have (v1)**

- [ ] Markdown editor with live preview: headings, bold/italic, lists, checklists, quotes, code, tables, images.
- [ ] Formatting toolbar that sits above the iPhone keyboard, plus slash commands (/table, /task, /template).
- [ ] &#91;\[Wiki-links\]\] with autocomplete; links to headings (\[\[Note#Heading\]\]); link to a note that doesn't exist yet creates it.
- [ ] Backlinks panel: linked mentions and unlinked mentions of the current note.
- [ ] Tags (#tag, nested #work/tariff) and YAML front matter properties, read and written in Obsidian's format.
- [ ] Folders, pinned notes, recent notes, favourites.
- [ ] Daily notes from a template, with previous/next day navigation.
- [ ] Full-text search across notes and records with filters (tag, folder, date, type).
- [ ] Quick capture to an Inbox note from the Today screen; capture from other apps' share sheet comes in a later phase.

**Knowledge graph**

- [ ] Global graph: every note and linked record as a node, links as edges; colour by tag or folder; filter by tag, folder or date.
- [ ] Local graph: the current note plus 1–3 hops of neighbours.
- [ ] Pinch to zoom, drag nodes, tap to open; smooth at 2,000 nodes (WebGL rendering, layout in a Web Worker).
- [ ] Orphan list: notes with no links in or out.

**Later**

- Block references and embeds (\!\[\[Note\]\]), canvas/whiteboard view, note version history, PDF annotation.

**Obsidian compatibility rules**

- File names are note titles; links use \[\[Title\]\] syntax; attachments sit in an /attachments folder.
- App-only data (graph layout, view settings) lives in a hidden .personalos folder so it never clutters the vault.
- The laptop is read-only: the vault in OneDrive is a one-way mirror of the phone, so any edit made in Obsidian is overwritten on the next sync. Open it in Obsidian's reading view.

## Databases and views (Notion-style)

Mayur can create any collection, define its fields, and save several views of it, all on the phone.

**Views**

| View | Best for | Must support |
| --- | --- | --- |
| List | Quick scanning on a phone | Title + up to 3 chosen fields, swipe actions |
| Table | Editing many fields | Horizontal scroll, frozen first column, inline edit |
| Board | Status workflows | Group by any select field, drag between columns |
| Calendar | Dated records | Month and week, drag to reschedule |
| Gallery | Books, visual items | Cover image, card fields |
| Chart | Trends and totals | Line, bar, pie, heatmap; sum, count or average by period or field |
| Timeline | Projects and plans | Start and end dates as bars |

**Requirements**

- [ ] Filters with AND/OR groups, relative dates (today, this week, last 30 days) and "is empty".
- [ ] Sort on multiple fields; group by select, date (day/week/month) or relation.
- [ ] Each view is saved, has its own URL, and can be pinned to a dashboard.
- [ ] Relations between collections, two-way (a Book links to Notes; a Task links to a Project).
- [ ] Rollups: count, sum, average, min, max, percent checked over related records.
- [ ] Formulas: arithmetic, dates (days between, week number), text, if/then, and references to other fields.
- [ ] Record page: fields at top, Markdown body below, backlinks at the bottom.
- [ ] Bulk edit, duplicate, archive; undo for the last 20 actions.
- [ ] Export any view to CSV; CSV import (including Notion exports) comes later.

## Workouts

Plan programmes, log sessions set by set, and see progress over time, fast enough to use between sets.

**Data model:** Exercise library → Routines (ordered exercises with target sets, reps, weight or time) → Programmes (routines scheduled by day of week or week number) → Sessions (what was actually done) → Sets.

**Must have (v1)**

- [ ] Exercise library: preloaded common lifts and bodyweight moves; add custom exercises with muscle group, equipment and type (weight × reps, reps only, time, distance).
- [ ] Routine builder: supersets, target sets/reps/weight, rest time per exercise, notes.
- [ ] Programme scheduler: e.g. Push / Pull / Legs across the week; today's session shows on the Today screen.
- [ ] Live session logging: previous session's numbers shown beside each set; one tap to copy them; big tap targets.
- [ ] Session mode keeps the screen awake (Screen Wake Lock API) so the phone doesn't lock mid-workout.
- [ ] Rest timer that starts on set completion, with an on-screen countdown and a sound when done. The timer is based on timestamps, so it stays correct if the app is backgrounded.
- [ ] Session summary: duration, total volume, sets, PRs hit.
- [ ] Personal records per exercise: best weight, estimated 1RM (Epley formula), best volume.
- [ ] Progress charts: weight or estimated 1RM per exercise over time; weekly volume per muscle group.
- [ ] Cardio and sport sessions with duration, distance and a free-text note.
- [ ] Body metrics collection: weight, measurements, progress photos (private).
- [ ] Units setting: kg or lb.

**Customisable**

- Add fields to sets (RPE, tempo, band colour) or sessions (energy level, location).
- Progression rules per routine, e.g. "add 2.5 kg when all sets hit target reps"; the next session suggests the new weight.

**Web limits to know:** iPhone web apps can't vibrate, so there is no haptic feedback; lock-screen rest-timer alerts need push, which is deferred, so v1 relies on the awake screen and a sound.

**Later**

- Plate calculator, deload suggestions, travel-friendly hotel-gym routines.

## Daily tracker and habits

Track anything daily, from a yes/no habit to a measured number, and see streaks and trends.

**Tracker types**

| Type | Input | Example |
| --- | --- | --- |
| Yes / no | Tap to check | Meditated, No sugar |
| Count | +1 taps toward a target | 8 glasses of water |
| Measure | Number with unit | Sleep 7.5 h, Weight 72 kg, Steps |
| Duration | Timer or entry | Reading 30 min, Deep work 3 h |
| Scale | 1–5 or 1–10 | Energy, Focus |
| Negative habit | Log when it happens; goal is fewer | Late-night phone use |

**Must have (v1)**

- [ ] Schedules: daily, specific weekdays, X times per week, or every N days.
- [ ] Streaks and completion rate; skip or rest days that don't break a streak (useful when travelling).
- [ ] Year heatmap (GitHub-style) and weekly grid per habit.
- [ ] Reminders: each habit can create a repeating Apple Reminder through the Reminders bridge, so iOS delivers the alert; web push comes later.
- [ ] Check off from the Today screen in one tap; home-screen quick-log widgets come in a later phase.
- [ ] App icon badge showing habits still to do today (Badging API; needs notification permission and updates while the app is open).
- [ ] Habits grouped by time of day (Morning, Anytime, Evening) on the Today screen.
- [ ] Evening review screen: unchecked habits, mood, journal prompt and tomorrow's top 3 tasks in one flow.
- [ ] Archive a habit without losing its history.

**Customisable:** new tracker types are just collections with a date field, so any field type can be tracked and charted.

## Tasks, journal, expenses, reading

Four further built-in modules, each a pre-configured collection with a few dedicated screens.

### Tasks and to-dos

- [ ] Inbox, Today, Upcoming, Projects and Someday lists.
- [ ] Fields: due date, time, priority (P1–P4), project, tags, subtasks, notes, linked notes.
- [ ] Recurring tasks: daily, weekly on chosen days, monthly on a date, "N days after completion".
- [ ] Natural-language entry: "Submit tariff comments Fri 5pm #work p1".
- [ ] Tasks created inside any note with - \[ \] are indexed and appear in Tasks.
- [ ] Due-time alerts come from Apple Reminders: tasks with a due time are mirrored there by the bridge.
- [ ] Sync with Reminders through the bridge described under Integrations.

### Journal and mood

- [ ] One entry per day inside the daily note, or multiple timestamped entries.
- [ ] Mood on a 1–5 scale plus optional emotion tags and energy level.
- [ ] Rotating prompts (editable list), e.g. "What went well?", "What will I do differently?".
- [ ] Photos and location (city, with permission) on entries — handy for travel logs.
- [ ] "On this day" view showing entries from past months and years.
- [ ] Mood chart and mood vs habit correlation (e.g. mood on workout days vs rest days).
- [ ] Separate lock for the journal using a passkey (Face ID).

### Expenses and budget

- [ ] Quick add: amount, category, payment method, note; defaults to INR with multi-currency support for travel (manual or cached exchange rate).
- [ ] Categories and sub-categories, editable; payment methods as a list (cards, UPI, cash).
- [ ] Monthly budgets per category with progress bars and an alert at 80% and 100%.
- [ ] Recurring expenses and subscriptions with renewal reminders.
- [ ] Reports: spend by category (pie), month-on-month trend (bar), top merchants.
- [ ] Income entries optional; CSV import from bank statements with column mapping; CSV export.

### Reading and learning

- [ ] Library of books, articles, courses and papers with status (Want, Reading, Done, Dropped), progress, rating and dates.
- [ ] Add books by ISBN barcode scan with the camera (JavaScript barcode library, since Safari has no built-in barcode detector) or by title search (Open Library API).
- [ ] Highlights and notes per item; each book gets a Markdown note in the vault that links to related notes.
- [ ] Flashcards from any note or highlight (question::answer syntax or a create-card button).
- [ ] Spaced repetition review using the FSRS or SM-2 algorithm; daily review count on Today.
- [ ] Yearly reading goal and pages or minutes read per day.

## Customisation system

Customisation happens at three levels, so most changes need no code and the rest are small code changes that go live on the next app launch.

| Level | Who does it | Examples | Where |
| --- | --- | --- | --- |
| 1. Configure | Mayur, in the app, in seconds | Add a field, change a view, reorder Today, change theme or accent colour, hide a module | Settings and long-press menus |
| 2. Build | Mayur, in the app, in minutes | New collection, template, dashboard, tracker, or a whole custom module | Module builder |
| 3. Extend | Mayur with Claude Code, in hours | A new field type, a new view type, a new integration, custom screens | Git repo → push → auto-deploy; phone updates on next launch |

**Module builder (level 2)**

- [ ] Start from blank or from a module template (Tracker, List, Journal-style, Log with charts).
- [ ] Define fields, default view, entry form layout, icon and colour.
- [ ] Pick which views appear and which widgets it offers to dashboards.
- [ ] Add the module to the bottom tab bar, the "More" menu or a dashboard.
- [ ] Duplicate or export a module as a JSON file, and import it back.

**Dashboards**

- [ ] Grid of widgets: view embed, single number (e.g. "Spent this month"), chart, habit row, today's tasks, calendar agenda, quick-add buttons, note embed, random flashcard, quote of the day from highlights.
- [ ] Several dashboards (Today, Weekly review, Fitness, Money); any can be the start screen.
- [ ] Drag to rearrange and resize widgets (small, medium, full width).

**Templates and automations**

- [ ] Templates for notes and records with variables: {{date}}, {{time}}, {{weekday}}, {{cursor}}.
- [ ] Simple rules (when → then), run when the app is open: when a workout session is saved, tick the "Workout" habit; when a book is marked Done, create a note from the Book review template; on first launch each month, create the monthly review note.

**Appearance**

- [ ] Light, dark and system themes; accent colour; font size; compact or comfortable density.
- [ ] Custom tab bar (up to 5 tabs); v1 uses the working name Personal OS and a placeholder icon, both set in the web app manifest and easy to change.

## PWA on iPhone: what works and the workarounds

As of iOS 26–27, an installed web app gets offline storage, push notifications, badges and a full-screen app window, but no widgets, no background sync and no access to Apple's Calendar, Reminders or Health data. Every requirement in this PRD is designed around that line.

| Capability | Status on iPhone | Plan |
| --- | --- | --- |
| Install to home screen | Works; since iOS 26 sites added to the Home Screen open as a web app by default | Share → Add to Home Screen once; the app has its own icon and app-switcher card |
| Offline use | Works via service worker and local storage | App shell cached; all data stored on the device |
| Storage size | Up to 60% of disk per site in Safari 17+ ([WebKit](https://webkit.org/blog/14403/updates-to-storage-policy/)) | Plenty for notes and records; photos compressed |
| Protection from eviction | Data is best-effort; can be deleted under storage pressure unless persistent mode is granted, which WebKit grants more readily to home-screen apps | Request persistent storage on first launch; back up to OneDrive every session; warn if not granted |
| Push notifications | Works for home-screen apps since iOS 16.4; Declarative Web Push since Safari 18.4 | Deferred to a later phase (needs a small push-sending service) |
| Icon badge | Works (Badging API) | Count of habits and tasks still due today |
| Keep screen awake | Works (Screen Wake Lock, Safari 18.4) | Used during workouts and reading |
| Camera | Works with permission | Barcode scan, progress photos, journal photos |
| Face ID | Works through passkeys (WebAuthn) | App lock and journal lock |
| Background sync / periodic sync | Not supported | Sync on open, on return to foreground and after edits |
| Home-screen widgets | Not supported for web apps | Deferred; quick-add buttons on the Today screen in v1 |
| Share sheet target | Not supported | Deferred; later via a share-sheet shortcut |
| Apple Calendar, Reminders, Health | No web access | Google Calendar via its API; Reminders via a Shortcuts bridge through OneDrive files; Health out of scope |
| File System Access (open a folder) | Not supported | Vault stored in the browser's private file system (OPFS), mirrored to OneDrive by API |
| Vibration / haptics | Not supported | Sounds and visual cues instead |

Sources: [WebKit storage policy](https://webkit.org/blog/14403/updates-to-storage-policy/), [MobiLoud iOS PWA guide 2026](https://www.mobiloud.com/blog/progressive-web-apps-ios/), [MagicBell iOS PWA limitations 2026](https://www.magicbell.com/blog/pwa-ios-limitations-safari-support-complete-guide), [WebKit features in Safari 27.0](https://webkit.org/blog/18325/webkit-features-for-safari-27-0/).

## Integrations: Google Calendar and Apple Reminders

v1 reads Google Calendar directly and syncs with Apple Reminders through an iOS Shortcuts bridge that swaps files in the OneDrive folder the app already uses, so no server is needed. Widgets, share-sheet capture and push notifications wait for a later phase.

**Google Calendar**

- [ ] Read events from the main and work Google calendars (changeable in settings) with the Google Calendar API (read-only scope), signing in with Google Identity Services inside the app.
- [ ] Show events on Today and in the daily note; create a meeting note from an event.
- [ ] Cache the next 30 days of events so Today works offline.
- [ ] Browser sign-in gives one-hour tokens and no long-lived refresh token, so the app refreshes silently on open and occasionally asks for a one-tap re-consent.
- [ ] Keep the Google Cloud project in Testing with Mayur as the only test user; publishing it with a calendar scope would need Google's app verification.

**Apple Reminders bridge (through OneDrive files)**

A web app can't read Reminders, but iOS Shortcuts can, and Shortcuts can read and write files in the OneDrive folder through the Files app.

| Direction | How it works |
| --- | --- |
| Reminders → app | A Shortcuts personal automation (e.g. hourly, and when the app is closed) writes new and completed reminders from the Work and Personal lists to /PersonalOS/Bridge/from-reminders.json; the app imports them on its next sync |
| App → Reminders | On every sync the app writes /PersonalOS/Bridge/to-reminders.json with new tasks, due-time changes, completions and habit reminders; the automation applies them in Reminders and clears the file |

- [ ] The app's Tasks module is the source of truth; each task stores its reminder's ID to prevent duplicates.
- [ ] Tasks and habits with a due time become Apple Reminders, so iOS delivers their alerts while push is deferred.
- [ ] The app provides both shortcuts as download links with setup steps.
- [ ] Spike in Phase 0: confirm Shortcuts can read and write the OneDrive folder reliably (it may need to be kept downloaded in the Files app). Fallback: run the shortcut by hand from Siri or the Shortcuts app.
- [ ] Only the Work and Personal lists sync; other Reminders lists (groceries, shared lists) are left untouched. New tasks from the app go to Personal, or to Work when tagged #work or in a work project.

**Deferred to a later phase**

- A small serverless helper for web push, a quick-log inbox and Google Drive support.
- Home-screen quick-log widgets and share-sheet capture through Shortcuts; the OneDrive file bridge may carry these without a server, to be tested after v1.
- Push notifications for habit check-ins, rest timer and budget alerts.

## Data storage, sync and backup

The iPhone holds the only editable copy, in the web app's private storage; OneDrive holds a one-way mirror of the notes vault for reading in Obsidian, plus versioned backups of everything else. Because iOS can clear a web app's storage, the OneDrive copy is the safety net, not an extra. Google Drive support comes later.

**What lives where**

| Data | On the iPhone (web app storage) | In OneDrive | Direction |
| --- | --- | --- | --- |
| Notes, daily notes, book notes | Markdown files in the Origin Private File System (OPFS) | /PersonalOS/Vault/ (read in Obsidian on the laptop) | Phone → cloud |
| Attachments (images, PDFs) | OPFS /Vault/attachments/ | Same path | Phone → cloud |
| Collections and records | SQLite database (WebAssembly) stored in OPFS | /PersonalOS/Backups/ as a dated snapshot, last 30 kept | Phone → cloud |
| Readable exports | Generated on backup | /PersonalOS/Exports/ as one CSV and JSON per collection | Phone → cloud |
| Settings, modules, dashboards | JSON in OPFS | /PersonalOS/Config/ | Phone → cloud |
| Reminders bridge files | Written and read on sync | /PersonalOS/Bridge/ | Both ways, with Shortcuts |

**How sync connects to the cloud**

- Microsoft Graph (OneDrive) called directly from the app, behind a CloudProvider interface so Google Drive can be added later.
- Sign-in with MSAL.js as a single-page app using PKCE; a free app registration in Microsoft Entra ID for personal Microsoft accounts. No server needed.
- The app works in an app folder (/PersonalOS/) and asks only for the file permissions it needs.
- Tokens kept in app storage, encrypted with a key tied to the passkey.

**Sync behaviour**

- [ ] Runs on app open, on return to the foreground, after edits (debounced 30 seconds) and on a "Sync now" button. iOS gives web apps no background sync, so nothing syncs while the app is closed.
- [ ] Ask for persistent storage (navigator.storage.persist) on first launch and show the result in settings.
- [ ] Show a warning banner if the last successful backup is older than 24 hours.
- [ ] Change detection by content hash; only changed files upload.
- [ ] One-way mirror: the phone always wins, so there are no note conflicts. If a vault file in OneDrive was changed on the laptop, it is overwritten and the laptop version is saved to /PersonalOS/Overwritten/ for 30 days.
- [ ] Deletions go to a 30-day trash, locally and in OneDrive.
- [ ] Restore wizard: pick a snapshot date, preview counts, restore everything or one collection. Also used on a new phone or after iOS clears storage.
- [ ] Optional encryption of backups and the journal with a passphrase (Web Crypto AES-GCM); an encrypted journal is not readable in Obsidian.

**Later:** Google Drive as a second provider; two-way sync so notes and data can be edited on a laptop.

## Technical architecture and data model

A TypeScript single-page app, installed from Safari, runs its data engine in a Web Worker over a WebAssembly SQLite database and a Markdown vault, both in the browser's private file system; outside, OneDrive holds the mirror, backups and Reminders bridge files, and Google Calendar supplies events.

```
Installed web app on the iPhone
  UI (React + TypeScript): Today, Notes, Collections, Graph, Settings
  Service worker: offline app shell, icon badge
        │ messages to the worker
Engine (runs in a Web Worker)
  Collections and views · Markdown and links · Sync and rules
        │ reads and writes
Local storage (Origin Private File System)
  SQLite (WebAssembly): records, indexes, FTS5 · Vault folder: Markdown notes and attachments
        │ sync and calendar refresh while the app is open
Outside the app
  OneDrive: vault mirror, backups, bridge · Google Calendar: events, read-only · iOS Shortcuts: Reminders bridge via OneDrive
```

iOS Shortcuts exchange Reminders with the app through bridge files in OneDrive; the app code itself is static files on a free host subdomain, and v1 runs no server of its own.

**Technology choices**

| Area | Choice | Reason |
| --- | --- | --- |
| Language and UI | TypeScript, React, Vite, Tailwind with iOS-style components (e.g. Konsta UI) | Largest ecosystem; Claude Code is fluent in it; feels native on iPhone |
| PWA shell | vite-plugin-pwa (Workbox) for service worker and manifest | Offline caching, update prompts, icons and splash screens |
| Routing | A URL for every screen and record | Push notifications and bookmarks open the exact screen |
| Structured storage | Official SQLite WebAssembly build in a Web Worker, stored in OPFS | Same SQL + JSON-column design as native; FTS5 search; UI stays smooth |
| Record values | One JSON column per record, with indexes on frequently filtered fields | New fields need no migration |
| Markdown | CodeMirror 6 editor; markdown-it or remark parser | The engine Obsidian uses; fast on long notes |
| Graph view | Sigma.js (WebGL) with graphology force layout in a worker | Smooth at 2,000 nodes on a phone |
| Charts | Apache ECharts | Rich chart types, themeable, touch-friendly |
| Cloud | fetch + Microsoft Graph with MSAL.js (OneDrive); Google Identity Services + Calendar API | No heavy SDKs |
| Security | WebAuthn passkeys (Face ID) for app and journal lock; Web Crypto AES-GCM | Native-feeling lock without a server |
| Barcode | ZXing-js with the camera | Safari has no built-in barcode detector |
| Hosting | Cloudflare Pages (or GitHub Pages / Vercel) on its free subdomain, auto-deploy from GitHub, HTTPS | Free; every push goes live in about a minute |
| Helper service | Deferred: a Cloudflare Worker for push and a quick-log inbox | v1 needs no server |
| Tests | Vitest for the engine; Playwright running WebKit for key flows | WebKit tests catch Safari-specific bugs before they reach the phone |

**Core tables**

| Table | Holds |
| --- | --- |
| collections | Name, icon, colour, module type, settings |
| fields | Collection, name, type, options (select values, formula text), order |
| records | Collection, title, values (JSON), optional body file, created, updated, deleted |
| notes\_index | Vault path, title, tags, front matter, content hash, updated |
| links | Source, target, kind (wiki-link, relation, tag) — powers backlinks and the graph |
| views | Collection, layout, filter, sort, group, visible fields |
| dashboards | Name, widget layout (JSON) |
| templates and rules | Template content; trigger + action definitions |
| bridge\_log | Task-to-reminder ID map and bridge files already processed |
| sync\_state | Path or record, local hash, remote ID, remote version, last synced |
| search\_fts | FTS5 index over notes and record text |

## Non-functional requirements

The app must feel close to native on an iPhone and never lose a word, even offline or if iOS clears its storage.

| Area | Requirement |
| --- | --- |
| Performance | Home-screen icon to Today in under 1.5 s; any screen under 300 ms; typing latency under 16 ms in a 20,000-word note; initial JavaScript bundle under 300 KB compressed, the rest loaded per module |
| Native feel | Standalone display, safe-area insets, iOS-style navigation and gestures, no page zoom or rubber-band glitches, 60 fps scrolling |
| Scale | Comfortable with 10,000 notes, 100,000 records and 2 GB of attachments |
| Offline | Every feature except OneDrive sync, the Reminders bridge and calendar refresh works with no network |
| Reliability | Autosave every edit within 1 s; database writes in transactions; OneDrive backup every session so an iOS storage wipe loses at most that session |
| Updates | New versions download in the background and apply on next launch, with a "What's new" note; a broken release can be rolled back from the host in one click |
| Privacy | No analytics or tracking scripts; data leaves the phone only to Mayur's OneDrive, and Google Calendar is read only |
| Security | Passkey (Face ID) lock for the app and separately for the journal; tokens encrypted at rest; strict Content Security Policy |
| Accessibility | Dynamic Type-friendly sizes, VoiceOver labels, 44 pt minimum tap targets, sufficient contrast in both themes |
| Portability | Full export (Markdown + CSV + JSON) in one tap; import back into a fresh install; the app also runs in any modern laptop browser |
| Maintainability | Engine covered by unit tests; each module a separate folder; CHANGELOG and ARCHITECTURE.md kept in the repo for Claude Code |
| Localisation | English UI; INR, Indian number grouping (1,00,000) and DD/MM/YYYY by default, changeable |

## Roadmap and build plan

Ship a small MVP with automatic OneDrive backup within about 6 weeks, then add modules in phases, each ending in a gate Mayur must pass before moving on. Backup moves into Phase 1 because iOS can clear a web app's storage.

| Phase | Duration | Scope | Gate to pass |
| --- | --- | --- | --- |
| 0 · Setup | 2–4 days | GitHub repo, Cloudflare Pages auto-deploy, blank PWA on the iPhone; spikes: SQLite on OPFS in Safari, Shortcuts reading/writing OneDrive files | Blank app installed and works offline |
| 1 · Foundation (MVP) | 4–6 weeks | Engine: collections, fields, list and table views, search; notes with wiki-links, backlinks, daily notes; tasks, habits, Today, passkey lock, automatic OneDrive backup | Used daily for 2 weeks and a restore tested |
| 2 · Trackers | 4–5 weeks | Workouts with rest timer and PRs; journal and mood; expenses and budgets; chart view, templates, dashboards with quick-add | Old habit, workout and expense apps retired |
| 3 · Connect | 4–5 weeks | Vault mirror for Obsidian; Google Calendar; Reminders bridge; reading library and flashcards; knowledge graph | Vault reads in Obsidian and Reminders round-trip |
| 4 · Customise | ongoing | Module builder; board, calendar, gallery, timeline views; formulas, rollups; dashboard editor, rules; later: helper for widgets and push, Google Drive, AI | — |

Phases 0–3 add up to roughly 4 months part-time; Phase 4 continues as long as the app is in use.

**What you need before starting**

- Any laptop (Windows, Mac or Linux) with Node.js, Git and Claude Code. No Mac or Apple Developer account is required.
- Free accounts: GitHub, Cloudflare Pages, a Microsoft Entra app registration (OneDrive) and a Google Cloud project with the Calendar API enabled.
- No custom domain: the app lives on the host's free subdomain (for example personal-os.pages.dev).
- Working name Personal OS and a placeholder icon until you pick your own.

**How to build it with Claude Code**

1. Put this PRD, an ARCHITECTURE.md and a CLAUDE.md (conventions, commands to build, test and deploy) in the repo so every session starts with context.
2. Develop in a laptop browser with an iPhone-sized view, and test on the real iPhone early and often: Safari quirks only show on the device.
3. If the laptop is a Mac, Safari 27's built-in MCP server lets Claude Code inspect the running app's page, console and network directly ([WebKit](https://webkit.org/blog/18325/webkit-features-for-safari-27-0/)).
4. Write engine unit tests (filters, formulas, link parsing, sync conflicts) and WebKit Playwright tests before UI polish; these protect your data as the code grows.
5. Work one feature per branch; merging to main auto-deploys, and the phone picks up the update on next launch.
6. Tag each phase and keep a CHANGELOG so a broken release can be rolled back from the host.

## Risks, open questions and decisions

The two biggest risks are scope and iOS clearing the web app's storage; the phase gates handle the first, and backup in the MVP handles the second.

**Risks**

| Risk | Impact | Mitigation |
| --- | --- | --- |
| iOS evicts the web app's data under storage pressure | High | Request persistent storage; OneDrive backup every session; stale-backup warning; one-tap restore |
| Scope creep delays a usable app | High | Phase 1 is the MVP; later phases wait for their gate |
| Shortcuts can't reliably read or write OneDrive files | Medium | Spike in Phase 0; keep the Bridge folder downloaded; fallback is running the shortcut by hand |
| Reminders bridge creates duplicates or misses changes | Medium | Reminder IDs stored per task; processed files logged; Tasks stays the source of truth |
| Google Calendar sign-in asks to re-consent now and then | Low | Events cached for 30 days; one-tap re-consent; a later helper can hold a refresh token |
| Laptop edits in Obsidian get overwritten | Low | Laptop is read-only by design; overwritten versions kept for 30 days |
| A Safari update changes PWA behaviour | Medium | WebKit Playwright tests; test on the iPhone after each iOS update; known workarounds in ARCHITECTURE.md |
| SQLite on OPFS misbehaves in Safari | Medium | Spike in Phase 0; fall back to an IndexedDB-backed SQLite storage layer |
| No push means missed habit check-ins | Low | Due alerts come from Apple Reminders via the bridge; badge count on the app icon |

**Decisions made**

- A Progressive Web App built with Claude Code, installed from Safari to the iPhone home screen, hosted on a free subdomain.
- Working name Personal OS with a placeholder icon; no custom domain.
- iPhone is the only editable copy; OneDrive first, with a one-way vault mirror (laptop read-only in Obsidian) and versioned backups. Google Drive later.
- Calendar: Google Calendar through its API, read-only, showing the main and work calendars on Today.
- Reminders: Apple Reminders through a Shortcuts bridge using OneDrive files, syncing only the Work and Personal lists.
- No helper service in v1: home-screen widgets, share-sheet capture and push notifications are deferred.
- No data import from other apps for now.
- v1 modules: notes and knowledge graph, databases, workouts, daily tracker, tasks, journal and mood, expenses, reading and learning.

**Open questions**

- [ ] Final app name and icon (placeholders are fine until Phase 2).
