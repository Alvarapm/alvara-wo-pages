/* The API is the only authority. No local storage marker can stand in for a committed receipt. */
(function () {
  'use strict';
  var API = 'https://maintenance-ivory-kappa.vercel.app/api/webhooks/owner-approval';
  var token = new URLSearchParams(window.location.hash.slice(1)).get('token') ||
    new URLSearchParams(window.location.search).get('token') || '';
  var el = function (id) { return document.getElementById(id); };
  var busy = false;
  var canApprove = false;
  var pollCount = 0;
  var pollTimer;

  function show(data) {
    canApprove = false;
    el('approve').hidden = true;
    el('check').hidden = true;
    el('attribution').hidden = true;
    el('workOrder').hidden = !data.woNumber;
    el('workOrder').textContent = data.woNumber ? 'Work order #' + data.woNumber : '';
    if (data.state === 'ready') {
      el('title').textContent = 'Approve this work order?';
      el('message').textContent = 'Review the details in your Alvara email. Approval is recorded only when you press the button below.';
      el('attribution').hidden = false;
      el('approve').textContent = 'Approve this work order';
      el('approve').hidden = false;
      canApprove = true;
    } else if (data.state === 'approved') {
      el('title').textContent = 'Approval recorded';
      el('message').textContent = data.delivery === 'complete' ? 'Your approval and the office update are recorded. You can close this page.' :
        'Your approval is recorded. The office update is still awaiting confirmation. You can check its status or contact Alvara if it remains pending.';
      el('check').hidden = data.delivery === 'complete';
      if (data.delivery === 'pending') {
        el('approve').textContent = 'Retry office update';
        el('approve').hidden = false;
        canApprove = true;
      }
      if (data.delivery !== 'complete' && pollCount < 6) {
        pollCount += 1;
        pollTimer = setTimeout(checkStatus, 2000);
      }
    } else if (data.state === 'closed') {
      el('title').textContent = 'This request is already settled';
      el('message').textContent = 'No new approval was recorded using this link. Reply to the original Alvara email if you need to discuss the decision.';
    } else if (data.state === 'unavailable' || data.state === 'expired') {
      el('title').textContent = 'A fresh approval link is needed';
      el('message').textContent = 'This link is expired or cannot be verified. It has not recorded an approval. Please request a fresh link by replying to the original Alvara email.';
    } else {
      el('title').textContent = 'Approval status is not confirmed';
      el('message').textContent = 'We could not verify the result. A previous request may still be processing. Check again before retrying, or reply to the original Alvara email for help.';
      el('check').hidden = false;
    }
  }

  async function request(method) {
    var controller = new AbortController();
    var timeout = setTimeout(function () { controller.abort(); }, 12000);
    try {
      var response = await fetch(API, {
        method: method, mode: 'cors', credentials: 'omit', cache: 'no-store', referrerPolicy: 'no-referrer',
        signal: controller.signal,
        headers: method === 'POST' ? { 'Content-Type': 'application/json' } : { Authorization: 'Bearer ' + token },
        body: method === 'POST' ? JSON.stringify({ token: token, action: 'approve' }) : undefined
      });
      if (response.type === 'opaque' || response.status === 0) throw new Error('unverified');
      var data = await response.json();
      if (!response.ok && !['expired', 'unavailable', 'closed', 'review_required'].includes(data.state)) throw new Error('unverified');
      return data;
    } finally { clearTimeout(timeout); }
  }

  async function run(method) {
    if (busy) return;
    busy = true;
    clearTimeout(pollTimer);
    el('approve').disabled = true;
    el('check').disabled = true;
    try { show(await request(method)); }
    catch (_) { show({ state: 'unverified' }); }
    finally { busy = false; el('approve').disabled = false; el('check').disabled = false; }
  }
  function checkStatus() { return run('GET'); }
  el('approve').addEventListener('click', function () { if (canApprove) return run('POST'); });
  el('check').addEventListener('click', checkStatus);
  // Legacy token=123 never reaches a write path. A preview, reload and polling only GET status.
  if (/^[A-Za-z0-9_-]{43}$/.test(token)) checkStatus();
  else show({ state: 'unavailable' });
}());
