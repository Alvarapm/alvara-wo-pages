import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
const source = readFileSync(new URL('../owner-approval.js', import.meta.url), 'utf8');
const html = readFileSync(new URL('../owner_approved.html', import.meta.url), 'utf8');
const token = 'a'.repeat(43);
const response = (state, extras = {}) => ({ ok: true, type: 'cors', status: 200, json: async () => ({ state, ...extras }) });
const tick = () => new Promise(resolve => setImmediate(resolve));
async function page(replies = [], search = '', hash = '#token=' + token) {
  const elements = new Map(); const calls = [];
  const get = id => { if (!elements.has(id)) elements.set(id, { hidden: true, disabled: false, textContent: '', addEventListener(event, fn) { this[event] = fn; } }); return elements.get(id); };
  vm.runInNewContext(source, { URLSearchParams, AbortController,
    document: { getElementById: get }, window: { location: { search, hash } },
    setTimeout: () => 1, clearTimeout() {},
    fetch: async (url, options) => { calls.push({ url, ...options }); const next = replies.shift(); if (next instanceof Error) throw next; return typeof next === 'function' ? next() : next; },
    sessionStorage: { getItem() { throw Error('must not trust local marker'); }, setItem() { throw Error('must not fabricate marker'); } },
  });
  await tick(); return { get, calls };
}
test('GET/load/preview does not approve; work-order label comes from server, not query', async () => {
  const p = await page([response('ready', { woNumber: '1001' })], '?wo=999&property=Forged');
  assert.equal(p.calls.length, 1); assert.equal(p.calls[0].method, 'GET');
  assert.equal(p.calls[0].headers.Authorization, 'Bearer ' + token);
  assert.equal(p.get('workOrder').textContent, 'Work order #1001');
  assert.equal(p.get('approve').hidden, false);
});
test('legacy/missing token sends nothing and gives fresh-link guidance', async () => {
  for (const query of ['', '?wo=1001&token=123']) {
    const p = await page([], query, ''); assert.equal(p.calls.length, 0);
    assert.match(p.get('message').textContent, /fresh link/); assert.equal(p.get('approve').hidden, true);
  }
});
test('explicit double click has one POST, no forged identity/time, and disables while pending', async () => {
  let resolve; const pending = new Promise(r => { resolve = r; });
  const p = await page([response('ready', { woNumber: '1001' }), () => pending]);
  const first = p.get('approve').click(); const second = p.get('approve').click();
  assert.equal(p.get('approve').disabled, true); assert.equal(p.calls.filter(c => c.method === 'POST').length, 1);
  assert.deepEqual(JSON.parse(p.calls[1].body), { token, action: 'approve' });
  assert.equal(p.calls[1].mode, 'cors');
  resolve(response('approved', { delivery: 'pending', woNumber: '1001' })); await Promise.all([first, second]);
  assert.match(p.get('title').textContent, /Approval recorded/);
  assert.match(p.get('message').textContent, /awaiting confirmation/);
});
test('opaque, rejection, 503 and lost response never become approval; retry starts with status GET', async () => {
  for (const failure of [new Error('offline'), { type: 'opaque', status: 0 }, { ...response('approved'), ok: false, status: 503 }]) {
    const p = await page([response('ready', { woNumber: '1001' }), failure, response('approved', { delivery: 'complete', woNumber: '1001' })]);
    await p.get('approve').click(); assert.match(p.get('title').textContent, /not confirmed/);
    assert.equal(p.get('approve').hidden, true); await p.get('check').click();
    assert.equal(p.calls[2].method, 'GET'); assert.match(p.get('title').textContent, /Approval recorded/);
  }
});
test('reload of committed pending approval reads only; continuation claim is not called complete', async () => {
  const p = await page([response('approved', { delivery: 'processing', woNumber: '1001' })]);
  assert.equal(p.calls[0].method, 'GET'); assert.equal(p.get('approve').hidden, true);
  assert.match(p.get('message').textContent, /awaiting confirmation/);
});
test('expired, settled, and unknown states cannot offer a fresh approval', async () => {
  for (const state of ['expired', 'closed', 'review_required', 'unverified']) {
    const p = await page([response(state)]); assert.equal(p.get('approve').hidden, true);
    assert.doesNotMatch(p.get('title').textContent, /^Approval recorded$/);
  }
});
test('no third-party assets/referrer leakage; accessible controls and contact path remain', () => {
  assert.match(html, /name="referrer" content="no-referrer"/);
  assert.match(html, /Content-Security-Policy/); assert.match(html, /aria-live="polite"/);
  assert.match(html, /Reply to the original Alvara email/); assert.doesNotMatch(html, /src="https:/);
});
