# Work-order and inspection pages

<!-- docs-check: covers
owner_approved.html
owner-approval.js
under.html
over.html
approval.html
re-quote_form.html
schedule-inspection.html
reschedule-inspection.html
inspection-availability.html
split-inspection.html
owner-escalation.html
tests/
.github/workflows/
-->

| | |
|---|---|
| **What it does** | Static web pages that an email or text links to, so an owner can approve a work order, staff can make the $500 call, and (until 21 Oct 2026) tenants and owners could answer onboarding inspection requests. |
| **Status** | mixed (checked 2026-11-03): **live** `owner_approved.html` (+ `owner-approval.js`), `under.html`, `over.html`; **retired in practice** the four inspection pages (their Zaps were turned off 2026-10-21); **dead** `schedule-inspection.html`, `approval.html`, `re-quote_form.html` (nobody known links them). All eleven files are still served. |
| **Lead** | Andrey (no lead recorded; `docs/systems/INVENTORY.md` §1 in the alvara monorepo says "ours") |
| **Code** | the HTML files at the repo root, `owner-approval.js`, `tests/`, `.github/workflows/test.yml` |
| **Last verified** | 2026-11-03, Andrey with Claude: this repo's `main` (0c01fa6) read and its test run (7/7 pass); GitHub Pages settings read with `gh api` (read only); every served file fetched with GET (all 200); callers searched in Maintenance `origin/main` (16d24424), the alvara monorepo `origin/main` (3a19880b) and alvara-legacy-api `origin/main` (ec3a0a2). Zapier not read. No POST made. |

## 1 · Overview

The pages hold no secret and no state. Each one reads its URL, shows a short screen, and sends one request:
to a Zapier catch hook, to the alvara service (the legacy API on Vercel), or to the MCMX app. The links are
built by Zaps and, for owner approval, by the MCMX app (`Alvarapm/Maintenance`). The repo is **public** and is
served by GitHub Pages, so anything committed here, these docs included, is on the open web.
The onboarding inspection pages were rebuilt inside Alvara OS (BL-120 step P7) as public routes under
`/inspection/<signed token>`, "word for word" (`apps/alvara-os/components/inspection/*.tsx` headers in the
alvara monorepo). Since the 2026-10-21 cutover no live sender links the copies here.

## 2 · How it flows

### Each page

| Page | Who it is for | Who sends people to it | What it calls | In use? |
|---|---|---|---|---|
| `owner_approved.html` + `owner-approval.js` | the owner of an over-$500 work order | Zap 2B's owner email; the link is `owner_approved.html#token=<capability>`, built by the Zap Code step in Maintenance `scripts/zapier/bl74/issue.js`, token issued by Maintenance | GET and POST `https://maintenance-ivory-kappa.vercel.app/api/webhooks/owner-approval` | **live** since 2026-09-23 (Maintenance `docs/backlog/BL-74.md`, "Wave 2 production") |
| `under.html` | Chris, saying a work order is under $500 | Zap 1's new-work-order email, which Chris clicks (Maintenance `docs/WO-OWNER-ZAP-ARMING.md`, measured 2026-08-07) | POST to a Zapier catch hook (Zap 2A), `{wo, status, limit, timestamp}` | probably live: Zap 1 and 2A were on at the last Zapier read (INVENTORY §3.1, 2026-08-31 snapshot; not re-read) |
| `over.html` | Chris, saying it may go over $500 | the same Zap 1 email | form (likelihood ~25% to 90%+, notes) POSTed to a Zapier catch hook (Zap 2B) | probably live, same evidence |
| `approval.html` | "Approval Requested" screen | no linker found (checked 2026-11-03) | POST to a Zapier catch hook ("Zap 3" in its comment), `{wo, action: "approval_requested", token}` | probably dead; last change 2026-01-18 |
| `re-quote_form.html` | a re-quote after an owner denial | no linker found (checked 2026-11-03) | hidden form POST (urlencoded) into an iframe, a Zapier catch hook, `action: "vendor_requote_submitted"` | probably dead; last change 2026-01-22 |
| `schedule-inspection.html` | a tenant booking an inspection | **no Zap mints this link** (Maintenance `docs/INSPECTION-LINK-SIGNING.md`, measured 2026-07-30) | GET `https://alvara-lovat.vercel.app/api/booking-windows?kind=book...`, POST `.../api/book-inspection` | dead |
| `reschedule-inspection.html` | a tenant moving a booked inspection | P7 Zap 3 "Schedule Inspection" (a short link), turned off 2026-10-21 (INVENTORY §3.1) | GET `.../api/booking-windows?kind=reschedule&job_id...`, POST `.../api/reschedule-inspection` | retired; old links work until they expire (§8) |
| `inspection-availability.html` | a tenant giving dates for the onboarding inspection | P7 Zap 1 (a short link), turned off 2026-10-21 | urlencoded POST to a Zapier catch hook | retired; replaced by the OS availability page |
| `split-inspection.html` | an owner asking for separate inspections per unit | the P7 "Delay emails" Zap, turned off 2026-10-21 | POST to a Zapier catch hook, `action: "split_inspection_request"` | retired; replaced by the OS split page |
| `owner-escalation.html` | an owner choosing what to do about a silent resident | the P7 cadence Zap (day 14), turned off 2026-10-21 | POST to a Zapier catch hook (Zap 368063211, per its own comment), `action` one of `authorize_entry`, `fix_contact`, `split_unit` | retired; replaced by the OS escalation page |

