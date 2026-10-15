insert into public.crawler_rules (code, rule_type, value, source, scope, interval_minutes, note, status)
values
  ('CRW-FB01','social_account','baliinfoofficial','Facebook Public Page','Bali · Indonesia',10,'Pantau posting publik https://www.facebook.com/baliinfoofficial','active'),
  ('CRW-FB02','social_account','OfficialBadungTourism','Facebook Public Page','Badung · Indonesia',10,'Pantau posting publik https://www.facebook.com/OfficialBadungTourism','active'),
  ('CRW-FB03','social_account','tribunbali','Facebook Public Page','Bali · Indonesia',10,'Pantau posting publik https://www.facebook.com/tribunbali','active'),
  ('CRW-FB04','social_account','UnikNews1','Facebook Public Page','Bali · Indonesia',10,'Pantau posting publik https://www.facebook.com/UnikNews1','active')
on conflict do nothing;
