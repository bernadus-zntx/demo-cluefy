# Live intelligence feed

`GET /api/intelligence/live` returns up to 250 source records per response, plus `pagination.nextCursor` and `pagination.snapshot`. The first response also includes rules and recent crawler runs. To read the complete dataset, request subsequent pages with both `?cursor=<nextCursor>&snapshot=<snapshot>` until `nextCursor` is null. A page can contain fewer than 250 relevant items and still have a next cursor because relevance filtering happens after reading source rows.

Pages use a descending UUID cursor and a fixed `first_seen_at` cutoff, so records inserted during a refresh do not shift page offsets. New records become visible on the next refresh. `LiveIntelligenceProvider` collects all pages before replacing the visible dataset and retains the previous dataset if any request fails. It sorts the collected items by publication/capture time. The crawler worker follows the same pagination contract for translation and enrichment backlogs.

Overview uses calendar dates in Asia/Makassar (WITA). The selected period and topic/sentiment/country filters feed the conversation total, trend, sentiment distribution, rankings, district view, and demographics. Case/Finding operational queues retain their separate scope. Trend tooltips include zero-volume dates and unclassified sentiment. Ranges longer than 90 days use weekly buckets; ranges longer than 730 days use 30-day buckets, retaining the full selected total.

Run `npm run test:overview` for pagination, date-boundary, filter-intersection, and aggregation regressions.
