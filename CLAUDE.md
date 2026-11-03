# CLAUDE.md: alvara-wo-pages

Static HTML pages that Alvara and MCMX emails and texts link to: the owner's work-order approval
(`owner_approved.html` + `owner-approval.js`), the under/over $500 pages, and older inspection, approval and
re-quote pages. Each page reads its URL and sends one request to a Zapier hook, the alvara service or the MCMX
app; nothing is stored here. GitHub Pages serves `main` at `https://alvarapm.github.io/alvara-wo-pages/`, so
**a merge to `main` is a deploy** (about a minute, no gate). Which pages are live, who links them and what each
calls: `docs/systems/work-order-pages.md`.

## This repo is public

Every tracked file is readable on GitHub and served on the open web, this file and `docs/` included. Never
commit a secret, a credential, an internal hostname the pages do not already call, or the name, address,
phone number or email of a real customer, owner, resident or tenant. Use made-up examples. A page cannot hold
a secret: authentication comes from the link (a signed `exp`/`sig`, or the owner token in the `#token=`
fragment), checked by the server it calls.

## Tests

`node --test tests/owner-approval.test.mjs` (Node 20+, no dependencies). CI runs it on every push and pull
request (`.github/workflows/test.yml`). Only `owner-approval.js` is tested; for any other page, open it locally
with made-up parameters and check it does not send a request on load. A change to the owner-approval page must
match the MCMX app's owner-link contract (`Alvarapm/Maintenance`, `src/lib/wo/owner-link-contract.ts`); ship
the MCMX side first.

## Docs rule

- **System docs in the same PR.** If your change alters how a documented page behaves (who links it, what it
  calls, how a link is checked, the deploy, the runbook), update its page in the same PR:
  `docs/systems/*.md`, each listing the code it covers in its `docs-check: covers` block at the top. For a
  change the page does not describe, put `Docs: none, <why>` on its own line in a commit message.
- There is no CI check for this here yet (decided 2026-11-03: it is added only after Andrey and Zach agree to
  make the check blocking). Follow the rule by hand.
- Write dated facts with where they came from (a file, a command, or "checked YYYY-MM-DD"). No em dashes or en
  dashes.