Each page's own script names its hook.
"No linker found" means: no file in the four repos above builds a link to the page, and the Alvara WO Chat App
script (local copy, verified equal to live v86 on 2026-10-13 per the OS `P7-INSPECTION-INVENTORY.md`) has none.
Zapier itself could not be read today, so a Zap could still send one.

### Owner approval, step by step (`owner-approval.js`)

1. The page loads. It reads `token` from the URL **fragment** (`#token=`), falling back to `?token=`. A fragment
   never reaches the Pages server. A token that is not 43 characters of `[A-Za-z0-9_-]` (for example an old
   `token=123` link) sends nothing and shows "A fresh approval link is needed".
2. With a valid token it sends **GET** with `Authorization: Bearer <token>`. GET only reads status; opening or
   previewing the link cannot approve.
3. The server answers a `state`: `ready`, `approved` (with `delivery` `pending`, `processing` or `complete`),
   `closed`, `expired`, `unavailable`. The work-order number shown comes from the server, never the URL.
4. Only a tap on **Approve this work order** sends **POST** `{token, action: "approve"}`. A second tap while
   busy does nothing.
5. An opaque response, status 0, a timeout (12 s) or an unexpected error shows "Approval status is not
   confirmed" and never "Approval recorded". **Check status again** re-reads with GET before any retry.
6. While the office update is pending the page re-reads status every 2 s, at most 6 times.

The server side is Maintenance `src/app/api/webhooks/owner-approval/route.ts`: it refuses an `Origin` other
than `https://alvarapm.github.io` (403), checks the token shape with `capabilitySchema` in
`src/lib/wo/owner-link-contract.ts`, records the approval and the attribution itself, and hands on to Zap 3A.

## 3 · Integrations

| Vendor or system | What we use it for | How | Credential |
|---|---|---|---|
| MCMX app (Maintenance) | owner approval status and the approval itself | CORS fetch from `owner-approval.js` | the per-owner token in the link; nothing stored here |
| alvara service (`Alvarapm/alvara-legacy-api`) | slots, booking and rescheduling for the two tenant inspection pages | CORS fetch, signed link forwarded | the link's `exp` and `sig`; the signing key lives only in that service |
| Zapier | every other page's submission | catch hook POST, `mode: "no-cors"` (or a form into an iframe) | none: the hook URL is public in the HTML |
| GitHub Pages | hosting | legacy (Jekyll) build from `main`, path `/` | the `Alvarapm` GitHub account |

## 4 · Switches and configuration

No env var and no build step: every endpoint is a constant in the page's script. Settings that change behaviour
live elsewhere:

| Setting | Where | Value (checked 2026-11-03) | Effect |
|---|---|---|---|
| Pages source | `gh api repos/Alvarapm/alvara-wo-pages/pages` | `main`, `/`, `build_type: legacy`, status `built`, `https_enforced: true`, no custom domain | serves `https://alvarapm.github.io/alvara-wo-pages/<file>` |
| Repo visibility | `gh api repos/Alvarapm/alvara-wo-pages` | `public`, not archived | everything tracked is readable and served |
| Branch protection on `main` | `gh api .../branches/main/protection` | none (404 "Branch not protected") | a push to `main` goes live with no gate |
| Owner-approval origin | `owner-approval.js` (`API`), the CSP in `owner_approved.html`, Maintenance `OWNER_LINK_ORIGIN` | the Maintenance production origin above; `https://alvarapm.github.io` | a domain change on either side must change all three, or approvals fail closed |
| Link-signing enforcement | the alvara service, `api/_link-sig.js` | enforcing since 2026-07-30 (Maintenance `docs/INSPECTION-LINK-SIGNING.md`; not re-read) | an unsigned, forged or expired booking/reschedule answers 401 |

## 5 · Scheduled jobs

None. GitHub Actions runs `Owner approval contract` (`.github/workflows/test.yml`, Node 20,
`node --test tests/owner-approval.test.mjs`) on every push and pull request; the last runs on 2026-09-23 passed.
GitHub's own `pages-build-deployment` publishes each push to `main` (took 1m4s on 2026-09-23). Neither alerts
anyone and neither blocks the other.

