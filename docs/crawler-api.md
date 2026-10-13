# ClueFy Crawler API

The dashboard stores crawler targets in Supabase. External crawlers never receive the Supabase service-role key; they authenticate to the ClueFy API using `CRAWLER_API_KEY`.

## Setup

1. Run `supabase/migrations/202610130001_crawler_ingestion.sql` in the Supabase SQL Editor.
2. Copy `.env.example` to `.env.local` and fill the environment values.
3. Generate `CRAWLER_API_KEY` with a cryptographically random value and configure the same value on the crawler host.

## Poll active rules

```http
GET /api/crawler/rules
Authorization: Bearer <CRAWLER_API_KEY>
```

The response includes active rules and `nextPollAfterSeconds`. Send the previous `ETag` as `If-None-Match`; the API returns `304` when configuration has not changed.

## Record a run

Start:

```http
POST /api/crawler/runs
Authorization: Bearer <CRAWLER_API_KEY>
Content-Type: application/json

{"rulesRequested":9,"metadata":{"worker":"miitel-01"}}
```

Complete:

```http
PATCH /api/crawler/runs
Authorization: Bearer <CRAWLER_API_KEY>
Content-Type: application/json

{"id":"<run-id>","status":"completed","itemsReceived":20,"itemsInserted":8,"itemsDuplicate":11,"itemsRevised":1}
```

## Ingest crawl results

```http
POST /api/crawler/ingest
Authorization: Bearer <CRAWLER_API_KEY>
Content-Type: application/json

{
  "items": [
    {
      "ruleId": "<rule-uuid>",
      "source": "detikBali",
      "externalId": "article-123",
      "url": "https://example.com/news?id=123&utm_source=feed",
      "title": "Judul berita",
      "body": "Isi artikel",
      "author": "Nama Penulis",
      "publisher": "Nama Media",
      "publishedAt": "2026-10-13T08:00:00+08:00",
      "rawPayload": {}
    }
  ]
}
```

The endpoint accepts up to 100 items per request. URL tracking parameters are removed before hashing. Supabase then returns one of three actions:

- `inserted`: a new article was stored.
- `duplicate`: the article already exists and only `last_seen_at` was updated.
- `revised`: the URL existed but its content changed, so a revision was recorded.

## Built-in public news worker

The repository includes a worker for public Google News RSS results. It supports URL/domain, keyword, hashtag, and author rules. Social account and group rules are skipped until an authorized provider API is connected.

Run one cycle:

```bash
npm run crawler:once
```

Keep a local worker running every 10 minutes:

```bash
npm run crawler:watch
```

The ingestion API remains the deduplication authority. Repeated URLs update `last_seen_at`; changed content creates a revision instead of a second content row.
