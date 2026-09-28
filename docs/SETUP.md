# Setup

One-time steps to host the app and install it on the iPhone. Nothing here needs a Mac or a paid Apple account.

## 1. Cloudflare (hosting)

The app is deployed as a Cloudflare Worker serving static files (set up on 28 Sep 2026).

1. Sign in at [dash.cloudflare.com](https://dash.cloudflare.com) (free account).
2. Go to **Workers & Pages → Create → Import a repository**, connect GitHub and choose `Personal-OS`.
3. Settings:
   - Project name: `personal-os`
   - Build command: `npm run build`
   - Deploy command: `npx wrangler deploy` (reads `wrangler.jsonc`, which serves `dist/`)
4. **Deploy.** The address looks like `https://personal-os.<account>.workers.dev`.

Every push to `main` redeploys automatically. Node.js 22 is picked up from `.node-version`, and `public/_headers` sets the response headers.

Cloudflare Pages also works (build command `npm run build`, output directory `dist`); it ignores `wrangler.jsonc`.

## 2. Install on the iPhone

1. Open the Pages address in **Safari** on the iPhone.
2. Tap **Share → Add to Home Screen → Add**.
3. Open **Personal OS** from the Home Screen, then go to **System check**.
4. Close the app fully (swipe it away in the app switcher) and open it again; check that **Launches recorded** went up.
5. Turn on Airplane Mode and open the app; it should still load.
6. Tap **Copy report** and paste it into the chat with Claude.

## 3. OneDrive (Phase 1)

Needed before backups work. Steps will be added here when Phase 1 reaches backup:
register a single-page app in Microsoft Entra ID for personal Microsoft accounts, with the Pages address as the redirect URI, and put its Application (client) ID in the app's config.

## 4. Google Calendar (Phase 3)

Google Cloud project with the Calendar API, an OAuth client ID for a web app, and your Gmail added as a test user. Steps will be added in Phase 3.

## 5. Reminders bridge (Phase 3)

Two iOS Shortcuts that read and write files in the OneDrive `PersonalOS/Bridge` folder. Download links and steps will be added in Phase 3.
