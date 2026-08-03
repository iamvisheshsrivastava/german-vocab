# Deploying German Vocab to the Google Play Store

This is the full path from where the app is now to a live Play Store listing. Steps are split into **things already done / I can do for you**, and **things only you can do** (account creation, payment, and final submission — these involve your identity, money, or a Google login I can't perform for you).

## Status

- [x] App identity finalized: package name changed from the auto-generated `com.emergent.offlinedeutsch.nvr157` to `com.visheshsrivastava.germanvocab` ([frontend/app.json](frontend/app.json)). **This can never change after your first publish**, so double check it's what you want before building.
- [x] `frontend/eas.json` created with a `production` build profile (Android App Bundle, auto-incrementing build number).
- [x] Store assets prepared in `frontend/store-assets/`:
  - `play-store-icon-512.png` — 512×512 app icon
  - `feature-graphic-1024x500.png` — the banner Play shows at the top of your listing
  - `store-listing.md` — ready-to-paste app name, short/full description, category, content-rating and data-safety answers
  - `screenshots/` — phone screenshots of the app (see below)
- [x] `PRIVACY_POLICY.md` drafted at the repo root — Play requires a **public URL** to a privacy policy, even for an app that collects nothing.

## What you need to do

### 1. Create your Google Play Developer account
I can't do this step — it requires your own Google identity and a payment method.
1. Go to https://play.google.com/console/signup
2. Sign in with the Google account you want to publish under.
3. Pay the one-time **$25 USD** registration fee.
4. Complete identity verification (Google may ask for a government ID / business docs — this can take up to 48 hours, sometimes longer for new personal accounts).

### 2. Host the privacy policy somewhere public
Play Console requires a working URL, not a file. Easiest free option since this repo is already on GitHub (`iamvisheshsrivastava/german-vocab`):
1. Push this branch's changes to GitHub (or ask me to open a PR — see below).
2. In the repo: **Settings → Pages → Deploy from a branch → main → /(root)**.
3. GitHub will publish `PRIVACY_POLICY.md` at a URL like:
   `https://iamvisheshsrivastava.github.io/german-vocab/PRIVACY_POLICY`
4. Put that URL into `frontend/store-assets/store-listing.md` and into Play Console's "Privacy policy" field (App content → Privacy policy).

(Alternative: any static host — Notion public page, a Gist rendered via a viewer, your own site — works too, as long as it's a stable public URL.)

### 3. Log in to EAS (Expo's build service) and build the release bundle
I can't log in on your behalf (that's an account/credential action), but the commands are simple. In a terminal, from `frontend/`:

```bash
npx eas-cli login
```

Enter your Expo account email/password (free account — sign up at expo.dev if you don't have one). Then:

```bash
npx eas-cli init
```

This links the project to your Expo account and writes a project ID into `app.json`. Then kick off the actual build:

```bash
npx eas-cli build --platform android --profile production
```

This builds in Expo's cloud (avoids the Windows "path with spaces" Gradle bug you hit before) and signs the app automatically — EAS generates and stores your Android signing key for you (back it up: `npx eas-cli credentials`). Takes ~15–20 minutes; you'll get a link to download the resulting `.aab` file.

### 4. Create the app in Play Console and fill in the listing
1. Play Console → **Create app** → name it "German Vocab", default language English (US or your choice), app/game = App, free.
2. **App content** section — fill in:
   - Privacy policy URL (from step 2)
   - Content rating questionnaire — see suggested answers in `store-assets/store-listing.md` (should land on "Everyone")
   - Target audience & content (not primarily for children)
   - Data safety form — see suggested answers in `store-assets/store-listing.md` (nothing is collected/shared)
   - Ads declaration: No ads
   - Government apps / financial features / health etc.: No to all
3. **Main store listing** (Grow → Store presence):
   - Paste app name, short description, full description from `store-assets/store-listing.md`
   - Upload `play-store-icon-512.png`, `feature-graphic-1024x500.png`, and the screenshots from `store-assets/screenshots/`
   - Category: Education

### 5. Upload the build
Either:
- **Manual**: Production → Create new release → upload the `.aab` EAS gave you, or
- **Automatic**: `npx eas-cli submit --platform android --profile production` (needs a Play Console API service-account key — Play Console → Setup → API access → create service account; EAS will walk you through linking it).

### 6. Closed testing (Google now requires this for new personal accounts)
Since November 2023, Google requires **new personal developer accounts** to run a closed test with **at least 12 testers who opt in and stay enrolled for 14 continuous days** before you're allowed to publish to production. Practically:
1. Play Console → Testing → Closed testing → create a track, upload the same `.aab`.
2. Add at least 12 testers (email list, or a Google Group) — friends/family is fine, they just need to install via the opt-in link and open the app.
3. Wait out the 14-day clock with the app actively installed/opened by testers.
4. After that, Play Console unlocks the option to promote the release to production.

This is the step most likely to catch people by surprise — budget ~2 weeks of calendar time, not just build time.

### 7. Submit for review and go live
Once eligible, promote the tested release to **Production**, submit. Google's review is typically same-day to a few days for a simple app like this with no sensitive permissions.

## Things I already flagged from the earlier app review that matter here
- The app currently has **no analytics/ads/tracking** — this is what makes the content rating and data-safety answers so simple. If you ever add any (crash reporting, ads, etc.), the privacy policy and data-safety form will need updating before your next release.
- Version numbers: `app.json` now has `android.versionCode: 1` and app `version: "1.0.0"`. Bump `versionCode` (and usually `version`) on every future release — Play rejects a re-upload with a versionCode it's already seen.

## Want me to go further?
I can:
- Commit these changes and open a PR for you to review before merging.
- Regenerate screenshots/graphics if you want different wording, colors, or the icon changed.
- Draft the GitHub Pages workflow so the privacy policy auto-publishes on push.

I can't: create your Google/Expo accounts, pay the $25 fee, or click submit in Play Console — those need your login and your card.
