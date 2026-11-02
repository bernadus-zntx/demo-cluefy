export type ConversationTime = { publishedAt: string | null; capturedAt: string };
export type SentimentCounts = { positive: number; neutral: number; negative: number; unknown: number };
export type DailyConversation = SentimentCounts & { date: string; endDate?: string; total: number };

const DAY = 86_400_000;
const WITA = 8 * 3_600_000;
const dayNumber = (timestamp: number) => Math.floor((timestamp + WITA) / DAY);
export const conversationDate = (timestamp = Date.now()) => new Date(dayNumber(timestamp) * DAY).toISOString().slice(0, 10);

export function inConversationPeriod(item: ConversationTime, days: number, offset = 0, now = Date.now()) {
  const timestamp = Date.parse(item.publishedAt || item.capturedAt);
  if (!Number.isFinite(timestamp) || timestamp > now) return false;
  const age = dayNumber(now) - dayNumber(timestamp);
  return age >= offset && age < offset + days;
}

export function buildDailyTrend(
  items: (ConversationTime & { sentiment: string | null })[],
  now = Date.now(),
  days = 28,
): DailyConversation[] {
  return buildTrendForRange(items, new Date((dayNumber(now) - days + 1) * DAY).toISOString().slice(0, 10), conversationDate(now), now);
}

export function buildTrendForRange(items: (ConversationTime & { sentiment: string | null })[], from: string, to: string, now = Date.now()): DailyConversation[] {
  const firstDay = Math.floor(Date.parse(from) / DAY);
  const lastDay = Math.floor(Date.parse(to) / DAY);
  const days = lastDay - firstDay + 1;
  if (!Number.isFinite(days) || days < 1) return [];
  const step = days <= 90 ? 1 : days <= 730 ? 7 : 30;
  const buckets = Array.from({ length: Math.ceil(days / step) }, (_, index) => ({
    date: new Date((firstDay + index * step) * DAY).toISOString().slice(0, 10),
    endDate: new Date(Math.min(lastDay, firstDay + (index + 1) * step - 1) * DAY).toISOString().slice(0, 10),
    total: 0, positive: 0, neutral: 0, negative: 0, unknown: 0,
  }));
  for (const item of items) {
    const timestamp = Date.parse(item.publishedAt || item.capturedAt);
    if (!Number.isFinite(timestamp) || timestamp > now) continue;
    const day = dayNumber(timestamp);
    if (day < firstDay || day > lastDay) continue;
    const bucket = buckets[Math.floor((day - firstDay) / step)];
    if (!bucket) continue;
    bucket.total++;
    if (item.sentiment === 'Positive') bucket.positive++;
    else if (item.sentiment === 'Neutral') bucket.neutral++;
    else if (item.sentiment === 'Negative') bucket.negative++;
    else bucket.unknown++;
  }
  return buckets;
}

export type OverviewFilters = {
  period: '7' | '14' | '28' | '90' | 'all' | 'custom';
  topic: string; sentiment: string; country: string; from: string; to: string;
};
export type OverviewWindow = { from: string; to: string; label: string; days: number; valid: boolean };
type FilterItem = ConversationTime & { topic: string | null; sentiment: string | null; country: string | null };
const shift = (date: string, days: number) => new Date(Date.parse(date) + days * DAY).toISOString().slice(0, 10);
const validDate = (date: string) => /^\d{4}-\d{2}-\d{2}$/.test(date) && Number.isFinite(Date.parse(date)) && new Date(date).toISOString().slice(0, 10) === date;
const labelDate = (date: string) => new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(date));

export function defaultOverviewFilters(now = Date.now()): OverviewFilters {
  const today = conversationDate(now);
  return { period: 'all', topic: '', sentiment: '', country: '', from: shift(today, -27), to: today };
}

export function overviewWindow(filters: OverviewFilters, items: ConversationTime[], now = Date.now()): OverviewWindow {
  const today = conversationDate(now);
  let from: string, to = today, label: string;
  if (filters.period === 'custom') {
    from = filters.from; to = filters.to;
    if (!validDate(from) || !validDate(to) || from > to || to > today) return { from, to, label: 'Rentang tanggal tidak valid', days: 0, valid: false };
    label = `${labelDate(from)} – ${labelDate(to)}`;
  } else if (filters.period === 'all') {
    from = items.reduce((first, item) => {
      const at = Date.parse(item.publishedAt || item.capturedAt);
      return Number.isFinite(at) && at <= now ? [first, conversationDate(at)].sort()[0] : first;
    }, today);
    label = 'Semua waktu';
  } else {
    from = shift(today, 1 - Number(filters.period));
    label = `${filters.period} hari terakhir`;
  }
  return { from, to, label, days: Math.round((Date.parse(to) - Date.parse(from)) / DAY) + 1, valid: true };
}

export function previousOverviewWindow(window: OverviewWindow): OverviewWindow {
  return window.valid ? { ...window, from: shift(window.from, -window.days), to: shift(window.from, -1) } : window;
}

export function filterOverviewItems<T extends FilterItem>(items: T[], filters: OverviewFilters, window: OverviewWindow, now = Date.now()): T[] {
  if (!window.valid) return [];
  return items.filter(item => {
    const timestamp = Date.parse(item.publishedAt || item.capturedAt);
    if (!Number.isFinite(timestamp) || timestamp > now) return false;
    const date = conversationDate(timestamp);
    const sentiment = ['Positive', 'Neutral', 'Negative'].includes(item.sentiment || '') ? item.sentiment : 'unknown';
    return date >= window.from && date <= window.to
      && (!filters.topic || (item.topic || 'Belum diklasifikasi') === filters.topic)
      && (!filters.sentiment || sentiment === filters.sentiment)
      && (!filters.country || (item.country || 'Belum diketahui') === filters.country);
  });
}
