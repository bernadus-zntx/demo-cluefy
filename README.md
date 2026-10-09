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

The CCTV page works immediately with clearly labelled ATCS demonstration points. To enable live webcam discovery around Badung through Windy Webcams API V3, configure this server-side environment variable:

```bash
WINDY_WEBCAMS_API_KEY=your_windy_webcams_api_key
```

The key is only read by `app/api/cctv/route.ts` and is never returned to the browser.
