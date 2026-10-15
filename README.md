# Flora Finder

A responsive field guide to Hawaiʻi’s plants, built with Next.js, shadcn/ui (Base UI), and Tailwind CSS.

## Local development

Use Node.js 24 LTS and npm.

```sh
npm install
npm run dev
```

Open [localhost:3000](http://localhost:3000). Plant browsing and saved lists work without a database.

For plant range maps, create `.env.local` in the project root and add a **public Mapbox access token** from your [Mapbox account](https://account.mapbox.com/access-tokens/):

```dotenv
NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN=pk.your_mapbox_public_token
```

`.env.local` is ignored by Git. Restart the development server after adding or changing the token. For deployment, set the same environment variable before building: Next.js includes public environment variables in the browser bundle at build time. The rest of each plant detail page remains usable without a token.

## Firebase

The app uses the modular [Firebase Web SDK](https://firebase.google.com/docs/web/setup). Copy the settings in `.env.example` into `.env.local`, preserving any existing values, and fill in the six `NEXT_PUBLIC_FIREBASE_*` values from your registered Firebase web app. The configured project for this app is `florafinder-da32e`.

`app/components/FirebaseInitializer.tsx` initializes Firebase after the app mounts in the browser. Client components can import `getFirebaseApp` from `@/lib/firebase` to use the same Firebase app when adding services:

```ts
import { getFirebaseApp } from "@/lib/firebase";

const app = getFirebaseApp();
if (app) {
  // Pass this app to the Firebase service used by your client component.
}
```

The helper returns `null` during server rendering or when the API key, project ID, or app ID is missing. Plant browsing and browser-saved lists continue to work without Firebase configuration. Authentication, cloud-synced lists, and other Firebase services are not enabled by this initial SDK setup.

Firebase web settings identify the app and are public browser configuration. Keep service-account credentials and other server secrets out of `NEXT_PUBLIC_*` variables. [Next.js embeds public environment variables at build time](https://nextjs.org/docs/app/guides/environment-variables), so restart the development server after changes and set these variables in your deployment environment before building.

## Free Firebase Hosting

The app builds as a [Next.js static export](https://nextjs.org/docs/app/guides/static-exports) in `out/`. `firebase.json` deploys those files to classic Firebase Hosting, and `.firebaserc` selects `florafinder-da32e`. The site can use Firebase's Spark plan within its [free Hosting allowances](https://firebase.google.com/docs/hosting/usage-quotas-pricing); this deployment does not need App Hosting, Cloud Run, Cloud Functions, or a billing upgrade. Mapbox has its own usage limits.

Build and preview the exported site locally:

```sh
npm run build
npm run start
```

The preview serves `out/` on port 3000. To choose a different port, use `npm run start -- --listen 3131`. It serves prebuilt pages and genuine 404 responses without a Next.js server.

Sign in with an account that can deploy to the project, then publish:

```sh
npx -y firebase-tools@latest login
npm run deploy
```

The deploy command runs a fresh build through Firebase's `predeploy` hook, then deploys only Hosting. Set the public Firebase and Mapbox environment values before that build; `.env.local` stays local. The default live URLs are `https://florafinder-da32e.web.app` and `https://florafinder-da32e.firebaseapp.com` after a successful deployment.

All catalog plant detail pages are generated during the build, so direct links and refreshes work. Adding plants to the dataset requires rebuilding and redeploying. Unknown plant URLs return the exported 404 page. Firebase serves clean URLs and the exported Next.js navigation payloads without a catch-all rewrite. Hashed JavaScript and CSS receive long-lived caching, catalog HTTP responses revalidate, and individual map files can be cached for an hour. The PWA keeps its cached catalog and app shell together until an app update is accepted.

## Install and use offline

Flora Finder is an installable progressive web app. Open the HTTPS site in a supported browser and choose **Install app** when the browser makes installation available. On iPhone or iPad Safari, choose **Install app** for instructions, or use **Share → Add to Home Screen**. Installed apps open in their own window with the Flora Finder icon. The manifest and icons remain ordinary static files on free Firebase Hosting.

After the first successful online visit and offline setup, the catalog, letter/island filters, search, and saved-list storage work offline. Previously opened plant pages can reload offline once saved on the device. Unopened pages show an offline message with links back to the catalog and saved list; **Try this page again** retries when a connection is available. Photographs and Mapbox maps need an internet connection and retain their existing fallback states.

The service worker caches about 5 MiB of core app files and catalog data, then keeps a bounded cache of visited pages and Next.js navigation payloads. It does not download all plant pages or the full GeoJSON collection, cache third-party resources, or store API responses. Browser storage limits and eviction still apply; clearing site data also clears offline files and saved plants.

Each `npm run build` generates a new `out/sw.js` from `scripts/service-worker.js` using the exported files and their contents. Service workers register only in production on HTTPS or localhost, so use `npm run build` followed by `npm run start` to test offline behavior. Normal `npm run dev` does not register a worker. When switching from a production preview to development on the same origin, unregister the old worker in browser developer tools or use a different development port.

When a new version finishes downloading, **Update app** appears. Accepting it refreshes open app tabs while preserving saved plant IDs. An update is applied while online; maps and photos are never included in the offline download. Firebase serves the worker without HTTP caching so browsers can discover releases. For the underlying platform behavior, see [Next.js PWA guidance](https://nextjs.org/docs/app/guides/progressive-web-apps) and [MDN installation guidance](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Making_PWAs_installable).

## Plant data and saved lists

All plant information comes from [public/datasets/plants.json](public/datasets/plants.json). The browser loads this static JSON once and shares the successfully loaded catalog across browsing, search, details, and saved lists. A failed or malformed response can be retried. Records retain dataset order, including photo URLs, credits, and GeoJSON paths. There is no separate preview catalog or runtime plant API.

The collection displays 24 plants at a time and reveals the next page as you approach the bottom. A Load more plants button is also available. Pagination, filtering, and search run in the browser against the shared catalog, without additional network requests for each page or filter change.

Browse by letter follows the names displayed on the cards and ignores accents and ʻokina. Letter and island filters can be combined and apply before pagination, preserving dataset order. Island filters use the exact islands listed in `NATURAL_RANGE`, which may include historical ranges; they do not infer current occurrence from descriptive text or map polygons. Range data is recorded for 201 plants; the other 644 remain available under All islands or Not recorded. Northwestern Islands includes the dataset's Northwest Islands records.

The navigation search suggests up to six plants from the entire catalog after two characters. It matches scientific and common names without requiring accents or ʻokina. Choose a suggestion with the mouse or arrow keys and Enter to open its detail page.

My Plant List starts empty and saves plant IDs in this browser's local storage. Saves survive reloads and closing the browser, but do not sync between browsers or devices. Clearing site storage clears the list. Existing database saves and old preview selections are not migrated. Stored IDs that are no longer in the catalog are omitted from the list.

Each plant detail page displays its range using the [GeoJSON file](public/datasets/geojson) supplied by that plant's `SHAPEFILE_PATH`. Only the current plant's file is requested, directly from `/datasets/geojson/`; no extra API or database setup is needed. The map preserves polygon holes, excludes `GRIDCODE: 0`, and displays values 1 and 2 with the same translucent green fill and outline. Zoom controls, a scale, and Reset view help explore the range. Missing data or map failures stay within the map section, with retry for recoverable failures.

Explore and My Plant List are available in desktop and mobile navigation. The existing `/map` route remains accessible directly. A generic botanical illustration remains the fallback when a photograph is unavailable.

The server API routes and Prisma runtime have been removed for static hosting. The historical SQL schema and migrations remain under `prisma/` for reference. No database connection or generated database client is needed to develop, build, or host the plant guide.

## Checks

```sh
npm run lint
npm run build
npm run typecheck
```

No database migrations or live database are needed to verify plant features. A Mapbox token is required to verify the live map.

Browser checks run against the exported static files. They cover the real catalog, prebuilt detail links and reloads, 404s, letter and island browsing, search suggestions and keyboard navigation, incremental display, catalog loading and retries, responsive layouts, photo credits, and browser storage persistence and failures. Fixtures intercept the static catalog rather than server APIs.

The PWA suite enables real service workers and checks install metadata and icons, offline catalog and saved-list behavior, visited-page reloads, offline fallbacks, cache exclusions, and updates across open tabs. Other browser tests block service workers to keep network fixtures isolated. Run `npm run test:e2e -- tests/pwa.spec.ts` after a production build for the focused PWA checks.

```sh
npx playwright install chromium
npm run build
npm run test:e2e
```

The browser suite starts a static preview server on port 3131.

GeoJSON filtering and bounds tests run with the regular suite. To also exercise the Mapbox renderer, controls, retries, and navigation cleanup, build with your public token configured and run `MAPBOX_BROWSER_TESTS=1 npm run test:e2e`. These renderer tests intercept Mapbox requests and use a local test style. To check the missing-token state explicitly, build with `NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN= npm run build`, then run `MAPBOX_MISSING_TOKEN_TESTS=1 npm run test:e2e -- tests/plant-range-map.spec.ts`. Rebuild normally afterward to restore configured maps.
