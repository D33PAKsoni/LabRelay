# Current LabRelay handoff - 29 October 2026

**Frontend hosting is complete:** https://labrelay.appwrite.network. Production sign-in, two-user Realtime, HTTPS/build assets and test-session cleanup passed. See [SITE_HOSTING_STATUS.md](SITE_HOSTING_STATUS.md).

The online product, persisted batch receipts, nearby-site filtering and authorized Realtime updates are implemented and verified. Current hosting evidence: [SITE_HOSTING_STATUS.md](SITE_HOSTING_STATUS.md) and [site-deployment.json](site-deployment.json). Backend security evidence remains in REALTIME_VERIFICATION.json. Earlier phase reports are historical snapshots.

## Start locally

Workspace: E:\Appwrite\LabRelay

```powershell
npm run dev
```

Open http://127.0.0.1:5173/ for real Appwrite sign-in, or http://127.0.0.1:5173/?preview=1 for the isolated fictional preview. Temporary preview processes were stopped after verification. Fictional demo credentials are in the ignored .local/demo-accounts.json; keep them and the root .env API key out of chat and source control.

The header shows live-update status. Another client's command refreshes the workspace and selected history automatically. New data is always read through the membership-authorized Function. See [REALTIME.md](../docs/REALTIME.md), [batch receipts](../docs/BATCH_RECEIPTS.md) and [nearby sites](../docs/NEARBY_SITES.md).

## Backend

- Project: 6ae20a1500011bd3e5da; Free development project; Frankfurt.
- Endpoint: https://fra.cloud.appwrite.io/v1
- Database: labrelay_spike; ten tables, row security enabled, no table-wide client grants.
- Function: labrelay_api; active deployment: 6ae24d462dc114127563; Node.js 22.
- Execute: users; dynamic scopes: rows.read, rows.write.
- Business rows have no direct browser grants. The new live_updates table contains private per-user refresh signals with no custody payloads.
- The key in .env retains the original setup/test scopes and user-approved functions.read/functions.write. No additional scopes were needed for this phase.
- Three fictional UI accounts belong to lrdemo_org; thirteen spike fixtures belong to lr_org_a/lr_org_b.
- The browser platform hostname 127.0.0.1 is registered. Production frontend assets are dist/web.

## Evidence and boundaries

103 unique checks passed in the Realtime phase, including six real-browser hosted journeys/security tests. That phase's audit, before the hosted owner walkthrough, recorded 865 private business rows, 16 owner-only signal rows, 16 active restored fictional memberships, and zero remaining fictional sessions. The walkthrough added fictional records; after round closure, a fresh audit again confirmed zero sessions across all 16 fictional accounts (validation/SESSION_CLEANUP.json). The archive hash is in REALTIME_VERIFICATION.json.

Live refreshes use 200 ms coalescing and a 30-second authorization/fallback read. Online revocation is detected on the next read; disconnected devices cannot be remotely stripped of already downloaded snapshots. Signal delivery follows the custody transaction and can recover through fallback reads. Pilot workspace/manifest pagination and fanout limits are documented in docs/.

## Next work

Latest deliverable: at the user's request, free synthetic Indian English male narration was added to the short edit. Complete video: deliverables/labrelay-narrated-3min-2026-10-31/LabRelay-complete-Indian-male-English.mp4, 174.97 seconds (2:55), 1080p, AAC narration. Voice is Microsoft Prabhat (en-IN-PrabhatNeural), verified from the live free Edge TTS voice list. All nine spoken sections fit their chapter windows. Audio/video full decode and unclipped peak checks passed; the original video stream was copied. Separate WAV/M4A, exact script, subtitles and metadata are in the same folder. Only fictional narration text was sent to the TTS service. No new Appwrite changes/sessions or product fixes were made. Use this complete narrated version for the current request; previous silent versions remain available.

