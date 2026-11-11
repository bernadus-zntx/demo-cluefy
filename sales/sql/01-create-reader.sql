-- REVIEW ONLY. Run manually as project database administrator AFTER approval.
-- Not a migration; not invoked by app, Docker or CI. Deliberately fail on rerun.
-- Password is set separately using psql \password (never store it in this file).
BEGIN;
CREATE ROLE cluefy_sales_reader LOGIN NOINHERIT NOSUPERUSER NOCREATEDB
  NOCREATEROLE NOREPLICATION NOBYPASSRLS CONNECTION LIMIT 3;
ALTER ROLE cluefy_sales_reader SET default_transaction_read_only = on;
ALTER ROLE cluefy_sales_reader SET statement_timeout = '8s';
ALTER ROLE cluefy_sales_reader SET idle_in_transaction_session_timeout = '10s';
ALTER ROLE cluefy_sales_reader SET search_path = pg_catalog;
GRANT CONNECT ON DATABASE postgres TO cluefy_sales_reader;
GRANT USAGE ON SCHEMA public TO cluefy_sales_reader;
GRANT SELECT (id,title,excerpt,publisher,platform,location,published_at)
  ON TABLE public.crawl_items TO cluefy_sales_reader;
-- Require existing RLS; do not change its state or any existing policies.
DO $$ BEGIN
  IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid='public.crawl_items'::regclass) THEN
    RAISE EXCEPTION 'crawl_items must already have RLS enabled; review manually';
  END IF;
END $$;
-- Only this dedicated login can use this SELECT policy. No anon/authenticated grant.
-- All crawl_items rows are readable for internal Sales, only granted columns.
CREATE POLICY cluefy_sales_reader_select ON public.crawl_items
  FOR SELECT TO cluefy_sales_reader USING (true);
COMMIT;
-- Next, interactive psql: \password cluefy_sales_reader
-- Never grant this role to authenticator/anon/authenticated or another role.
