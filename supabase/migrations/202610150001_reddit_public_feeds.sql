insert into public.crawler_rules (code, rule_type, value, source, scope, interval_minutes, note, status)
values
  ('CRW-RD01','keyword','Badung OR "Kuta Bali" OR Canggu OR Seminyak OR "Nusa Dua" OR Jimbaran OR Uluwatu','Reddit Public RSS','Global',10,'Pantau posting Reddit publik tentang Badung dan Bali selatan melalui RSS tanpa login','active'),
  ('CRW-RD02','social_group','r/bali','Reddit Public RSS','Bali · Indonesia',10,'Pantau posting publik r/bali yang berkaitan dengan Badung, Kuta, Canggu, dan sekitarnya','active'),
  ('CRW-RD03','social_group','r/indonesia','Reddit Public RSS','Indonesia',10,'Pantau posting publik r/indonesia yang berkaitan dengan Kabupaten Badung dan Bali selatan','active')
on conflict do nothing;
