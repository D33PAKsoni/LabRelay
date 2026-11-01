# Technical decisions and evidence

**29 October evidence update:** the product, receipts, nearby sites and authorized Realtime are implemented and verified. See ../reports/REALTIME_STATUS.md. Direct business-row grants were removed; the Function rechecks membership on every read. Offline-cache policy and larger-workspace pagination remain follow-ups.

| Choice | Reason | Alternative considered | Verification still required |
|---|---|---|---|
| TablesDB | Structured custody records, transactions, geographic query support and row permissions fit the workflow | DocumentsDB flexibility and managed SQL | Live cloud isolation, row ACL and index readiness |
| TypeScript service and Function | Shared record types and one language reduce integration work | Separate Python/FastAPI service | Hosted Function deployment and execution scopes |
| Server-side transitions | Clients cannot directly rewrite the custody state or history | Browser-to-database writes | Real JWT permissions and hosted authentication |
| Unique event per sample revision | A request that reads an old sample before transaction staging still conflicts with the existing next revision | Relying only on application version checks | Prove the actual database rejects competing event inserts atomically |
| Operation receipts | Safely resolve a response lost after commit | Blindly retrying with a fresh operation ID | Appwrite conflict/timeout handling under real requests |
| Dexie local queue | Browser durability for a small set of outgoing observations | Broad automatic replication | Browser refresh and reconnect tests |
| Pending offline acknowledgments | Prevents false confirmation before authoritative validation | Optimistically overwriting custody | Conflict resolution UX |
| Membership table | Keeps role and organization under server control | Accepting role in each request | Records remain server-only; verify offline policy and larger membership/pagination needs before real users |
| No core LLM | Custody decisions have explicit verifiable rules | LLM-based workflow agent | User research may identify a separate useful language task |

## Concurrency design

Every accepted command commits a sample update, an event with a deterministic next-revision primary key, any handoff change, and an actor-scoped operation receipt. All are inside one Appwrite transaction. The receipt key includes organization, actor and operation ID; its fingerprint binds the normalized request payload.

Two clients that both read revision N attempt to create the same revision N+1 event. At most one can own that unique record. A transaction conflict leads to retrieval of the operation receipt if this was a duplicate request; otherwise the client must refresh and review. There is no unbounded automatic retry that could accept a changed meaning.

The local adapter models uniqueness and all-or-nothing commits with a forced concurrent interleaving. That validates our logic, not Appwrite's implementation. Seven live checks are supplied for the latter. A lost or timed-out commit response remains an unknown result until the original operation is retried.

## Important limits

- Legacy direct-read grants have been removed. Realtime carries a private random refresh signal; membership-authorized Function reads return records. Online revocation is detected on the next read, normally within 30 seconds while active. Disconnected-device caches require an explicit operational policy.
- One organization per user is supported in the spike. Cross-organization logistics and multiple memberships are future design work.
- The default local browser checks use an in-memory backend and fictional identities. They do not exercise hosted Appwrite Authentication.
- Database history is append-only through application rules, not administrator-proof storage.
- A QR scan or click is a reported acknowledgment; it cannot establish physical delivery independently.
- No interviews or field trials have been completed in this session.

## Day-two entry gate

Proceed to product UI after the live transaction and access checks pass or a clearly documented substitute is agreed. Revisit scope if the cloud spike fails; polish must not hide a failed invariant.