Latest video delivery: the user requested a maximum three-minute recording. The short edit is deliverables/labrelay-walkthrough-3min-2026-10-31/LabRelay-silent-walkthrough-under-3min.mp4, measured 174.97 seconds (2:55), silent 1080p/30 fps. It retains all core story sections with cuts and variable acceleration. Revised voice-over cues/script and media verification are in the same folder. Complete decode passed and frames from each section were inspected. No new hosted actions or sessions were needed; the original 7:15 version remains available. Use the short edit for the current request.

Recording completed 31 October after the user approved an isolated local browser capture. deliverables/labrelay-walkthrough-2026-10-31/LabRelay-silent-walkthrough.mp4 is a silent 7:15, 1080p video with nine chapters, role cards, voice-over cues and separate clean chapter MP4s. Actual fresh UI-created samples film_1031_595d_a/b in film_1031_595d_batch are now at lab custody, with the two intended batch receipts. Three temporary recording sessions were revoked; the complete MP4 decoded and sampled frames were inspected. No credentials or desktop were recorded, and no product code or deployment changed. See VIDEO_WALKTHROUGH_STATUS.md and the deliverable's evidence/summary files. The previous owner's incomplete validation result remains unchanged; this was scripted recording. Onboarding and transient-message fixes remain deferred until after the user's recording/voice-over work. No further sample actions are needed for this video.

Validate the workflow with intended users, resolve organizer eligibility, choose a code license, prepare the public repository and demo/submission materials. Frontend hosting and production-domain verification are complete.



## Owner workflow round closed with limitations

P01 is the project owner, confirmed directly in chat; no domain experience is claimed. Fictional scenario tag: 0ce752. Raw record: .local/validation/P01.json. Actual responses, task gaps and decisions are recorded; demo sessions are closed. External practitioner validation remains open.


Validation progression: T1 reserved with explicit guidance; T2A offer and T2B courier acceptance verified. T3 owner accepted val_0ce752_arrived individually in Handoff and correctly named Lab receiver. Server verified received/version 5, original missing still courier-held/version 4, and zero receipts for the original batch. Preserve this actual route mismatch; do not mark the batch task complete or undo custody history.

T3R guided retry completed: owner supplied the saved received/missing table. Server verified one receipt e845852490ad7f4d5bb642dac8b50cbd for val_0ce752_delivery_r1: expected 2, accepted 1, missing 1, unexpected 1, repeated 1. arrived_r1 is received/version 5 with lab custody; missing_r1 is in_transit/version 5 with Courier 01 and its original pending offer. The owner did not separately explain unexpected/repeated IDs; facilitator then stated the verified counts. Preserve the assisted classification and the original T3 route mismatch.

T4 owner correctly answered earlier Courier 01/current Lab receiver using Chain of custody. Server verified individual accept_handoff at revision 6, current lab custody, and unchanged first receipt hash. There is still only one retry receipt: the requested second batch check-in was not completed. Do not stage another retry to manufacture success or label the task fully complete. Facilitator reopened the original receipt after the answer; this navigation was not independent participant success. Evidence: T4-current-history.png, T4-first-receipt-unchanged.png, .local/validation/T4-verification.json. Baseline: .local/validation/T3R-receipt-baseline.json.

Debrief complete: owner had not yet read the use case and chose what seemed easy and relevant. Correct the plan's prior familiarity assumption; do not claim an isolated interface cause. Added docs/USE_CASE.md and README link for orientation after the baseline. No label change was requested, and no product code/deployment changed. T5 offline note was optional and not run. Receiver sign-out succeeded; read-only audit confirmed zero sessions for all 16 fictional accounts. Preserve original records, assistance classifications and incomplete batch task. Next implementation follow-up: clear transient success notices on account changes (assistant-observed issue); next validation: intended staff, fresh receipt scenario and consistent orientation. Full results: WORKFLOW_VALIDATION_STATUS.md and .local/validation/P01.json. Do not resume this closed round or create another retry unless deliberately starting new work.