## 6 · Data

The pages store nothing: no cookie, no local storage (the test fails if `owner-approval.js` touches
`sessionStorage`). Where a case's state lives:

- **Owner approval:** the MCMX app (`ops.owner_approval_links` and the work-order timeline; Maintenance
  `docs/BL-74a-APPROVAL-INTEGRITY-2026-09-23.md`).
- **The $500 call:** the MCMX Pipeline sheet (Zaps 2A/2B write it) and the MCMX work-order board.
- **Onboarding inspections:** Alvara OS since 2026-10-21; HouseCall Pro for the booked job.

## 7 · Runbook

- **Is it healthy?** `gh api repos/Alvarapm/alvara-wo-pages/pages --jq .status` says `built`, and each page
  answers 200 (`curl -s -o /dev/null -w '%{http_code}' https://alvarapm.github.io/alvara-wo-pages/owner_approved.html`).
  Nothing here can tell you whether a Zap behind a hook is on; that needs Zapier.
- **An owner says the approval link does not work.** The page never claims success it did not get. Ask what it
  says: "fresh approval link" means an old or broken token (send a new one from Maintenance); "not confirmed"
  means the MCMX app did not answer (check Maintenance is serving). The recovery runbook is Maintenance
  `docs/BL-74a-APPROVAL-INTEGRITY-2026-09-23.md`.
- **Test locally, no network:** `node --test tests/owner-approval.test.mjs` (Node 20+, no dependencies). It
  runs `owner-approval.js` in a sandbox with a fake `fetch` and DOM. Nothing else in the repo has a test.
- **Change a page.** Branch, PR, let CI pass, merge. Merging is deploying (about a minute). A change to
  `owner_approved.html` or `owner-approval.js` must match Maintenance's owner-link contract; ship Maintenance first.
- **Switch a page off or roll back.** Revert on `main`. Deleting a file makes old links 404. Never roll the owner
  page back to the pre-2026-09-23 version (it approved on load, signed every approval with a fixed staff name and
  showed success on an opaque response; `README.md`, Maintenance `docs/backlog/BL-74.md`).

## 8 · Known issues and open work

This repository is public, so this section names problems without the detail of how to misuse them. The full
findings, with the evidence, are in the private Maintenance backlog: `docs/backlog/BL-134.md`, items A20 to A23.

- 2026-11-03: the four inspection pages (availability, reschedule, split, escalation) lost their senders on
  2026-10-21. Old links still open them, and some still act (BL-134 A20, A21). Replace each with a short "this
  link has moved, contact the office" page, or delete them.
- 2026-11-03: `schedule-inspection.html` is dead (no linker since at least 2026-07-30) but still served.
  `approval.html` and `re-quote_form.html` have no known linker; probably dead. Delete them once Zapier can be
  checked (BL-134 A22).
- 2026-11-03: the older pages (`under.html`, `over.html`, `approval.html`, `re-quote_form.html` and the
  inspection pages) do not check a signed link the way `owner_approved.html` does (BL-134 A22, A23). Retire them
  once nobody uses the email path.
- 2026-11-03: `under.html` links the internal Pipeline spreadsheet; only the sheet's own sharing protects it.
- 2026-11-03: everything tracked is published, including `README.md`, `tests/` and `docs/`. `main` has no branch
  protection and CI does not gate the Pages deploy.
- 2026-11-03: `README.md`'s "Coordinated release requirement" reads as pending; the release happened on
  2026-09-23. Stale wording, not a defect.
- 2026-11-03: the alvara monorepo's `docs/systems/INVENTORY.md` §1 says these pages post "to the alvara service
  and Zapier hooks"; `owner_approved.html` posts to the MCMX app.
- Only `owner-approval.js` is tested. The other ten pages have no test.

## 9 · Deeper docs

- `README.md` (this repo): the owner-approval contract.
- Maintenance (`Alvarapm/Maintenance`): `docs/BL-74a-APPROVAL-INTEGRITY-2026-09-23.md` (owner approval, release
  and recovery), `docs/INSPECTION-LINK-SIGNING.md` and `docs/BOOKING-WINDOWS-AUTH.md` (signed links),
  `docs/WO-OWNER-ZAP-ARMING.md` (the $500 pages and Zaps 2A/2B), `docs/WORK-ORDER-FLOW.md`.
- alvara monorepo (`Alvarapm/alvara`): `apps/alvara-os/docs/owner-sales/P7-INSPECTION-INVENTORY.md` (what each
  inspection page and Zap did), `P7-DESIGN.md` (the OS replacement), `docs/systems/INVENTORY.md` §1 and §3.1.
- alvara service (`Alvarapm/alvara-legacy-api`): `api/_link-sig.js` (how a signed link is checked).
