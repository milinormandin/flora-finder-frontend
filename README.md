# Flora Finder

A responsive field guide to Hawaiʻi’s plants, built with Next.js, shadcn/ui (Base UI), and Tailwind CSS.

## Local development

Use Node.js 24 LTS and npm.

```sh
npm install
npx prisma generate
npm run dev
```

Open [localhost:3000](http://localhost:3000). Plant browsing and saved lists work without a database. The map uses `NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN`.

## Plant data and saved lists

All plant information comes from [public/datasets/plants.json](public/datasets/plants.json). The catalog and detail APIs serve these records in dataset order, including photo URLs, credits, and GeoJSON paths. There is no separate preview catalog.

My Plant List starts empty and saves plant IDs in this browser's local storage. Saves survive reloads and closing the browser, but do not sync between browsers or devices. Clearing site storage clears the list. Existing database saves and old preview selections are not migrated. Stored IDs that are no longer in the catalog are omitted from the list.

The [GeoJSON files](public/datasets/geojson) remain available at the paths supplied by each plant record. Plant range overlays are not yet displayed on the map. A generic botanical illustration remains the fallback when a photograph is unavailable.

The unrelated users API still uses Prisma and the database. Its connection settings are `DATABASE_HOST`, `DATABASE_USER`, `DATABASE_PASSWORD`, `DATABASE_NAME`, and `DATABASE_URL`. Prisma client generation is required for the build, but does not connect to the database.

## Checks

```sh
npm run lint
npm run typecheck
npx prisma generate
npm run build
```

No database migrations or live database are needed to verify plant features. A Mapbox token is required to verify the live map.

Browser checks cover the real catalog and detail APIs, responsive layouts, photo credits, browser storage persistence and failures, and loading, empty, and error states with intercepted API responses. They do not connect to the database.

```sh
npx playwright install chromium
npm run build
npm run test:e2e
```

The browser suite starts a production server on port 3131.
