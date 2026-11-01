# LabRelay workflow specification — 27 October 2026

**28 October implementation update:** registration, product screens, real sign-in, hosted Function execution and persisted batch receiving are implemented and verified. See BATCH_RECEIPTS.md, PRODUCT_AND_DEPLOYMENT.md and ../reports/BATCH_RECEIPT_STATUS.md. The original plan below retains its historical scope notes.

**Working audience:** a small water-testing operation with field collectors, couriers and a receiving laboratory. This is a hypothesis awaiting user validation. **Primary task:** understand who last confirmed custody of a sample, record an accountable handoff, and identify a discrepancy before silently marking a batch complete.

## People and screens

| Person | Main action | Interface |
|---|---|---|
| Collector | Prepare the sample and offer it to the assigned courier | Handoff |
| Courier | Claim an available pickup; accept custody; offer it to a receiver | Dispatch and handoff |
| Laboratory receiver | Check the sample manifest and acknowledge the received samples | Handoff and sample history |

The dispatcher uses the dispatch screen; a separate dispatcher permission role is deferred until user research establishes what it needs to do.

## Confirmed state transitions

| Current state | Actor and action | Result | Confirmed custodian |
|---|---|---|---|
| Ready, version 0 | Courier claims | Assigned, version 1 | Collector |
| Assigned, version 1 | Collector offers to assigned courier | Pending handoff, version 2 | Collector |
| Pending handoff, version 2 | Intended courier accepts | In transit, version 3 | Courier |
| In transit, version 3 | Courier offers to laboratory receiver | Pending handoff, version 4 | Courier |
| Pending handoff, version 4 | Intended receiver accepts | Received, version 5 | Laboratory receiver |

A pending handoff is an explicit field on the sample, not proof of delivery. Each accepted mutation advances the sample revision and records a history event. A handling observation also advances the revision without changing custody.

## Offline behavior

An observation saved offline displays **Pending sync — not confirmed by server**. It survives browser reload. Reconnection sends the original operation ID and expected version. Success changes the local state to confirmed. A stale version changes it to **Needs review** and pauses replay for that actor; it is never silently merged into current custody.

If the server commits but its response is lost, the record remains pending. Sending the same operation again retrieves its existing receipt. Observed time and server acceptance time are separate fields. The prototype rejects observation timestamps more than five minutes ahead of the server; it does not treat client clocks as trusted evidence.

## Missing sample scenario

The receiving workflow compares expected IDs against scanned IDs. A missing item remains assigned to its last confirmed custodian; it must not be marked received. Duplicate scans are not extra samples. An unexpected ID is shown separately. The product persists the comparison in an atomic receipt, accepts each matching sample once, and records the missing sample with its confirmed custodian. The server derives the manifest from active offers to the receiver. Later delivery preserves the earlier receipt snapshot. See BATCH_RECEIPTS.md for details and limits.

## Essential acceptance criteria

1. Ten concurrent claims result in one assignment; claim alone does not transfer custody.
2. A sender offer and intended receiver acknowledgment are required for custody to change.
3. A repeated operation creates no additional history, including after a lost acknowledgment.
4. Organization A cannot read or mutate organization B's records.
5. A pending observation survives an offline refresh and becomes confirmed only after server acceptance.
6. A stale observation remains visible for review and leaves confirmed custody unchanged.
7. A receipt shows the exact missing sample and its last confirmed custodian.

## Prototype boundary

Use fictional IDs and locations. Camera scanning and label printing, dispute-resolution UI, reassignment/cancellation, offline-cache policy and frontend publication are subsequent work. Registration, manual/scanner ID entry, batch receipt persistence and the hosted API are implemented. Phone camera permission must have a manual ID-entry fallback. The demonstration should not imply sensor-measured temperature or medically validated handling.


