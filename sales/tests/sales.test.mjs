import { test } from 'node:test';
import assert from 'node:assert/strict';
import { configuration, createDatabase, assertPermissions, permissionSql, articleSql } from '../database.mjs';
import { createSalesServer } from '../server.mjs';
const env = { SALES_DATABASE_URL: 'postgresql://cluefy_sales_reader:fixture@db.example.supabase.co:5432/postgres' };
const allowed = { role:'cluefy_sales_reader', privileged:false, memberships:false, writable:false, schema_create:false, database_create:false, definer_execute:false, sequence_write:false, rls_enabled:true, reader_policy:true, can_read:true };
async function serve(t, options) {
  const server = createSalesServer(options);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  return `http://127.0.0.1:${server.address().port}`;
}
function fakePool({ permissions = allowed, failArticle = false, failRollback = false } = {}) {
  const queries = []; const releases = []; let settings;
  class Pool {
    constructor(options) { settings = options; }
    on() {}
    async connect() { return { query: async sql => {
      queries.push(sql);
      if (sql === permissionSql) return {rows:[permissions]};
      if (sql === articleSql) { if (failArticle) throw Error('private password'); return { rows:[{id:'live-id',title:'Live'}] }; }
      if (sql === 'ROLLBACK' && failRollback) throw Error('broken socket');
      return {rows:[]};
    }, release: broken => releases.push(broken) }; }
    async end() {}
  }
  return { Pool, queries, releases, settings: () => settings };
}
test('configuration accepts dedicated hosted role only and rejects URL SSL overrides', () => {
  assert.equal(configuration({}),null);
  assert.ok(configuration(env));
  assert.throws(()=>configuration({...env,NODE_TLS_REJECT_UNAUTHORIZED:'0'}));
  assert.ok(configuration({ SALES_DATABASE_URL:'postgresql://cluefy_sales_reader.project:fixture@aws-0-region.pooler.supabase.com:5432/postgres' }));
  for (const url of [env.SALES_DATABASE_URL.replace('cluefy_sales_reader','postgres'), env.SALES_DATABASE_URL+'?sslmode=disable',env.SALES_DATABASE_URL.replace('db.example.supabase.co','localhost'),env.SALES_DATABASE_URL.replace(':fixture',''), 'invalid']) assert.throws(()=>configuration({SALES_DATABASE_URL:url}));
  for (const key of ['SUPABASE_SECRET_KEY','SUPABASE_SERVICE_ROLE_KEY','SALES_SUPABASE_KEY','CRAWLER_API_KEY']) assert.throws(()=>configuration({...env,[key]:'forbidden'}));
});
test('effective privilege audit refuses every unsafe/missing flag and unexpected role', () => {
  assert.doesNotThrow(()=>assertPermissions(allowed));
  for (const key of Object.keys(allowed).filter(x=>x!=='role')) assert.throws(()=>assertPermissions({...allowed,[key]:!allowed[key]}));
  assert.throws(()=>assertPermissions({...allowed,role:'postgres'}));
  assert.throws(()=>assertPermissions(null));
});
test('TLS verification, read-only transaction, privilege check precede fixed bounded SELECT', async () => {
  const mock = fakePool(); const db = await createDatabase(configuration(env),mock.Pool);
  assert.equal(mock.settings().ssl.rejectUnauthorized,true);
  assert.equal(mock.settings().max,2);
  assert.equal((await db.readArticles())[0].id,'live-id');
  assert.deepEqual(mock.queries,['BEGIN READ ONLY',"SET LOCAL statement_timeout = '8s'",permissionSql,articleSql,'COMMIT']);
  assert.match(articleSql,/LIMIT 100$/); assert.ok(!articleSql.includes('raw_payload'));
  assert.deepEqual(mock.releases,[false]); await db.close();
});
test('unsafe grants prevent article SELECT; failed reads rollback and release/destroy connection', async () => {
  const unsafe = fakePool({permissions:{...allowed,writable:true}});
  await assert.rejects((await createDatabase(configuration(env),unsafe.Pool)).readArticles());
  assert.ok(!unsafe.queries.includes(articleSql)); assert.equal(unsafe.queries.at(-1),'ROLLBACK');
  const broken = fakePool({failArticle:true,failRollback:true});
  await assert.rejects((await createDatabase(configuration(env),broken.Pool)).readArticles());
  assert.deepEqual(broken.releases,[true]);
});
test('GET proxy works without session, projects only seven fields, caps 100 and hides credentials', async t => {
  const origin = await serve(t,{config:configuration(env),database:{readArticles:async()=>Array.from({length:120},(_,id)=>({id:String(id),title:'<script>text</script>',raw_payload:'private',password:'fixture'}))}});
  const response = await fetch(origin+'/api/items'); const body = await response.json();
  assert.equal(response.status,200); assert.equal(body.items.length,100);
  assert.equal(Object.keys(body.items[0]).length,7); assert.equal(body.items[0].raw_payload,undefined);
  assert.ok(!JSON.stringify(body).includes('fixture')); assert.ok(!JSON.stringify(body).includes('postgresql:'));
  assert.equal(body.items[0].title,'<script>text</script>');
});
test('all mutation methods, query injection and old routes cause zero database reads', async t => {
  let calls=0;
  const origin=await serve(t,{config:configuration(env),database:{readArticles:async()=>{calls++;return [];}}});
  for(const path of ['/api/items','/api/crawler/ingest','/api/media-partners','/api/intelligence/items/id','/api/crawler-config']) {
    for(const method of ['POST','PUT','PATCH','DELETE','OPTIONS']) assert.equal((await fetch(origin+path,{method})).status,405);
    if(path!=='/api/items') assert.equal((await fetch(origin+path)).status,404);
  }
  for(const query of ['?select=*','?limit=100000','?sql=delete','?cursor=1']) assert.equal((await fetch(origin+'/api/items'+query)).status,400);
  assert.equal(calls,0);
});
test('unconfigured, failed DB and empty results have explicit sanitized responses', async t => {
  const missing=await serve(t,{config:null}); assert.equal((await fetch(missing+'/api/items')).status,503);
  const failed=await serve(t,{config:configuration(env),database:{readArticles:async()=>{throw Error(env.SALES_DATABASE_URL);}}});
  const response=await fetch(failed+'/api/items'); assert.equal(response.status,502); assert.ok(!(await response.text()).includes('fixture'));
  const empty=await serve(t,{config:configuration(env),database:{readArticles:async()=>[]}});
  assert.deepEqual((await (await fetch(empty+'/api/items')).json()).items,[]);
});
test('existing login and Sales assets preserve fields, logo and restrictive CSP', async t => {
  const origin=await serve(t,{config:null}); const response=await fetch(origin); const html=await response.text();
  for(const label of ['ORGANIZATION','ROLE (SIMULASI)','EMAIL ADDRESS','PASSWORD','Kabupaten Badung','ClueBeauty Indonesia','OLX Indonesia']) assert.ok(html.includes(label));
  assert.equal((await fetch(origin+'/sales')).status,200);
  assert.ok(response.headers.get('content-security-policy').includes("connect-src 'self'"));
  const image=await fetch(origin+'/cluefy-icon-exact.png'); assert.equal(image.headers.get('content-type'),'image/png');
  assert.deepEqual([...new Uint8Array(await image.arrayBuffer()).slice(0,8)],[137,80,78,71,13,10,26,10]);
});
