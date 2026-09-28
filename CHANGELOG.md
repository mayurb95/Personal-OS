# Changelog

## 0.2.0 — Phase 1, first pass (28 Sep 2026)

The first version to use every day: tasks, habits and your own collections.

- **Today:** habits grouped by morning, anytime and evening; overdue and due tasks; "Move all to today"; quick add.
- **Tasks:** Today, Upcoming, Inbox, Someday, projects, tags and Completed lists. Quick add understands plain words: "Submit comments Fri 5pm #work p1", "Gym every mon, wed and fri", "Report 12 oct". Repeating tasks create the next one when you tick them off. Task details: date, time, repeat, priority, project, tags, notes.
- **Habits:** yes/no, count, number with unit, time spent, 1–5 score, and "keep under a limit". Daily, chosen days, times per week or every few days. Streaks, best streak, 30-day rate, this-week strip, a 26-week grid you can tap to fill in past days, and rest days that don't break a streak.
- **Collections:** make your own lists with fields (text, number, amount in ₹, date, checkbox, choice, multiple choice, rating, link). List or table view, sort, filter, and a page per item with notes.
- **Search** across everything, and a **Trash** that keeps deleted items for 30 days.
- System check moved to More.

**Check on the iPhone:** add a few tasks with quick add, tick one off, add two habits and check them, make a collection with two fields and an item, search for a word, delete something and restore it from Trash. Close and reopen the app: everything should still be there.

## 0.1.1 (28 Sep 2026)

- Phase 0 checks passed on the iPhone (iOS 18.1.1): installed, offline, protected storage, data kept between launches.
- The version line in System check now shows the build's commit when deployed from Cloudflare Workers.
- Setup notes updated for Cloudflare's Workers deployment.

## 0.1.0 — Phase 0 (28 Sep 2026)

First installable version. It checks that the iPhone can run Personal OS; there are no features to use yet.

- Installable app with its own Home Screen icon (placeholder) and full-screen window.
- Works offline once it has been opened once.
- SQLite database saved on the device, opened in a background worker.
- **System check** screen: installation, offline readiness, protected storage, space used, database status, launch counter (to prove data survives restarts), a speed test, and a **Copy report** button.
- **Update** banner when a new version is ready.
- Hosting config for Cloudflare Pages, with security headers (content security policy in report-only mode for now).

**Check on the iPhone:** install from Safari, open System check, close and reopen the app (launch count should rise), open it in Airplane Mode, then copy the report into the chat.
