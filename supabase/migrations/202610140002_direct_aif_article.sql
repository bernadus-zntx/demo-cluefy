insert into public.crawler_rules (code, rule_type, value, source, scope, interval_minutes, note, status)
values (
  'CRW-RU04',
  'url',
  'https://aif.ru/politics/world/toplivnyy-krizis-na-bali-pochemu-net-benzina-i-chto-delat-turistam',
  'Direct Article · Русский · Rusia',
  'Rusia · Русский',
  10,
  'Artikel langsung AIF tentang krisis BBM Bali dan dampaknya di Badung',
  'active'
)
on conflict do nothing;
