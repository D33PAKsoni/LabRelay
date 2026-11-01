# LabRelay live verification — 28 October 2026

**Later product update:** hosted Function execution and the real-browser online journey are now verified. See PRODUCT_PHASE_STATUS.md for current state; this document preserves the earlier seven-check spike evidence.

**Result: all seven live checks passed.** The local suite also passed all 20 unit/contract checks and four browser scenarios on this computer.

The live run completed at 20:26 IST on 28 October 2026 (report timestamp: 2026-10-28T14:56:03.836Z). Raw redacted evidence is in cloud-results.json.

## Provisioned development project

- Console: https://appwrite.io/projects/6ae20a1500011bd3e5da/overview
- Plan and region: Free, Frankfurt
- Project ID: 6ae20a1500011bd3e5da
- Endpoint: https://fra.cloud.appwrite.io/v1
- Database: labrelay_spike (ownership marker verified)
- Tables: memberships, sites, samples, handoffs, events, operations
- All six tables have row security enabled and no table-level permission grants.
- Schema indexes, one fictional sampling site, and 13 fictional test users were provisioned by the bootstrap.

## Observed cloud results

| Check | Result |
|---|---|
| Ten simultaneous authenticated claims | Exactly one winner and one event; collector retains custody |
| Retry after a lost response | Original result returned; no duplicate event |
| Organization isolation | Real JWT reads succeed within the organization and fail across organizations |
| Direct client writes | Mutation denied even when the sample row is readable |
| Stale observation | Rejected without overwriting current custody |
| Atomic transaction rollback | Earlier staged update is not persisted after a later duplicate-key failure |
| Full handoff journey | Sender offer and intended receiver acceptance succeed on both legs through laboratory receipt |

The runner exited successfully. A separate read-only verification confirmed **zero remaining sessions across all 13 fictional users**. Fictional sample and history rows remain for inspection. No API key, JWT, session secret, or password is included in these reports.

## Scope and remaining work

The live runner invokes src/function.ts locally against real Appwrite Auth and TablesDB. This verifies the backend integration; it does not verify a hosted Function URL, platform-injected headers, or the product frontend.

Next technical work: deploy and verify the authenticated Function, then build dispatch, handoff and sample-history screens with registration and persisted receipt discrepancies. Hosted Realtime, nearby-site queries, and deployment still need end-to-end evidence.

Organizer clarification about AI-assisted eligibility, user interviews, hackathon registration and final submission remain open. The drafts and worksheet remain in docs/VALIDATION_AND_RULES.md; no external messages or submission were sent.

Runtime: Node.js v24.19.0, locked npm dependencies, and installed Chromium 1243 for the browser checks. The development API key is stored only in the ignored local .env file and was configured with a one-week expiry.
