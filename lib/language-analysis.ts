type LanguageItem = { language: string | null; topic: string | null; sentiment: string | null };
const aliases: Record<string, string> = {
  id: 'id', 'id-id': 'id', indonesian: 'id', indonesia: 'id', 'bahasa indonesia': 'id',
  en: 'en', 'en-us': 'en', 'en-gb': 'en', english: 'en', inggris: 'en',
  ja: 'ja', japanese: 'ja', jepang: 'ja', de: 'de', german: 'de', jerman: 'de',
  ru: 'ru', russian: 'ru', rusia: 'ru', uk: 'uk', ukrainian: 'uk', ukraina: 'uk',
  zh: 'zh', chinese: 'zh', mandarin: 'zh', ko: 'ko', korean: 'ko', korea: 'ko',
  fr: 'fr', french: 'fr', prancis: 'fr', balinese: 'ban', bali: 'ban', 'bahasa bali': 'ban', ban: 'ban',
};
const labels: Record<string, string> = { id: 'Bahasa Indonesia', en: 'English', ja: '日本語 / Jepang', de: 'Deutsch / Jerman', fr: 'Français / Prancis', zh: '中文 / Mandarin', ko: '한국어 / Korea', ru: 'Русский / Rusia', uk: 'Українська / Ukraina', ban: 'Bahasa Bali', unknown: 'Bahasa belum diketahui' };
export function languageKey(language: string | null): string {
  const value = language?.trim().toLocaleLowerCase('id-ID') || '';
  if (!value || ['unknown', 'und', 'belum diketahui', 'belum terdeteksi'].includes(value)) return 'unknown';
  return aliases[value] || value;
}
export function languageLabel(key: string) { return labels[key] || key; }
export function summarizeLanguages<T extends LanguageItem>(items: T[]) {
  const grouped = new Map<string, T[]>();
  for (const item of items) {
    const key = languageKey(item.language);
    const bucket = grouped.get(key) || [];
    bucket.push(item); grouped.set(key, bucket);
  }
  return [...grouped].map(([key, rows]) => {
    const topics = new Map<string, { name: string; total: number; negative: number; positive: number; neutral: number; unknown: number }>();
    const sentiment = { positive: 0, neutral: 0, negative: 0, unknown: 0 };
    for (const row of rows) {
      const bucket = row.sentiment === 'Positive' ? 'positive' : row.sentiment === 'Negative' ? 'negative' : row.sentiment === 'Neutral' ? 'neutral' : 'unknown';
      sentiment[bucket]++;
      const topic = row.topic?.trim();
      if (!topic || /^belum (diklasifikasi|dianalisis|terdeteksi)$/i.test(topic)) continue;
      const count = topics.get(topic) || { name: topic, total: 0, positive: 0, neutral: 0, negative: 0, unknown: 0 };
      count.total++; count[bucket]++; topics.set(topic, count);
    }
    const concerns = [...topics.values()].sort((a, b) => b.negative - a.negative || b.total - a.total || a.name.localeCompare(b.name, 'id'));
    return { key, label: languageLabel(key), total: rows.length, items: rows, ...sentiment, concerns };
  }).sort((a, b) => b.total - a.total || a.label.localeCompare(b.label, 'id'));
}
