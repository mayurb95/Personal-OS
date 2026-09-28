# Changelog

## 0.1.0 — Phase 0 (28 Sep 2026)

First installable version. It checks that the iPhone can run Personal OS; there are no features to use yet.

- Installable app with its own Home Screen icon (placeholder) and full-screen window.
- Works offline once it has been opened once.
- SQLite database saved on the device, opened in a background worker.
- **System check** screen: installation, offline readiness, protected storage, space used, database status, launch counter (to prove data survives restarts), a speed test, and a **Copy report** button.
- **Update** banner when a new version is ready.
- Hosting config for Cloudflare Pages, with security headers (content security policy in report-only mode for now).

**Check on the iPhone:** install from Safari, open System check, close and reopen the app (launch count should rise), open it in Airplane Mode, then copy the report into the chat.
