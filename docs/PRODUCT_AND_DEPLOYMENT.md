# Product and hosted Function — 28 October 2026

## Run the product

```powershell
npm ci
npm run dev
```

Open http://127.0.0.1:5173/ for real Appwrite sign-in. The local web app is registered in Appwrite for hostname 127.0.0.1. Accounts must have a server-managed active membership; the browser cannot select its own role.

For a fictional, development-only walkthrough, open http://127.0.0.1:5173/?preview=1. This uses a separate in-memory server and explicit role switcher. Its changes never reach Appwrite. The preview server exists only in Vite development mode.

## Real development demo accounts

`npm run demo:accounts` creates three fictional accounts in a separate `lrdemo_org` organization and three fictional samples. It checks password sign-in and revokes its test sessions. It does not reset existing account passwords.

The generated credentials are in the ignored `.local/demo-accounts.json` file. Open this file locally when signing into the real product; do not copy its passwords into chat, a public README, screenshots, or source control. The reserved .example email addresses are fictional. These users are separate from the original thirteen passwordless cloud-check accounts.

## Current screens

- Dispatch: sample counts, search/status filtering, organization-authorized nearby collections, nearest-first site distances, confirmed custodian and the next handoff. See [NEARBY_SITES.md](NEARBY_SITES.md).
- Handoff: courier claim, sender offer, intended receiver acceptance, and the four-stage journey. Assignment preserves the collector's custody.
- Sample history: ordered revisions, actor, acknowledged custody changes, capture/acceptance times and handling observations.
- Collector registration: sample ID, label, batch ID and a site belonging to the collector's organization. The initial sample, event and operation receipt commit atomically.
- Batch receiving: persisted discrepancy reports, unique matching acceptance and unchanged custody for missing samples. See [BATCH_RECEIPTS.md](BATCH_RECEIPTS.md) for the delivery manifest definition and limits.
- Sign-in: Appwrite email/password sessions; membership and role remain server-controlled.
- Live updates: private refresh signals trigger membership-authorized workspace and history reads, with reconnect recovery and 30-second fallback checks. See [REALTIME.md](REALTIME.md).
- Local queue: durable observations, stable operation IDs, uncertain-result retries, explicit stale-action review and separate archival of rejected requests.
- Offline shell: public application assets are cached; authentication and API responses are not cached by the service worker. Workspace/history snapshots and the queue remain separated by actor.

Online custody commands require connectivity. Only handling observations can be newly recorded offline. A rejected request is never labeled server-confirmed merely because it was archived locally.

## Hosted API

Project: `6ae20a1500011bd3e5da`
Endpoint: `https://fra.cloud.appwrite.io/v1`
Function ID: `labrelay_api`
Runtime: Node.js 22
Database: `labrelay_spike`

The Function executes only for signed-in users. The platform supplies its per-execution key with `rows.read` and `rows.write`. Each request verifies the caller's JWT and active membership before returning or changing records.

| Route | Behavior |
|---|---|
| GET /workspace | Organization-scoped samples, sites, member IDs/roles, pending handoffs and latest 20 receipts |
| GET /samples/:id/history | Authorized sample with its latest 100 events in revision order |
| GET /batches/:batchId/manifest | Intended receiver's current offered delivery manifest |
| GET /receipts/:receiptId | Organization-authorized saved receipt |
| POST /sites/nearby | Active-membership and organization-scoped spatial site search |
| POST /commands | Register, claim, offer, accept, observe or reconcile_batch |
| POST / | Compatibility with the original spike command endpoint |

The workspace returns at most 100 samples/sites/members and flags truncation. Larger operations need pagination and a reviewed membership model. Business rows now have no direct client grants; all record reads recheck active membership through the Function. Private live signals contain no business data. See REALTIME.md for revocation timing and offline-cache limits.

## Rebuild and deploy

```powershell
npm run build:web
npm run build:function
npm run deploy:function
npm run test:hosted
```

The deployment key in the ignored root .env needs `functions.read` and `functions.write` in addition to the original setup/test scopes. The deployed Function receives only row read/write access. The package script bundles the backend and SDK, then archives exactly function.mjs, package.json and package-lock.json. It does not upload the root .env, demo passwords, tests or the frontend.

The deployment script preserves its function ownership marker, stores deployment IDs for inspection, waits for readiness and activates the completed deployment. Do not start another deployment merely because polling was interrupted; inspect .local/function-deployment.json first.

For another project, set public browser configuration in web/.env.local:

```text
VITE_APPWRITE_ENDPOINT=https://YOUR_REGION.cloud.appwrite.io/v1
VITE_APPWRITE_PROJECT_ID=YOUR_PROJECT_ID
VITE_APPWRITE_FUNCTION_ID=labrelay_api
```

Never prefix a server API key with VITE_. Those variables are included in browser builds.

## Verification commands

```powershell
npm test
npm run test:browser
npm run test:product
npm run test:product:live
npm run test:batch:live
npm run test:batch:hosted
npm run test:nearby:live
npm run test:nearby:hosted
npm run test:hosted
npm run test:cloud-ui
```

If Playwright's default browser is not installed, set LABRELAY_BROWSER_EXECUTABLE to a local Chromium executable. The current computer uses C:\Users\Soni\AppData\Local\ms-playwright\chromium-1243\chrome-win64\chrome.exe.

The product browser tests use the isolated local preview. The product live checks invoke the handler locally against real Auth/TablesDB. The hosted checks use the deployed Function with real user JWTs. The six cloud UI tests use the real sign-in form and hosted backend with fictional demo accounts; they record post-login sample-history, batch-receipt, nearby-dispatch and live-history screenshots. They also verify WebSocket isolation, sign-out cleanup and real membership revocation. Current results and deployment audit are in ../reports/REALTIME_STATUS.md and ../reports/REALTIME_VERIFICATION.json.

## Remaining product work

Frontend hosting is complete. Continue user validation, licensing and submission preparation. The frontend is live at https://labrelay.appwrite.network; production sign-in and Realtime are verified. See APPWRITE_SITES.md. Public repository licensing, organizer eligibility clarification, user interviews, video and submission remain separate work.




