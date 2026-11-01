# Authorized Realtime phase - 29 October 2026

**Complete:** workspace data and selected sample history refresh automatically after another client's command. The authenticated Function is deployed, direct business-row grants have been removed, and WebSocket signals contain only a random token and timestamp.

## Verification

| Evidence | Passing checks |
|---|---:|
| Unit and adapter contracts | 48 |
| Product browser scenarios, including five Realtime/security cases | 20 |
| Original real-cloud custody and direct-access regression | 7 |
| Product routes against real Auth/TablesDB | 4 |
| Batch routes against real Auth/TablesDB | 5 |
| Deployed product Function regression | 4 |
| Deployed batch Function regression | 5 |
| Deployed nearby-site regression | 4 |
| Real hosted browser journeys and WebSocket security tests | 6 |
| **Unique checks executed in this phase** | **103** |

All current results pass. The five Realtime product cases were also rerun after the final organization/cache boundary hardening; that repeat is not counted twice. The production frontend build succeeds at approximately 517 KB JavaScript (150 KB gzip). Vite retains its earlier chunk-size and icon-library directive warnings.

One initial local-handler journey returned an uncertain 503 during an offer. Its complete rerun passed, as did the deployed regression and real-browser journeys. The product retains the original-operation retry behavior for uncertain responses; this report does not claim the external service never returns transient errors.

## Authorization audit

[REALTIME_VERIFICATION.json](REALTIME_VERIFICATION.json) confirms deployment `6ae24d462dc114127563` is active and ready on Node.js 22, executes for `users`, and retains only `rows.read` and `rows.write` dynamic scopes. All ten tables use row security and no table-wide client grants.

The final scan checked **865 business rows**, all with empty client permissions, and **16 private signal rows**, each with owner-only or empty grants and no business fields. All sixteen fictional memberships were active after the temporary revocation test, and all sixteen fictional users had **zero remaining sessions**. The report includes the Function archive hash. The migration record is [realtime-permission-migration.json](realtime-permission-migration.json).

Real-browser checks proved automatic workspace/history updates across two signed-in users, connection closure on sign-out, cache clearing and sign-out after real membership revocation, owner-only WebSocket delivery with a positive authentication control, and denied direct business-row reads. The socket-cleanup assertion checks Appwrite connections; Vite's development connection has a separate lifecycle.

[Hosted Realtime screenshot](hosted-realtime-history.png) shows history updated by the other user's pickup claim without pressing Refresh. See [REALTIME.md](../docs/REALTIME.md) for consistency, fallback reads, revocation timing, offline limits and deployment order.

The frontend still runs locally against the hosted API. Next: publish the frontend to Appwrite Sites and verify its production-domain sign-in and live connections. Organizer eligibility, interviews, licensing and submission materials remain separate work. No external messages were sent.
