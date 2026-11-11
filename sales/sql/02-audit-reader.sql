-- Read-only catalog inspection; run as administrator after manual provisioning.
BEGIN READ ONLY;
SELECT rolname,rolsuper,rolinherit,rolcreaterole,rolcreatedb,rolreplication,rolbypassrls,rolconfig
FROM pg_roles WHERE rolname='cluefy_sales_reader';
SELECT parent.rolname AS granted_role, child.rolname AS member
FROM pg_auth_members m JOIN pg_roles parent ON parent.oid=m.roleid
JOIN pg_roles child ON child.oid=m.member
WHERE child.rolname='cluefy_sales_reader' OR parent.rolname='cluefy_sales_reader';
SELECT n.nspname,c.relname,c.relkind,
 has_table_privilege('cluefy_sales_reader',c.oid,'INSERT,UPDATE,DELETE,TRUNCATE,TRIGGER,REFERENCES') AS table_write,
 has_any_column_privilege('cluefy_sales_reader',c.oid,'INSERT,UPDATE,REFERENCES') AS column_write
FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
WHERE n.nspname NOT IN ('pg_catalog','information_schema') AND n.nspname NOT LIKE 'pg_%'
AND c.relkind IN ('r','p','v','m','f')
AND (has_table_privilege('cluefy_sales_reader',c.oid,'INSERT,UPDATE,DELETE,TRUNCATE,TRIGGER,REFERENCES')
 OR has_any_column_privilege('cluefy_sales_reader',c.oid,'INSERT,UPDATE,REFERENCES'));
SELECT n.nspname,p.proname,p.oid::regprocedure
FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
WHERE n.nspname NOT IN ('pg_catalog','information_schema') AND n.nspname NOT LIKE 'pg_%'
AND p.prosecdef AND has_schema_privilege('cluefy_sales_reader',n.oid,'USAGE')
AND has_function_privilege('cluefy_sales_reader',p.oid,'EXECUTE');
SELECT * FROM pg_policies WHERE schemaname='public' AND tablename='crawl_items';
SELECT column_name,has_column_privilege('cluefy_sales_reader','public.crawl_items',column_name,'SELECT') AS readable
FROM information_schema.columns WHERE table_schema='public' AND table_name='crawl_items';
SELECT nspname FROM pg_namespace WHERE nspname NOT LIKE 'pg_%'
AND nspname <> 'information_schema' AND has_schema_privilege('cluefy_sales_reader',oid,'CREATE');
SELECT has_database_privilege('cluefy_sales_reader','postgres','CREATE') AS database_create;
SELECT n.nspname,c.relname FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
WHERE c.relkind='S' AND n.nspname NOT LIKE 'pg_%'
AND has_sequence_privilege('cluefy_sales_reader',c.oid,'USAGE,UPDATE');
COMMIT;
