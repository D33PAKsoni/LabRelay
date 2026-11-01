# Batch receipt phase - 28 October 2026

**Historical phase snapshot:** nearby-site filtering is now complete. See [NEARBY_SITES_STATUS.md](NEARBY_SITES_STATUS.md) and [NEARBY_VERIFICATION.json](NEARBY_VERIFICATION.json) for the current deployment and verification.

**Complete:** persisted batch receiving is implemented in the product and deployed to the authenticated Appwrite Function. A real browser recorded one matching, one missing, one unexpected and one repeated ID, then reloaded the saved report. The missing sample retained courier custody and its pending handoff.

## Verification

| Evidence | Passing checks |
|---|---:|
| Unit and adapter contracts | 35 |
| Original offline diagnostic browser scenarios | 4 |
| Product browser scenarios, including five receipt scenarios | 11 |
| Original real-cloud regression | 7 |
| Product routes against real Auth/TablesDB | 4 |
| Batch routes against real Auth/TablesDB | 5 |
| Deployed product Function with real JWTs | 4 |
| Deployed batch Function with real JWTs | 5 |
| Real-browser hosted sample journey and batch receipt | 2 |
| **Total** | **77** |

The production frontend build succeeds. Vite reports a 502 KB JavaScript chunk (146 KB gzip) and an upstream icon-library directive warning; chunk splitting remains a performance improvement.

The final audit confirms the active deployment is `6ae226cedbf2ad01478d`, ready on Node.js 22, executing for `users` with only `rows.read` and `rows.write` dynamic scopes. All nine tables have row security and no table-wide client grants. All sixteen fictional users have zero remaining sessions. See [BATCH_VERIFICATION.json](BATCH_VERIFICATION.json) for the audit and bundle hash.

## Result and boundaries

Matching samples are accepted once. Missing samples retain their last confirmed custodian. Saved reports preserve that historical snapshot when a later delivery succeeds. Batch revision guards reject stale or competing mutations atomically. The manifest consists of active laboratory offers to the signed-in receiver, not every sample registered in the batch.

[Hosted receipt screenshot](hosted-batch-receipt.png) shows the verified result. [BATCH_RECEIPTS.md](../docs/BATCH_RECEIPTS.md) explains receiving, consistency, limits and routes.

The frontend still runs locally against the hosted backend. Nearby-site queries, Realtime and Appwrite Sites frontend hosting remain. Organizer eligibility clarification, user validation, licensing and submission materials remain separate work. No external messages were sent.

