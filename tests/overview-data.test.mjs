import assert from 'node:assert/strict';
import test from 'node:test';
import { readAllPages } from '../lib/paginated-query.ts';
import { collectLivePages } from '../lib/live-pagination.ts';
import { buildDailyTrend, buildTrendForRange, conversationDate, defaultOverviewFilters, filterOverviewItems, inConversationPeriod, overviewWindow, previousOverviewWindow } from '../lib/conversation-trend.ts';

const now = Date.parse('2026-11-02T10:00:00+08:00');
const item = (publishedAt, sentiment = null, topic = 'Sampah', country = 'Indonesia') => ({ publishedAt, capturedAt: '2026-11-02T01:00:00Z', sentiment, topic, country });

test('Supabase range reader goes beyond 1,000 records, including an exact page boundary', async () => {
  for (const total of [0, 1000, 2126]) {
    const rows = Array.from({ length: total }, (_, id) => ({ id }));
    const result = await readAllPages(async (from, to) => ({ data: rows.slice(from, to + 1), error: null }));
    assert.equal(result.error, null);
    assert.deepEqual(result.data, rows);
  }
});

test('a failed later page never yields a partial dataset with an apparently valid total', async () => {
  const error = { message: 'Database unavailable' };
  const result = await readAllPages(async from => from ? { data: null, error } : { data: [1, 2], error: null }, 2);
  assert.equal(result.data, null);
  assert.equal(result.error, error);
});

test('browser pagination collects all 2,126 records and preserves initial metadata', async () => {
  const all = Array.from({ length: 2126 }, (_, id) => ({ id: String(id) }));
  const snapshot = '2026-11-02T02:00:00Z';
  const result = await collectLivePages(async (cursor, receivedSnapshot) => {
    const offset = Number(cursor || 0);
    assert.equal(receivedSnapshot, cursor ? snapshot : null);
    return { items: all.slice(offset, offset + 250), rules: cursor ? [] : ['rule'], pagination: { snapshot, nextCursor: offset + 250 < all.length ? String(offset + 250) : null } };
  });
  assert.deepEqual(result.items, all);
  assert.deepEqual(result.rules, ['rule']);
});

test('filtered-out pages do not end pagination and cursor loops are rejected', async () => {
  const result = await collectLivePages(async cursor => ({ items: cursor ? [{ id: 'kept' }] : [], pagination: { snapshot: 'now', nextCursor: cursor ? null : 'next' } }));
  assert.equal(result.items.length, 1);
  await assert.rejects(collectLivePages(async () => ({ items: [], pagination: { snapshot: 'now', nextCursor: 'repeated' } })), /berulang/);
  await assert.rejects(collectLivePages(async cursor => { if (cursor) throw new Error('page failed'); return { items: [{ id: 'first' }], pagination: { snapshot: 'now', nextCursor: 'next' } }; }), /page failed/);
});

test('28 calendar days use Bali midnight and share identical totals and daily buckets', () => {
  const rows = [item('2026-10-06T00:00:00+08:00', 'Positive'), item('2026-10-05T23:59:59+08:00', 'Negative'), item('2026-11-01T16:30:00Z', 'Negative'), item('2026-11-02T09:00:00+08:00', 'Neutral'), item(null), item('invalid'), item('2026-11-03T01:00:00+08:00')];
  const current = rows.filter(row => inConversationPeriod(row, 28, 0, now));
  const trend = buildDailyTrend(rows, now);
  assert.equal(trend.length, 28);
  assert.equal(trend[0].date, '2026-10-06');
  assert.equal(trend.at(-1).date, '2026-11-02');
  assert.equal(trend.reduce((total, day) => total + day.total, 0), current.length);
  assert.equal(current.length, 4);
  assert.deepEqual([trend.at(-1).positive, trend.at(-1).neutral, trend.at(-1).negative, trend.at(-1).unknown], [0, 1, 1, 1]);
  assert.ok(trend.every(day => day.total === day.positive + day.neutral + day.negative + day.unknown));
});

test('all four filters intersect, with an adjacent equally long comparison period', () => {
  const filters = { ...defaultOverviewFilters(now), period: '7', topic: 'Sampah', sentiment: 'Negative', country: 'Rusia' };
  const rows = [item('2026-11-01T01:00:00+08:00', 'Negative', 'Sampah', 'Rusia'), item('2026-10-20T01:00:00+08:00', 'Negative', 'Sampah', 'Rusia'), item('2026-11-01T01:00:00+08:00', 'Positive', 'Sampah', 'Rusia'), item('2026-11-01T01:00:00+08:00', 'Negative', 'Pariwisata', 'Rusia'), item('2026-11-01T01:00:00+08:00', 'Negative', 'Sampah', 'Indonesia')];
  const window = overviewWindow(filters, rows, now);
  assert.equal(window.from, '2026-10-27');
  assert.equal(filterOverviewItems(rows, filters, window, now).length, 1);
  const previous = previousOverviewWindow(window);
  assert.equal(previous.from, '2026-10-20');
  assert.equal(previous.to, '2026-10-26');
  assert.equal(filterOverviewItems(rows, filters, previous, now).length, 1);
});

test('custom ranges include both dates; unknown metadata and no matches remain explicit', () => {
  const rows = [item('2026-11-01T23:59:59+08:00', null, null, null), item('2026-11-02T00:00:00+08:00', null, null, null)];
  const filters = { ...defaultOverviewFilters(now), period: 'custom', from: '2026-11-01', to: '2026-11-01', sentiment: 'unknown', topic: 'Belum diklasifikasi', country: 'Belum diketahui' };
  assert.equal(filterOverviewItems(rows, filters, overviewWindow(filters, rows, now), now).length, 1);
  const invalid = { ...filters, from: '2026-11-02' };
  assert.equal(overviewWindow(invalid, rows, now).valid, false);
  assert.deepEqual(filterOverviewItems(rows, invalid, overviewWindow(invalid, rows, now), now), []);
  assert.equal(overviewWindow({ ...filters, to: '2026-11-03' }, rows, now).valid, false);
});

test('long-range grouping retains every record and the selected end boundary', () => {
  const rows = [item('2025-01-01T00:00:00+08:00', 'Positive'), item('2026-11-02T01:00:00+08:00', 'Negative'), item('2026-11-02T02:00:00+08:00')];
  const filters = { ...defaultOverviewFilters(now), period: 'all' };
  const window = overviewWindow(filters, rows, now);
  const trend = buildTrendForRange(rows, window.from, window.to, now);
  assert.equal(trend[0].date, '2025-01-01');
  assert.equal(trend.at(-1).endDate, conversationDate(now));
  assert.equal(trend.reduce((sum, bucket) => sum + bucket.total, 0), 3);
  assert.ok(trend.length < 100);
});
