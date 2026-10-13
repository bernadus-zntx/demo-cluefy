# ClueFy Dashboard

A social and public intelligence dashboard built with Next.js. Most screens use demonstration data, while selected modules support server-side provider integrations.

## Run locally

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Deploy to Vercel

Import this folder into Vercel. The default framework/build settings are sufficient. Provider credentials can be added as environment variables when live integrations are enabled.

## Included screens

- Overview
- Conversations
- Topics
- Brand Analysis
- Competitor Analysis
- Data Sources
- CCTV Intelligence

Government intelligence screens read connected data sources directly and show explicit empty states when a source has not been connected.

## Supabase crawler ingestion

Crawler configuration, run tracking, article ingestion, and deterministic deduplication are defined in `supabase/migrations/202610130001_crawler_ingestion.sql`. Apply that migration in Supabase, copy `.env.example` to `.env.local`, and configure the four environment values before starting the dashboard.

The external crawler contract is documented in `docs/crawler-api.md`. The crawler uses a dedicated bearer token and never receives the Supabase service-role key. Run `npm run crawler:once` for one public-news cycle or `npm run crawler:watch` to poll every 10 minutes.

## CCTV Intelligence

The CCTV page embeds a selected subset of the official public live streams from [ATCS Kota Denpasar](https://atcs.denpasarkota.go.id/streaming). No API key is required. The interface labels Denpasar as the provider and coverage area so the streams are not presented as cameras owned by Kabupaten Badung.

The official portal remains the source of truth for stream availability and its full 110-camera directory.
