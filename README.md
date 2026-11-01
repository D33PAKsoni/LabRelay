# LabRelay

**Live app:** https://labrelay.appwrite.network — production sign-in and Realtime verified. See [hosting verification](reports/SITE_HOSTING_STATUS.md).

Accountable water-sample handoffs from field collection to laboratory receipt.

The product has Dispatch with nearby-site distance filtering, handoff, sample history and persisted batch receiving, real Appwrite sign-in, atomic registration, durable offline observations and a deployed authenticated Function. Receipts preserve missing samples and their last confirmed custodian. Workspace and history now refresh through authorized Realtime signals. All 103 unique checks executed in this phase pass across local and real Appwrite journeys.

Read [Realtime authorization](docs/REALTIME.md), [nearby collections](docs/NEARBY_SITES.md), [batch receiving](docs/BATCH_RECEIPTS.md) and [PRODUCT_AND_DEPLOYMENT.md](docs/PRODUCT_AND_DEPLOYMENT.md) for setup and [the current handoff](reports/LOCAL_HANDOFF.md) for verified state. Historical day-one results remain in reports/LIVE_CLOUD_VERIFICATION.md.

## Start locally

```powershell
npm ci
npm run dev
```

- Real backend: http://127.0.0.1:5173/
- Fictional local preview: http://127.0.0.1:5173/?preview=1

The preview is explicitly labeled, development-only, and separate from Appwrite. The role switcher is absent from the real sign-in workflow.

To use the three real development demo accounts, open the ignored .local/demo-accounts.json file locally. The credentials are fictional and are not included in source or public reports. Reprovisioning instructions are in docs/PRODUCT_AND_DEPLOYMENT.md.

## Workflow

New to the project? Start with [LabRelay in one minute](docs/USE_CASE.md), including when to use individual acceptance or a batch receipt. The [first owner walkthrough](reports/WORKFLOW_VALIDATION_STATUS.md) is recorded with its assistance and incomplete batch task; intended-user validation remains open.

1. A collector registers a labeled sample and collection site.
2. A courier claims the pickup; the collector still holds custody.
3. The collector offers a handoff; the intended courier accepts possession.
4. The courier offers it to a lab receiver; the receiver accepts individually or records a batch receipt with missing, unexpected and repeated IDs.
5. History records each revision and confirmed custodian.
6. Offline handling notes remain pending until the server accepts them; stale notes require review.

Every transition is server-authorized. Sample, history, handoff and actor-scoped retry receipt writes share one transaction. A unique next-revision event prevents competing couriers from overwriting the winning assignment.

## Checks and builds

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
npm run build:web
npm run build:function
```

Cloud commands use the ignored root .env. Never place its API key in browser configuration. Test sessions are revoked, while fictional sample/history records remain for inspection. See the report files for actual results and verification boundaries.

## Deployment

The LabRelay API is deployed as labrelay_api in the separate Free-plan development project. Run npm run deploy:function to rebuild, upload and activate its bundle. It executes for authenticated users and receives only per-execution row read/write access.

The frontend production build is dist/web. The frontend is published at https://labrelay.appwrite.network. See docs/APPWRITE_SITES.md for redeployment. Instructions, environment variable names and deployment guards are in docs/PRODUCT_AND_DEPLOYMENT.md.

## Source map

| Path | Purpose |
|---|---|
| web/ | React product, Appwrite browser transport and offline shell |
| src/domain/ | Server-controlled registration and custody transitions |
| src/product.ts | Organization-scoped workspace and history reads |
| src/function.ts | Authenticated Appwrite Function routes |
| src/adapters/ | Real TablesDB adapter and explicit memory test double |
| src/offline/ | Durable actor-separated queue and review states |
| scripts/ | Bootstrap, deployment, demo accounts and cloud checks |
| tests/ | Domain, diagnostic, product and hosted browser checks |
| reports/ | Observed verification evidence and screenshots |

## Scope and provenance

This is a new October 2026 project built with ChatGPT/Codex assistance. No code from CHATGS or another existing application was imported. Organizer clarification of AI-assisted eligibility and user interviews remain open; no endorsement or approval is claimed.

Use fictional water-testing records. Recorded acknowledgments do not independently prove physical possession. Business records are private to the authenticated Function; direct legacy read grants have been removed. Before onboarding real users, resolve the offline-cache policy, larger-workspace pagination and remaining product validation. Project code licensing must be selected before publishing a repository.




# LabRelay
