# Online product phase — 28 October 2026

**Complete:** the dispatch, handoff and sample-history screens are implemented; the authenticated Appwrite Function is deployed; a real browser completed the collector-to-courier-to-laboratory journey.

## Verification

| Evidence | Passing checks |
|---|---:|
| Unit and adapter contracts, including atomic registration | 24 |
| Original offline diagnostic browser scenarios | 4 |
| Product browser scenarios, including 390px layout and offline refresh | 6 |
| Product routes against real Appwrite Auth/TablesDB | 4 |
| Hosted Function execution with real user JWTs | 4 |
| Real browser sign-in, registration, both handoffs, six-event history and sign-out | 1 |
| **Current phase total** | **43** |

Raw evidence: unit-results.xml, browser-results.json, product-browser-results.json, product-cloud-results.json, hosted-function-results.json and cloud-ui-results.json. PRODUCT_VERIFICATION.json records deployed settings, archive digest and session cleanup. The historical seven-check spike report remains cloud-results.json and is not added to the phase total above.

The cloud UI test uses three distinct authenticated browser contexts and the real hosted Function. Local-preview results are explicitly separate. Screenshot review corrected a hidden-label mobile overflow and the displayed direction of custody transfers; regression assertions cover both collector-to-courier and courier-to-receiver directions.

## Deployed backend

- Project: 6ae20a1500011bd3e5da (Free, Frankfurt).
- API endpoint: https://fra.cloud.appwrite.io/v1
- Function: labrelay_api; runtime: node-22.
- Active deployment: 6ae21acdef546b310de0.
- Execute access: signed-in users.
- Per-execution scopes: rows.read, rows.write.
- Database: labrelay_spike.
- The prebuilt archive contains exactly function.mjs and dependency-free package/lock manifests; no .env or demo passwords.

## Local product and accounts

Run npm run dev from E:\Appwrite\LabRelay.

- http://127.0.0.1:5173/ uses real Appwrite sign-in and the hosted backend.
- http://127.0.0.1:5173/?preview=1 is an explicitly labeled fictional preview with a separate in-memory server. Role switching is development-only.
- Appwrite has a React web app named LabRelay local, restricted to hostname 127.0.0.1.
- Three fictional demo accounts and three seed samples are in a separate lrdemo_org organization.
- Generated passwords are only in the ignored .local/demo-accounts.json file. They are not in public reports.
- UI test samples remain in the development database for inspection.

The frontend is built in dist/web and runs locally; it has not yet been published to Appwrite Sites.

## Implemented behavior

Collectors register a sample at an authorized site. Couriers claim a pickup without changing custody. Senders offer handoffs and intended receivers accept them. History orders the recorded revisions. Observations can be saved offline, survive refresh, retry with their original operation ID and either become confirmed or remain visible for review. Rejected-action archival is distinct from server confirmation.

The browser cannot grant itself a role or organization. Read endpoints check active membership. The service worker caches public application resources, while the outgoing queue and saved workspace/history snapshots are actor-separated.

## Next phase

1. Persist batch receipt reconciliation and missing/unexpected/duplicate sample discrepancies; missing samples must retain their last confirmed custodian.
2. Implement nearby-site queries and authorized Realtime updates.
3. Publish the frontend to Appwrite Sites and verify its production origin.
4. Finish usability review, licensing, demo video, organizer clarification and submission.

Before using real memberships, replace or propagate legacy direct row-read ACLs so revocation is effective. Workspace lists currently cap at 100 and flag truncation. No user interviews, organizer endorsement or hackathon submission are claimed.

