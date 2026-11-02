export type RegionalFilterRecord = {sourceType:string;media:string;sentiment:string;district:string;village:string;severity:string;text:string;author:string;account:string;topic:string};
export type RegionalFilters = {source:string;sentiment:string;district:string;village:string;severity:string;query:string;topic:string};

export function filterRegionalRecords<T extends RegionalFilterRecord>(records:T[], filters:RegionalFilters):T[] {
  const query=filters.query.trim().toLowerCase();
  return records.filter(record =>
    (filters.source==='Semua sumber'||record.sourceType===filters.source||record.media===filters.source)&&
    (filters.sentiment==='Semua sentimen'||record.sentiment===filters.sentiment)&&
    (filters.district==='Semua kecamatan'||record.district===filters.district)&&
    (filters.village==='Semua desa/kelurahan'||record.village===filters.village)&&
    (filters.severity==='Semua severity'||record.severity===filters.severity)&&
    (filters.topic==='Semua isu'||record.topic===filters.topic)&&
    (!query||`${record.text} ${record.author} ${record.account}`.toLowerCase().includes(query))
  );
}
