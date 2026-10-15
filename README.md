# Flora Finder

A responsive field guide to Hawaiʻi’s plants, built with Next.js, shadcn/ui (Base UI), and Tailwind CSS.

## Local development

Use Node.js 24 LTS and npm.

```sh
npm install
npx prisma generate
npm run dev
```

Open [localhost:3000](http://localhost:3000). Plant browsing and saved lists work without a database.

For plant range maps, create `.env.local` in the project root and add a **public Mapbox access token** from your [Mapbox account](https://account.mapbox.com/access-tokens/):

```dotenv
NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN=pk.your_mapbox_public_token
```

`.env.local` is ignored by Git. Restart the development server after adding or changing the token. For deployment, set the same environment variable before building: Next.js includes public environment variables in the browser bundle at build time. The rest of each plant detail page remains usable without a token.

## Plant data and saved lists

All plant information comes from [public/datasets/plants.json](public/datasets/plants.json). The catalog and detail APIs serve these records in dataset order, including photo URLs, credits, and GeoJSON paths. There is no separate preview catalog.

The collection loads 24 plants at a time and fetches the next page as you approach the bottom. A Load more plants button is also available; if a later request fails, the loaded plants stay visible while you retry. `/api/plants?offset=0&limit=24` returns `{ plants, total, nextOffset }`, with a maximum limit of 100. `/api/plants` without pagination still returns the full catalog for saved lists.

Browse by letter follows the names displayed on the cards and ignores accents and ʻokina. Letter and island filters can be combined and apply before pagination, preserving dataset order. For example, `/api/plants?letter=M&island=hawaii` returns the first page of matching plants. Island filters use the exact islands listed in `NATURAL_RANGE`, which may include historical ranges; they do not infer current occurrence from descriptive text or map polygons. Range data is recorded for 201 plants; the other 644 remain available under All islands or Not recorded (`island=unrecorded`). Northwestern Islands uses `island=northwestern-islands`.

The navigation search suggests up to six plants from the entire catalog after two characters. It matches scientific and common names without requiring accents or ʻokina. Choose a suggestion with the mouse or arrow keys and Enter to open its detail page. `/api/plants/search?q=ohia` returns only plant IDs and names, plus family information.

My Plant List starts empty and saves plant IDs in this browser's local storage. Saves survive reloads and closing the browser, but do not sync between browsers or devices. Clearing site storage clears the list. Existing database saves and old preview selections are not migrated. Stored IDs that are no longer in the catalog are omitted from the list.

Each plant detail page displays its range using the [GeoJSON file](public/datasets/geojson) supplied by that plant's `SHAPEFILE_PATH`. Only the current plant's file is requested, directly from `/datasets/geojson/`; no extra API or database setup is needed. The map preserves polygon holes, excludes `GRIDCODE: 0`, and displays values 1 and 2 with the same translucent green fill and outline. Zoom controls, a scale, and Reset view help explore the range. Missing data or map failures stay within the map section, with retry for recoverable failures.

Explore and My Plant List are available in desktop and mobile navigation. The existing `/map` route remains accessible directly. A generic botanical illustration remains the fallback when a photograph is unavailable.

The unrelated users API still uses Prisma and the database. Its connection settings are `DATABASE_HOST`, `DATABASE_USER`, `DATABASE_PASSWORD`, `DATABASE_NAME`, and `DATABASE_URL`. Prisma client generation is required for the build, but does not connect to the database.

## Checks

```sh
npm run lint
npm run typecheck
npx prisma generate
npm run build
```

No database migrations or live database are needed to verify plant features. A Mapbox token is required to verify the live map.

Browser checks cover the real catalog and detail APIs, letter and island browsing, search suggestions and keyboard navigation, lazy loading and retries, responsive layouts, photo credits, browser storage persistence and failures, and loading, empty, and error states with intercepted API responses. They do not connect to the database.

```sh
npx playwright install chromium
npm run build
npm run test:e2e
```

The browser suite starts a production server on port 3131.

GeoJSON filtering and bounds tests run with the regular suite. To also exercise the Mapbox renderer, controls, retries, and navigation cleanup, build with your public token configured and run `MAPBOX_BROWSER_TESTS=1 npm run test:e2e`. These renderer tests intercept Mapbox requests and use a local test style. To check the missing-token state explicitly, build with `NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN= npm run build`, then run `MAPBOX_MISSING_TOKEN_TESTS=1 npm run test:e2e -- tests/plant-range-map.spec.ts`. Rebuild normally afterward to restore configured maps.
