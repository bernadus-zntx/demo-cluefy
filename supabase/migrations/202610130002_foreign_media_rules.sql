insert into public.crawler_rules (code, rule_type, value, source, scope, interval_minutes, note, status)
values
  ('CRW-F01','url','abc.net.au','Media Asing · English','Australia · English',10,'Liputan ABC Australia tentang Badung, Kuta, Canggu, Seminyak, dan Nusa Dua','active'),
  ('CRW-F02','url','7news.com.au','Media Asing · English','Australia · English',10,'Liputan 7NEWS Australia tentang Bali selatan dan Kabupaten Badung','active'),
  ('CRW-F03','url','theguardian.com','Media Asing · English','Inggris · English',10,'Liputan The Guardian tentang pariwisata, lingkungan, dan pembangunan Bali','active'),
  ('CRW-F04','url','scmp.com','Media Asing · English','Hong Kong · English',10,'Liputan South China Morning Post tentang Canggu, Kuta, dan Badung','active'),
  ('CRW-F05','url','channelnewsasia.com','Media Asing · English','Singapura · English',10,'Liputan CNA tentang pariwisata dan isu publik Bali','active'),
  ('CRW-F06','keyword','バリ (クタ OR チャングー OR バドゥン)','Media Asing · 日本語','Jepang · 日本語',30,'Artikel media Jepang tentang Kuta, Canggu, dan Badung','active'),
  ('CRW-F07','keyword','Bali (Kuta OR Canggu OR Badung)','Media Asing · Deutsch','Jerman · Deutsch',30,'Artikel media berbahasa Jerman tentang Badung dan sekitarnya','active')
on conflict (code) do nothing;
