import { test } from 'node:test';
import assert from 'node:assert/strict';
import { configuration, createSalesServer } from '../server.mjs';
const base = { SALES_SUPABASE_URL: 'https://example.supabase.co', SALES_SUPABASE_KEY: 'sb_publishable_test' };
const token = (sub = 'user-1', role = 'authenticated', exp = Math.floor(Date.now()/1000)+300) => `e30.${Buffer.from(JSON.stringify({ sub, role, exp })).toString('base64url')}.fixture`;
const principal = { userId: 'user-1', internalZntx: true, accessToken: token() };
async function serve(t, options) {
  const server = createSalesServer(options);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  return `http://127.0.0.1:${server.address().port}`;
}
test('reject privileged keys and unsafe origins', () => {
  assert.equal(configuration({}), null);
  assert.ok(configuration(base));
  for (const key of ['sb_secret_test', token('x','service_role'), token(), 'invalid']) assert.throws(() => configuration({ ...base, SALES_SUPABASE_KEY: key }));
  for (const url of ['http://example.supabase.co', 'https://localhost', 'https://example.supabase.co/path']) assert.throws(() => configuration({ ...base, SALES_SUPABASE_URL: url }));
  for (const name of ['SUPABASE_SECRET_KEY', 'SUPABASE_SERVICE_ROLE_KEY', 'CRAWLER_API_KEY', 'OPENAI_API_KEY']) assert.throws(() => configuration({ ...base, [name]: 'forbidden' }));
});
test('demo assets are public but API denies spoofed identity/bearer headers', async t => {
  let calls = 0;
  const origin = await serve(t, { config: configuration(base), fetcher: () => { calls++; throw Error(); } });
  for (const path of ['/api/items']) {
    assert.equal((await fetch(origin + path, { headers: { Authorization: `Bearer ${token()}`, 'oai-authenticated-user-id': 'user-1', 'oai-authenticated-user-email': 'internal@zntx.test' } })).status, 401);
  }
  assert.equal((await fetch(origin)).status, 200);
  assert.equal((await fetch(origin + '/healthz')).status, 200);
  assert.equal(calls, 0);
});
test('nonmembers, privileged tokens, expired tokens and adapter failures deny before DB', async t => {
  for (const identity of [{ ...principal, internalZntx: false }, { ...principal, accessToken: token('user-1','service_role') }, { ...principal, accessToken: token('other') }, { ...principal, accessToken: token('user-1','authenticated',1) }]) {
    const origin = await serve(t, { config: configuration(base), authenticate: async () => identity, fetcher: () => assert.fail('No DB request allowed') });
    assert.equal((await fetch(origin + '/api/items')).status, 403);
  }
  const origin = await serve(t, { config: configuration(base), authenticate: async () => { throw Error('private'); } });
  assert.equal((await fetch(origin + '/api/items')).status, 503);
});
test('mutations and old routes never reach upstream', async t => {
  const origin = await serve(t, { config: configuration(base), authenticate: async () => principal, fetcher: () => assert.fail('No outbound request') });
  for (const path of ['/api/items', '/api/crawler/ingest', '/api/crawler-config', '/api/media-partners', '/api/intelligence/items/id', '/api/intelligence/items/id/content']) {
    for (const method of ['POST','PUT','PATCH','DELETE','OPTIONS']) assert.equal((await fetch(origin + path, { method })).status, 405);
    if (path !== '/api/items') assert.equal((await fetch(origin + path)).status, 404);
  }
  assert.equal((await fetch(origin + '/api/items?select=*')).status, 400);
});
test('each request uses its verified user token with no cross-user cache', async t => {
  let calls = 0;
  const origin = await serve(t, { config: configuration(base), authenticate: async () => ({ ...principal, userId: `user-${++calls}`, accessToken: token(`user-${calls}`) }), fetcher: async (url, options) => {
    assert.equal(options.headers.Authorization, `Bearer ${token(`user-${calls}`)}`);
    assert.equal(options.method, 'GET'); assert.equal(options.redirect, 'error');
    assert.equal(url.pathname, '/rest/v1/crawl_items'); assert.equal(url.searchParams.get('limit'), '100');
    assert.ok(!url.searchParams.get('select').includes('raw_payload'));
    return Response.json([{ id: String(calls), title: 'Live', raw_payload: 'private' }]);
  } });
  for (const expected of ['1','2']) {
    const response = await fetch(origin + '/api/items'); const data = await response.json();
    assert.equal(data.items[0].id, expected); assert.equal(data.items[0].raw_payload, undefined);
    assert.ok(!JSON.stringify(data).includes('Bearer'));
  }
});
test('unconfigured and denied upstream do not fall back to anon/admin', async t => {
  const missing = await serve(t, { config: null, authenticate: async () => principal });
  assert.equal((await fetch(missing + '/api/items')).status, 503);
  const denied = await serve(t, { config: configuration(base), authenticate: async () => principal, fetcher: async () => new Response('private', { status: 403 }) });
  const response = await fetch(denied + '/api/items'); assert.equal(response.status, 502); assert.ok(!(await response.text()).includes('private'));
});
