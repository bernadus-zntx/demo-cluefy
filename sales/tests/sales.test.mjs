import { test } from 'node:test';
import assert from 'node:assert/strict';
import { configuration, createSalesServer } from '../server.mjs';
const base = { SALES_SUPABASE_URL: 'https://example.supabase.co', SALES_SUPABASE_KEY: 'sb_publishable_test' };
const jwt = role => `e30.${Buffer.from(JSON.stringify({ role })).toString('base64url')}.signature`;
test('configuration fails closed for privileged keys and unsafe origins', () => {
  assert.equal(configuration({}), null);
  assert.ok(configuration(base));
  assert.ok(configuration({ ...base, SALES_SUPABASE_KEY: jwt('anon') }));
  for (const key of ['sb_secret_test', jwt('service_role'), jwt('authenticated'), 'invalid']) assert.throws(() => configuration({ ...base, SALES_SUPABASE_KEY: key }));
  for (const url of ['http://example.supabase.co', 'https://localhost', 'https://example.supabase.co/path', 'https://example.supabase.co/?x=1']) assert.throws(() => configuration({ ...base, SALES_SUPABASE_URL: url }));
  for (const name of ['SUPABASE_SECRET_KEY', 'SUPABASE_SERVICE_ROLE_KEY', 'CRAWLER_API_KEY', 'OPENAI_API_KEY']) assert.throws(() => configuration({ ...base, [name]: 'forbidden' }));
});
async function serve(t, options) {
  const server = createSalesServer(options);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  return `http://127.0.0.1:${server.address().port}`;
}
test('all mutation methods and old routes cause zero outbound requests', async t => {
  let calls = 0;
  const origin = await serve(t, { config: configuration(base), fetcher: () => { calls++; throw Error(); } });
  for (const path of ['/api/items', '/api/crawler/ingest', '/api/crawler-config', '/api/media-partners', '/api/intelligence/items/id', '/api/intelligence/items/id/content']) {
    for (const method of ['POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS']) assert.equal((await fetch(origin + path, { method })).status, 405);
    if (path !== '/api/items') assert.equal((await fetch(origin + path)).status, 404);
  }
  assert.equal((await fetch(origin + '/api/items?select=*')).status, 400);
  assert.equal(calls, 0);
});
test('fixed GET projection, redacted payload, cache, and browser has no key', async t => {
  let calls = 0;
  const origin = await serve(t, { config: configuration(base), fetcher: async (url, options) => {
    calls++;
    assert.equal(url.origin, base.SALES_SUPABASE_URL);
    assert.equal(url.pathname, '/rest/v1/crawl_items');
    assert.equal(url.searchParams.get('limit'), '100');
    assert.ok(!url.searchParams.get('select').includes('raw_payload'));
    assert.equal(options.method, 'GET'); assert.equal(options.redirect, 'error');
    assert.equal(options.headers.apikey, base.SALES_SUPABASE_KEY);
    assert.equal(options.headers.Authorization, undefined);
    return Response.json([{ id: '1', title: '<script>test</script>', raw_payload: { secret: 'hidden' } }]);
  } });
  const responses = await Promise.all([fetch(origin + '/api/items'), fetch(origin + '/api/items')]);
  for (const response of responses) {
    const data = await response.json();
    assert.equal(data.items[0].title, '<script>test</script>');
    assert.equal(data.items[0].raw_payload, undefined);
    assert.ok(!JSON.stringify(data).includes(base.SALES_SUPABASE_KEY));
  }
  assert.equal(calls, 1);
  const html = await fetch(origin);
  assert.ok(html.headers.get('content-security-policy').includes("connect-src 'self'"));
  assert.ok(!(await html.text()).includes(base.SALES_SUPABASE_KEY));
});
test('unconfigured, empty RLS response and upstream failures are explicit', async t => {
  const missing = await serve(t, { config: null });
  assert.equal((await fetch(missing + '/api/items')).status, 503);
  const empty = await serve(t, { config: configuration(base), fetcher: async () => Response.json([]) });
  assert.match((await (await fetch(empty + '/api/items')).json()).message, /RLS/);
  const denied = await serve(t, { config: configuration(base), fetcher: async () => new Response('sensitive upstream details', { status: 403 }) });
  const response = await fetch(denied + '/api/items');
  assert.equal(response.status, 502); assert.ok(!(await response.text()).includes('sensitive'));
});
