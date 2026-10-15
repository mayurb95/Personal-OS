# Changelog

## 0.3.0 — Phase 2: trackers (15 Oct 2026)

- **Backup** (More → Backup): saves everything in one file through the share sheet. Choose Save to Files → OneDrive. Restore replaces everything with a chosen backup after checking the file. Today reminds you when the last backup is over a week old.
- **Workouts** tab: 53 starter exercises (weights, bodyweight, cardio, sport) plus your own. Routines with days of the week appear on Workouts when due. Live logging shows last time's numbers beside every set; tick a set to fill it and start the rest timer (with −15/+15/Skip and a beep). Weights go up automatically when you hit every target rep. Finishing shows time, sets, volume, distance and new records. Exercise pages show records, a progress chart and history. Also weekly charts, sets per muscle, workout history and a body weight log. Units are kg and km.
- **Money** (More → Money): add expenses or income in two taps, in ₹ or any currency (the rate you use is remembered). Categories and payment methods to suit you, monthly budgets per category and overall with warnings at 80% and 100%, a month view with daily and six-month charts and where the money went. Recurring expenses (rent, subscriptions, EMIs) are added automatically when due. Import bank or card statements as CSV: columns, dates and amounts are detected, merchants are cleaned up and categorised from your history, and anything already added is skipped. Export any month or everything as CSV.
- **Journal** (More → Journal): one entry a day with mood, energy and feelings, a daily prompt (editable list), mood chart, writing streak, "on this day" from a month, six months and years ago, and how your mood compares on days you do each habit.
- **Today** now shows a planned or in-progress workout, today's spending with a quick + Expense, and a one-tap mood check-in.
- New **Workouts** tab; Money and Journal are under More.

**Check on the iPhone:** set up a routine and do one workout (tick sets; the rest timer should beep), add a few expenses including one in another currency, set a budget, try importing a statement CSV from your bank, and write a journal entry. Then make a backup.

## 0.2.1 (28 Sep 2026)

Fixes from a test run in a phone-sized browser:

- Long back-button names no longer run into the screen title.
- Enter creates a new collection.
- A new habit's 26-week grid shows its empty weeks instead of a blank box.
- Habit progress reads "2 of 8 glasses".
- Date shortcuts on a task stay on one line; the selected priority shows its own colour.

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
