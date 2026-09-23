# Alvara work-order pages

## Owner approval (BL-74a)

`owner_approved.html` loads only a read-only native status request. An explicit button performs
approval through the native CORS endpoint. The native receiver supplies recipient attribution and
server time; a forwarded link does not prove the physical identity of its user. The page receives
no recipient PII and does not trust URL-supplied property/work-order labels or browser storage.

New links use `#token=<opaque capability>`. Tokens in a fragment do not reach the static server;
no-referrer and a restrictive CSP prevent disclosure to other assets. Legacy `token=123` links are
unverifiable and direct the recipient to reply to the original Alvara email for a fresh link.
Opaque, failed and timed-out requests never imply successful approval. Recorded approval and
pending office delivery are separate; retrying an uncertain response first reads native status.

Tests (Node 20+, no dependencies):

```sh
node --test tests/owner-approval.test.mjs
```

A Chrome mobile smoke at 390×844 intercepted every network request: GET on load, one POST after an
explicit tap, no page errors or horizontal overflow, 48px action control. It did not call production.

## Coordinated release requirement

Do not publish this feature independently of Maintenance BL-74a. It requires migration 182,
`/api/webhooks/owner-approval`, private 2B token issuance and the guarded 3A continuation. The native
origin below is the origin read from the current live callback, not a guessed custom domain:
`https://maintenance-ivory-kappa.vercel.app`.

The Maintenance implementation includes exact-version patch artifacts and the full release/recovery
runbook in `docs/BL-74a-APPROVAL-INTEGRITY-2026-09-23.md`. Root owns publication. Pause new 2B email
issuance while changing the Zap/page contracts so new links never reach the old auto-submitting page.
Never roll back to unguarded sending while a new native receipt is outstanding. Historical rows and
legacy Chat/auto/denial behavior are outside this page's rewrite.

Before completion: reviewed app/page PRs, remote throwaway Zap Code/Filter/mapping validation, and a
naturally occurring owner action showing a committed receipt and verified continuation. Local tests
do not establish that the live external workflow has been cut over.
