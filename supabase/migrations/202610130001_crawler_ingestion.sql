create extension if not exists pgcrypto;

create table if not exists public.crawler_rules (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  workspace_id text not null default 'kabupaten-badung',
  rule_type text not null check (rule_type in ('url','keyword','hashtag','author','social_account','social_group')),
  value text not null,
  source text not null,
  scope text not null default 'Badung · Indonesia',
  interval_minutes integer not null default 10 check (interval_minutes >= 5),
  note text not null default '',
  status text not null default 'active' check (status in ('active','paused')),
  last_run_at timestamptz,
  result_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists crawler_rules_identity_idx
  on public.crawler_rules (workspace_id, rule_type, lower(value), lower(source));
create index if not exists crawler_rules_active_idx
  on public.crawler_rules (status, interval_minutes, updated_at desc);

create table if not exists public.crawl_runs (
  id uuid primary key default gen_random_uuid(),
  workspace_id text not null default 'kabupaten-badung',
  status text not null default 'queued' check (status in ('queued','running','completed','partial','failed')),
  started_at timestamptz,
  completed_at timestamptz,
  rules_requested integer not null default 0,
  items_received integer not null default 0,
  items_inserted integer not null default 0,
  items_duplicate integer not null default 0,
  items_revised integer not null default 0,
  error_message text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.source_checkpoints (
  rule_id uuid primary key references public.crawler_rules(id) on delete cascade,
  cursor_value text,
  last_published_at timestamptz,
  last_success_at timestamptz,
  last_error_at timestamptz,
  error_message text,
  updated_at timestamptz not null default now()
);

create table if not exists public.crawl_items (
  id uuid primary key default gen_random_uuid(),
  workspace_id text not null default 'kabupaten-badung',
  source text not null,
  external_id text,
  original_url text not null,
  canonical_url text not null,
  canonical_url_hash text not null,
  content_hash text not null,
  title text not null,
  excerpt text,
  body text,
  author text,
  publisher text,
  platform text,
  language text,
  country text,
  location text,
  published_at timestamptz,
  captured_at timestamptz not null default now(),
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  raw_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists crawl_items_canonical_url_idx on public.crawl_items (canonical_url_hash);
create unique index if not exists crawl_items_source_external_idx
  on public.crawl_items (source, external_id) where external_id is not null;
create index if not exists crawl_items_published_idx on public.crawl_items (published_at desc);
create index if not exists crawl_items_content_hash_idx on public.crawl_items (content_hash);

create table if not exists public.crawl_item_rules (
  item_id uuid not null references public.crawl_items(id) on delete cascade,
  rule_id uuid not null references public.crawler_rules(id) on delete cascade,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  primary key (item_id, rule_id)
);

create table if not exists public.crawl_item_revisions (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.crawl_items(id) on delete cascade,
  previous_content_hash text not null,
  content_hash text not null,
  title text not null,
  excerpt text,
  body text,
  raw_payload jsonb not null default '{}'::jsonb,
  captured_at timestamptz not null default now()
);

create or replace function public.ingest_crawl_item(
  p_rule_id uuid,
  p_source text,
  p_external_id text,
  p_original_url text,
  p_canonical_url text,
  p_canonical_url_hash text,
  p_content_hash text,
  p_title text,
  p_excerpt text default null,
  p_body text default null,
  p_author text default null,
  p_publisher text default null,
  p_platform text default null,
  p_language text default null,
  p_country text default null,
  p_location text default null,
  p_published_at timestamptz default null,
  p_raw_payload jsonb default '{}'::jsonb
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item public.crawl_items%rowtype;
  v_action text := 'duplicate';
begin
  perform pg_advisory_xact_lock(hashtextextended(p_canonical_url_hash, 0));

  select * into v_item
  from public.crawl_items
  where canonical_url_hash = p_canonical_url_hash
     or (p_external_id is not null and source = p_source and external_id = p_external_id)
  order by created_at asc
  limit 1
  for update;

  if v_item.id is null then
    insert into public.crawl_items (
      source, external_id, original_url, canonical_url, canonical_url_hash, content_hash,
      title, excerpt, body, author, publisher, platform, language, country, location,
      published_at, raw_payload
    ) values (
      p_source, nullif(p_external_id,''), p_original_url, p_canonical_url, p_canonical_url_hash, p_content_hash,
      p_title, p_excerpt, p_body, p_author, p_publisher, p_platform, p_language, p_country, p_location,
      p_published_at, coalesce(p_raw_payload,'{}'::jsonb)
    ) returning * into v_item;
    v_action := 'inserted';
  elsif v_item.content_hash <> p_content_hash then
    insert into public.crawl_item_revisions (
      item_id, previous_content_hash, content_hash, title, excerpt, body, raw_payload
    ) values (
      v_item.id, v_item.content_hash, p_content_hash, p_title, p_excerpt, p_body, coalesce(p_raw_payload,'{}'::jsonb)
    );
    update public.crawl_items set
      content_hash = p_content_hash,
      title = p_title,
      excerpt = p_excerpt,
      body = p_body,
      author = p_author,
      publisher = p_publisher,
      platform = p_platform,
      language = p_language,
      country = p_country,
      location = p_location,
      published_at = coalesce(p_published_at, published_at),
      raw_payload = coalesce(p_raw_payload,'{}'::jsonb),
      last_seen_at = now(),
      updated_at = now()
    where id = v_item.id;
    v_action := 'revised';
  else
    update public.crawl_items set last_seen_at = now(), updated_at = now() where id = v_item.id;
  end if;

  insert into public.crawl_item_rules (item_id, rule_id)
  values (v_item.id, p_rule_id)
  on conflict (item_id, rule_id) do update set last_seen_at = now();

  update public.crawler_rules
  set last_run_at = now(), result_count = result_count + case when v_action = 'inserted' then 1 else 0 end, updated_at = now()
  where id = p_rule_id;

  return jsonb_build_object('item_id', v_item.id, 'action', v_action);
end;
$$;

revoke all on function public.ingest_crawl_item(uuid,text,text,text,text,text,text,text,text,text,text,text,text,text,text,text,timestamptz,jsonb) from public, anon, authenticated;
grant execute on function public.ingest_crawl_item(uuid,text,text,text,text,text,text,text,text,text,text,text,text,text,text,text,timestamptz,jsonb) to service_role;

alter table public.crawler_rules enable row level security;
alter table public.crawl_runs enable row level security;
alter table public.source_checkpoints enable row level security;
alter table public.crawl_items enable row level security;
alter table public.crawl_item_rules enable row level security;
alter table public.crawl_item_revisions enable row level security;

insert into public.crawler_rules (code, rule_type, value, source, scope, interval_minutes, note, status)
values
  ('CRW-001','url','badungkab.go.id','Website','Badung · Indonesia',10,'Berita dan pengumuman resmi Kabupaten Badung','active'),
  ('CRW-002','url','detik.com/bali','Media Online','Bali · Indonesia',10,'Halaman berita Bali dan sekitarnya','active'),
  ('CRW-003','keyword','Kabupaten Badung','Semua media','Indonesia',10,'Exact phrase dan variasi nama pemerintah daerah','active'),
  ('CRW-004','keyword','Canggu macet','Web & Social','Kuta Utara',10,'Kemacetan, lalu lintas, dan keluhan mobilitas','active'),
  ('CRW-005','hashtag','#Badung','Instagram · TikTok · X','Global',10,'Hashtag utama Kabupaten Badung','active'),
  ('CRW-006','hashtag','#Canggu','Instagram · TikTok','Global',10,'Percakapan lokal dan wisatawan','active'),
  ('CRW-007','author','Ni Luh Diah Prameswari','Lintas media','Bali · Indonesia',30,'Pantau byline dan publikasi lintas media','active'),
  ('CRW-008','social_account','@pemkabbadung','Instagram','Badung · Indonesia',10,'Akun resmi Pemkab Badung','active'),
  ('CRW-009','social_account','@dishubbadung','Instagram','Badung · Indonesia',10,'Informasi lalu lintas dan transportasi','active'),
  ('CRW-010','social_group','Info Badung & Sekitarnya','Facebook Group','Badung · Indonesia',30,'Hanya konten publik atau akses yang diotorisasi','paused')
on conflict (code) do nothing;
