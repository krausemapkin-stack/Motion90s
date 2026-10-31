# Motion90s

Motion90s is a responsive, rights-first film discovery MVP. It demonstrates a catalog and film-detail experience without scraping, downloading, or rehosting video. The included titles and poster artwork are fictional placeholders; none are real films, licensed content, or available to watch.

## Run locally

Requires Node.js 18 or newer. No third-party packages are needed.

```sh
npm start
```

Open [http://localhost:4173](http://localhost:4173). The search field filters title, genre, and description; genre chips narrow the demo collection; select a card to view its details. On small screens the layout adapts to a single-column hero and a two-column catalog.

Open [http://localhost:4173/admin](http://localhost:4173/admin) for the local catalog dashboard. You can import CSV/JSON files, export the local catalog, edit records, remove them, or import all uploads returned across the pages of a YouTube channel's official uploads playlist via the YouTube Data API v3. Catalog records support categories (JSON string arrays or comma-separated CSV cells) and HTTPS thumbnail URLs; YouTube imports use official thumbnail metadata when available. Thumbnails and category labels appear in the public catalog, category chips filter results, and the admin movie list shows thumbnails without a source icon. Channel imports require a Google API key with YouTube Data API v3 enabled and key restrictions configured in Google Cloud. The key is entered at import time, sent to Google from the browser, and not saved by the app. YouTube quota, API availability, and channel/video visibility restrictions apply.

## GitHub Pages hosting

The GitHub Actions workflow `.github/workflows/deploy-pages.yml` publishes the static app to GitHub Pages when changes are pushed to `main`. Once enabled and deployed, use `https://krausemapkin-stack.github.io/Motion90s/`; the admin dashboard is at `/Motion90s/admin.html`. The first deployment requires GitHub Pages to be enabled with **Settings → Pages → Build and deployment → GitHub Actions**.

The Pages version is public and the admin dashboard is **not protected by a login**. It is a browser-local demo: edits only affect that browser and do not update a shared catalog for other visitors. Do not enter sensitive data or treat this dashboard as a production admin system.

Run the rights-gating tests with:

```sh
npm test
```

## Android APK

The GitHub Actions workflow `.github/workflows/build-android-apk.yml` builds a **debug APK** when changes are pushed to `main`, for pull requests targeting `main`, or when manually started from the Actions tab. The build prepares the static web app, wraps it with Capacitor, and uploads `app-debug.apk` as the `motion90s-android-debug-apk` workflow artifact. Download the artifact from the completed workflow run and install the APK on an Android device for testing.

The Android project is generated during CI and is not committed to this web-first repository. The debug APK is for testing; publishing through Google Play requires a release build signed with a protected release key.

## Rights-gated catalog

The sample records in `catalog.js` are fictional demos, drafts with `rightsStatus: "unverified"`, and have no source URL, playback URL, territories, or license evidence. `getPublishedFilms()` only returns records that pass `isPublishable()` for a requested territory. The UI displays demo placeholders plus verified catalog entries for Nigeria (`NG`); change `viewerTerritory` in `app.js` for another territory. A record must have all of the following before it can appear in the published catalog or play:

- `visibility: "published"` and `rightsStatus: "verified"`
- non-empty `licenseEvidence` retained with the record
- the requested territory in `territories`
- an HTTPS source URL from an approved platform and an HTTPS official player URL from an approved embed host

Playback URLs are restricted to recognized official player URL patterns. The detail view also gates playback with the same rights check; unverified sample items cannot play. Add licensing records only after independently confirming the exact rights, platform terms, and territory. A platform upload or public availability alone does not establish permission. This demo is not legal advice or a production rights-management system; rights decisions should be reviewed by qualified counsel before launch.

## MVP scope

This is a static frontend with a browser-local catalog and no accounts, backend, payments, ads, scraping, or production-ready licensing workflow. The admin dashboard has no authentication and browser-local changes are not shared across devices. The YouTube Data API is used only for official channel metadata; imported titles remain unverified drafts and are never published or playable automatically. External Google Fonts are optional; system font fallbacks are provided.
