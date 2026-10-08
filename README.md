# Flora Finder

A responsive field guide to Hawaiʻi’s plants, built with Next.js, shadcn/ui (Base UI), and Tailwind CSS.

## Local development

Use Node.js 24 LTS and npm.

```sh
npm install
npx prisma generate
npm run dev
```

The normal app uses the existing database-backed APIs. Database connection settings are `DATABASE_HOST`, `DATABASE_USER`, `DATABASE_PASSWORD`, `DATABASE_NAME`, and `DATABASE_URL` in your local environment. The map additionally uses `NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN`.

## Preview while the database is unavailable

```sh
npm run preview
```

Open [localhost:3000](http://localhost:3000). This sets `NEXT_PUBLIC_UI_PREVIEW=true` for the development server. The visible **Sample data** badge identifies preview mode. Plant reads and save/remove actions use local fixtures without contacting the database. Two plants are initially saved; changes persist for the current browser tab in session storage. Closing the tab resets the preview collection.

Preview mode is off by default and disabled in production, even if the flag is set. API failures in normal mode show an error; they never substitute sample records. Fixture text is for layout review and is not authoritative botanical information. Photo sources and licenses are documented in [preview photo credits](public/preview/CREDITS.md).

## Checks

```sh
npm run lint
npm run typecheck
npx prisma generate
npm run build
```

Prisma client generation uses the schema and does not require a working database. Do not run database migrations to review the UI. A live database is required to verify production persistence, and a Mapbox token is required to verify the live map.

Browser checks cover the preview collection at phone, tablet, and desktop sizes and normal-mode loading, empty, and error states with intercepted API responses. They do not connect to the database.

```sh
npx playwright install chromium
npm run build
npm run test:e2e
```

The browser suite starts a preview development server on port 3130 and a normal production server on port 3131.
