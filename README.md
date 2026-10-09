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

Screens clearly identify demonstration data and live provider responses.

## CCTV Intelligence

The CCTV page embeds a small demo subset of the official public live streams from [ATCS Kota Denpasar](https://atcs.denpasarkota.go.id/streaming). No API key is required. The interface labels Denpasar as the provider and coverage area so the streams are not presented as cameras owned by Kabupaten Badung.

The official portal remains the source of truth for stream availability and its full 110-camera directory.
