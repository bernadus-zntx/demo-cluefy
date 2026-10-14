insert into public.crawler_rules (code, rule_type, value, source, scope, interval_minutes, note, status)
values
  ('CRW-L01','url','balipost.com','Media Lokal · Indonesia','Bali · Indonesia',10,'Pantau berita Bali Post tentang Badung, Kuta, Canggu, Seminyak, dan Nusa Dua sejak 1 Oktober 2026','active'),
  ('CRW-L02','url','bali.tribunnews.com','Media Lokal · Indonesia','Bali · Indonesia',10,'Pantau berita Tribun Bali tentang Kabupaten Badung sejak 1 Oktober 2026','active'),
  ('CRW-L03','url','detik.com/bali','Media Lokal · Indonesia','Bali · Indonesia',10,'Pantau berita detikBali tentang Kabupaten Badung sejak 1 Oktober 2026','active'),
  ('CRW-L04','url','bali.antaranews.com','Media Lokal · Indonesia','Bali · Indonesia',10,'Pantau berita ANTARA Bali tentang Kabupaten Badung sejak 1 Oktober 2026','active'),
  ('CRW-L05','url','kompas.com','Media Lokal · Indonesia','Jakarta · Indonesia',10,'Pantau berita Kompas.com tentang Kabupaten Badung sejak 1 Oktober 2026','active'),
  ('CRW-L06','url','mongabay.co.id','Media Lokal · Indonesia','Jakarta · Indonesia',10,'Pantau berita Mongabay Indonesia tentang lingkungan di Kabupaten Badung sejak 1 Oktober 2026','active'),
  ('CRW-A01','author','Ayu Lestari','Penulis · Lintas Media','Denpasar, Bali · Indonesia',10,'Pantau byline Ayu Lestari pada berita Bali dan Badung sejak 1 Oktober 2026','active'),
  ('CRW-A02','author','I Made Surya Wijaya','Penulis · Lintas Media','Badung, Bali · Indonesia',10,'Pantau byline I Made Surya Wijaya pada berita Bali dan Badung sejak 1 Oktober 2026','active'),
  ('CRW-A03','author','Raka Putra','Penulis · Lintas Media','Bali · Indonesia',10,'Pantau byline Raka Putra pada berita Bali dan Badung sejak 1 Oktober 2026','active'),
  ('CRW-A04','author','Ni Luh Diah Prameswari','Penulis · Lintas Media','Badung, Bali · Indonesia',10,'Pantau byline Ni Luh Diah Prameswari pada berita Bali dan Badung sejak 1 Oktober 2026','active'),
  ('CRW-A05','author','Kadek Mahendra','Penulis · Lintas Media','Denpasar, Bali · Indonesia',10,'Pantau byline Kadek Mahendra pada berita Bali dan Badung sejak 1 Oktober 2026','active'),
  ('CRW-RU01','keyword','Бали (Кута OR Чангу OR Бадунг)','Media Asing · Русский · Rusia','Rusia · Русский',10,'Berita berbahasa Rusia tentang Badung dan sekitarnya sejak 1 Oktober 2026','active'),
  ('CRW-RU02','url','aif.ru','Media Asing · Русский · Rusia','Rusia · Русский',10,'Liputan AIF berbahasa Rusia tentang Bali selatan sejak 1 Oktober 2026','active'),
  ('CRW-RU03','url','osnmedia.ru','Media Asing · Русский · Rusia','Rusia · Русский',10,'Liputan OSN Media berbahasa Rusia tentang Bali selatan sejak 1 Oktober 2026','active'),
  ('CRW-UA01','keyword','Балі (Кута OR Чангу OR Бадунг)','Media Asing · Українська · Ukraina','Ukraina · Українська',10,'Berita berbahasa Ukraina tentang Badung dan sekitarnya sejak 1 Oktober 2026','active'),
  ('CRW-UA02','url','unn.ua','Media Asing · Українська · Ukraina','Ukraina · Українська',10,'Liputan UNN berbahasa Ukraina tentang Bali selatan sejak 1 Oktober 2026','active'),
  ('CRW-UA03','url','focus.ua','Media Asing · Українська · Ukraina','Ukraina · Українська',10,'Liputan Focus berbahasa Ukraina tentang Bali selatan sejak 1 Oktober 2026','active'),
  ('CRW-US01','keyword','Bali (Kuta OR Canggu OR Badung)','Media Asing · English · USA','Amerika Serikat · English',10,'Hasil Google News edisi Amerika tentang Badung dan sekitarnya sejak 1 Oktober 2026','active'),
  ('CRW-US02','url','apnews.com','Media Asing · English · USA','Amerika Serikat · English',10,'Liputan AP News tentang Bali selatan sejak 1 Oktober 2026','active'),
  ('CRW-US03','url','cnn.com','Media Asing · English · USA','Amerika Serikat · English',10,'Liputan CNN tentang Bali selatan sejak 1 Oktober 2026','active'),
  ('CRW-US04','url','usatoday.com','Media Asing · English · USA','Amerika Serikat · English',10,'Liputan USA Today tentang Bali selatan sejak 1 Oktober 2026','active')
on conflict do nothing;
