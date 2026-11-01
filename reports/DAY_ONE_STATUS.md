# LabRelay day-one status — 27 October 2026

**28 October update:** the seven live Appwrite checks now pass, and the isolated development schema is provisioned. See [LIVE_CLOUD_VERIFICATION.md](LIVE_CLOUD_VERIFICATION.md). The remainder below is the original 27 October record; organizer clarification and interviews remain open.

**Outcome:** the local feasibility experiment is built and passes 24 checks. The full day-one sign-off remains open because live Appwrite verification, organizer clarification and interviews require external access or responses.

| Work item | Status | Evidence or remaining dependency |
|---|---|---|
| Narrow product scope and workflow | Complete | `docs/WORKFLOW.md` |
| Technical choices and tradeoffs | Complete | `docs/DECISIONS.md` |
| Versioned assignments and acknowledged custody handoffs | Implemented; locally verified | Complete journey in `tests/unit/domain.test.ts` |
| Ten simultaneous claims; exactly one accepted | Local model passes | Forced concurrent interleaving; one event and one receipt |
| Duplicate requests and lost acknowledgment | Local model and browser pass | One resulting event; original receipt returned |
| Organization/role checks in the service | Local model passes | Cross-organization, inactive member, forbidden role and forged-body tests |
| Real Appwrite row permissions and transaction behavior | Not run | Requires project endpoint, project ID and development key |
| Durable offline queue | Four browser scenarios pass | Real Chromium, IndexedDB and service worker; local backend test double |
| Actual Appwrite Function deployment | Not deployed | Handler and setup instructions supplied; hosted verification is separate |
| Organizer clarification about AI assistance | Pending | Draft in `docs/VALIDATION_AND_RULES.md`; nothing sent |
| User validation | Pending | Interview worksheet supplied; no interviews claimed |
| Hackathon registration/submission | Not completed | Requires participant account and eventual finished entry |

## Observed checks

**20 unit/contract checks passed.** These cover concurrent claims, duplicate operations, operation ID reuse, roles, organization boundaries, disabled accounts, spoofed fields, custody handoffs, stale observations, separate timestamps, malformed input, all-or-nothing local commit semantics, manifest reconciliation, SDK transaction-call contracts, and function authentication requirements.

**4 browser checks passed.** An observation persisted through an offline reload and synchronized once; a stale record was retained for review; a response lost after server commit was retried without duplicate history; and switching diagnostic identities did not display or replay the other identity's queue.

Execution: Node.js 24.22.1, TypeScript 5.9.3, Appwrite Node SDK 31.0.0, Dexie 4.4.7 and Playwright 1.64.1. Browser tests used Chromium Headless Shell 141.0.7390.37 via the executable override after the default browser download was unavailable. They do not establish behavior in every browser or under every storage-eviction condition.

Raw artifacts: `unit-results.xml` and `browser-results.json`. The API connectivity doctor stopped with an explicit configuration-required result before making a cloud request. No API key was configured or exposed.

## Complete the remaining technical gate

Configure the separate Free-plan Appwrite project using `docs/APPWRITE_SETUP.md`, then run:

```powershell
npm run appwrite:doctor
npm run appwrite:bootstrap
npm run test:live
```

Require all seven cloud checks to pass. Passing the local tests is not a substitute for that evidence. Do not describe the deployment or cloud permissions as verified until the real report exists.

## Continue building

The next product work is the three-screen frontend, registration, persisted batch receipt discrepancies and hosted Function execution. Preserve the server-controlled custody rules. Keep missing samples with their last confirmed custodian. Use Appwrite Teams or effective ACL revocation before real user membership changes.
