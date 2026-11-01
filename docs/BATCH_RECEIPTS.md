# Batch receiving - 28 October 2026

Receivers can record a persisted delivery check-in with matching, missing, unexpected and repeated IDs. Matching samples transfer to the receiver once. Missing samples retain their last confirmed custodian and pending handoff.

## Walkthrough

1. Sign in as the intended laboratory receiver and choose **Receive batch**.
2. Select a batch offered to you and choose **Load manifest**.
3. Enter physical label IDs, separated by newlines, spaces, commas or semicolons. Keyboard scanners can enter the same IDs; camera scanning is not implemented.
4. Review the comparison and current confirmed custodian. Empty input needs the explicit **No samples arrived in this check-in** checkbox.
5. Choose **Accept N & record receipt**, or **Record missing samples**. The saved report remains available after refresh in recent receipts.
6. If a missing sample arrives later, choose **Start another check-in** and load a fresh manifest. The earlier discrepancy snapshot remains unchanged.

The expected manifest contains every in-transit sample in the selected batch with a valid active offer to this receiver. Other registered samples remain in Dispatch. **Manifest matched** describes this delivery; it does not certify that every registered sample in the batch has arrived.

## Recorded behavior

- Matching scans accept the existing sender offer, update custody, close its handoff and add a history event.
- Missing scans add a discrepancy event and advance the sample revision while retaining its status, custodian and pending handoff.
- Unexpected IDs are stored as entered. They do not trigger sample lookup, registration or custody transfer, including IDs from another organization.
- Repeated IDs are recorded as a discrepancy. Each matching sample is accepted at most once.
- Each receipt stores the scanned IDs, discrepancy lists, labels, sample revisions and custody before/after that check-in. A later receipt does not rewrite its predecessor.
- Only an active receiver can obtain a manifest or submit a receipt. Reads of saved receipts require active membership in the receipt's organization.

These are application-enforced audit snapshots. Project administrators can still modify database records; the report is not independent proof of physical possession.

## Consistency and retry behavior

The server rebuilds the manifest and requires its exact sample IDs, revisions and batch revision. Registration and all sample mutations also advance the batch revision through a unique revision record. An intervening change or competing transaction rejects the stale receipt without partially changing custody.

Sample updates, events, accepted handoffs, the receipt, operation result and batch revision commit in one TablesDB transaction. The actor-scoped operation ID makes an identical retry return the original result, including after a committed response is lost. Reusing an operation ID with changed input is rejected.

New receipts require connectivity. The durable queue retains an uncertain result for retry; rejected or stale requests need explicit review and a fresh manifest. Previously loaded receipts can be read from the actor-separated workspace cache offline. The service worker does not cache authentication or API responses.

## Schema and API

The existing six tables are joined by `batches`, `batch_changes` and `batch_receipts`. Those nine business tables now have no direct browser grants. A tenth private signal table supports Realtime; all tables use row security without table-wide client grants. Receipt details use a required `text` column. Bootstrap reuses the owned `labrelay_spike` database on the existing Free project.

| Route | Purpose |
|---|---|
| GET /batches/:batchId/manifest | Derive the intended receiver's current manifest |
| POST /commands, kind reconcile_batch | Validate and commit the receipt |
| GET /receipts/:receiptId | Read an organization-authorized snapshot |
| GET /workspace | Include the latest 20 organization receipts and a truncation flag |

Pilot limits: at most 100 registered samples per batch, at most 20 active offers in the selected receiver's manifest, at most 60 scan entries and 16,000 JavaScript string units of receipt details. A larger active manifest is rejected; the UI does not split it. A 20-sample matching receipt uses 64 transactional writes. Larger manifests and workspace/history pagination remain subsequent work.

## Evidence

See [BATCH_RECEIPT_STATUS.md](../reports/BATCH_RECEIPT_STATUS.md) and [BATCH_VERIFICATION.json](../reports/BATCH_VERIFICATION.json). Domain, browser, real TablesDB and deployed Function checks cover concurrent receipts, partial delivery, unchanged missing custody, repeated scans, stale manifests, role/organization isolation, lost responses and later arrival. All records used for these checks are fictional.

