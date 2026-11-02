// Administrative hierarchy: https://pn-denpasar.go.id/tentang-pengadilan/wilayah-yurisdiksi
// Use only location metadata, never article text, to avoid counting incidental place mentions.
export const districtVillages: Record<string, string[]> = {
  Kuta: ['Tuban', 'Seminyak', 'Legian', 'Kuta', 'Kedonganan'],
  'Kuta Selatan': ['Tanjung Benoa', 'Jimbaran', 'Benoa', 'Pecatu', 'Ungasan', 'Kutuh'],
  'Kuta Utara': ['Kerobokan Kelod', 'Kerobokan Kaja', 'Kerobokan', 'Tibubeneng', 'Canggu', 'Dalung'],
  Mengwi: ['Sempidi', 'Sading', 'Lukluk', 'Kapal', 'Abianbase', 'Munggu', 'Buduk', 'Mengwitani', 'Penarungan', 'Sembung', 'Baha', 'Mengwi', 'Kekeran', 'Sobangan', 'Gulingan', 'Werdi Bhuwana', 'Cemagi', 'Pererenan', 'Tumbak Bayuh', 'Kuwum'],
  Abiansemal: ['Darmasaba', 'Sibang Kaja', 'Sibang Gede', 'Jagapati', 'Angantaka', 'Sedang', 'Mambal', 'Abiansemal', 'Bongkasa', 'Taman', 'Blahkiuh', 'Ayunan', 'Sangeh', 'Punggul', 'Mekar Bhuana', 'Dauh Yeh Cani', 'Selat', 'Bongkasa Pertiwi'],
  Petang: ['Carangsari', 'Petang', 'Belok Sidan', 'Pelaga', 'Getasan', 'Pangsan', 'Sulangai'],
};

type Located = { location: string | null; village: string | null };
type Analyzed = Located & { sentiment: string | null; severity: string | null; topic: string | null };
export type LocationCounts = { total: number; positive: number; neutral: number; negative: number; unknown: number };
const normalize = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const aliases: Record<string, string[]> = {
  'Tibubeneng': ['tibubeneng'], 'Tumbak Bayuh': ['tumbakbayuh'], 'Kuwum': ['kuwun'],
  'Mekar Bhuana': ['mekar bhuwana', 'mekarbhuana'], 'Werdi Bhuwana': ['werdi bhuana', 'werdibhuwana'],
  'Sibang Kaja': ['sibangkaja'], 'Sibang Gede': ['sibanggede'],
};
const entries = Object.entries(districtVillages).flatMap(([district, villages]) => villages.map(village => ({ district, village, names: [normalize(village), ...(aliases[village] || [])] })));
const contains = (text: string, name: string) => (` ${text} `).includes(` ${name} `);
function villageMatches(value: string, allowDistrictName: boolean) {
  const text = normalize(value);
  const matches = entries.filter(entry => entry.names.some(name => contains(text, name)) &&
    !(entry.village === 'Kuta' && /\bkuta (utara|selatan)\b/.test(text)) &&
    (!['Taman', 'Sedang', 'Selat', 'Kapal'].includes(entry.village) || entry.names.includes(text) || contains(text, `desa ${normalize(entry.village)}`) || contains(text, `kelurahan ${normalize(entry.village)}`)) &&
    (allowDistrictName || !districtVillages[entry.village] || contains(text, `desa ${normalize(entry.village)}`) || contains(text, `kelurahan ${normalize(entry.village)}`)));
  // Kerobokan Kaja, Tanjung Benoa, Bongkasa Pertiwi, etc. must not also match their parent substring.
  return matches.filter(entry => !matches.some(other => other !== entry && other.names.some(long => entry.names.some(short => long !== short && contains(long, short)))));
}

export function resolveDistrictLocation(item: Located): { district: string | null; village: string | null } {
  const location = normalize(item.location || '');
  const explicit = Object.keys(districtVillages).filter(name => contains(location, normalize(name)))
    .filter(name => name !== 'Kuta' || !/kuta (utara|selatan)/.test(location));
  const villageField = villageMatches(item.village || '', true);
  const locationVillages = villageMatches(item.location || '', false);
  const candidates = villageField.length ? villageField : locationVillages;
  const candidateDistricts = [...new Set(candidates.map(entry => entry.district))];
  const locationConflict = !villageField.length && explicit.length === 1 && candidateDistricts.some(name => name !== explicit[0]);
  let district = locationConflict ? null : explicit.length === 1 ? explicit[0] : explicit.length ? null : candidateDistricts.length === 1 ? candidateDistricts[0] : null;
  if (!district && !explicit.length && !candidateDistricts.length) {
    if (/\bnusa dua\b/.test(location)) district = 'Kuta Selatan';
    else if (/\bberawa\b/.test(location)) district = 'Kuta Utara';
  }
  const matching = candidates.filter(entry => entry.district === district);
  return { district, village: candidates.length === 1 && matching.length === 1 ? matching[0].village : null };
}

export function countLocationSentiments(items: { sentiment: string | null }[]): LocationCounts {
  const counts = { total: items.length, positive: 0, neutral: 0, negative: 0, unknown: 0 };
  for (const item of items) {
    if (item.sentiment === 'Positive') counts.positive++;
    else if (item.sentiment === 'Neutral') counts.neutral++;
    else if (item.sentiment === 'Negative') counts.negative++;
    else counts.unknown++;
  }
  return counts;
}

export function analyzeDistricts<T extends Analyzed>(items: T[]) {
  const located = items.map(item => ({ item, ...resolveDistrictLocation(item) }));
  return Object.entries(districtVillages).map(([name, villages]) => {
    const rows = located.filter(row => row.district === name);
    const subset = rows.map(row => row.item);
    const topics = new Map<string, number>();
    for (const item of subset) if (item.topic) topics.set(item.topic, (topics.get(item.topic) || 0) + 1);
    const villageRows = [...villages, 'Belum terpetakan'].map(village => ({
      name: village, ...countLocationSentiments(rows.filter(row => (row.village || 'Belum terpetakan') === village).map(row => row.item)),
    })).sort((a, b) => b.total - a.total || a.name.localeCompare(b.name, 'id'));
    return { name, ...countLocationSentiments(subset), items: subset, villages: villageRows,
      needs: subset.filter(item => item.sentiment === 'Negative' || ['High', 'Critical'].includes(item.severity || '')).length,
      mainTopic: [...topics].sort((a, b) => b[1] - a[1])[0]?.[0] || 'Belum terdeteksi',
    };
  }).sort((a, b) => b.total - a.total || a.name.localeCompare(b.name, 'id'));
}
