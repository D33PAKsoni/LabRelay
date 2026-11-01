# LabRelay recording walkthrough

Prepared 30 October 2026 against the current app controls. Record this version before the planned onboarding and success-message fixes. This is a scripted product demonstration using fictional water samples, not an intended-user study or proof of real sample handling.

Live app: https://labrelay.appwrite.network/

A [silent recording](../deliverables/labrelay-walkthrough-2026-10-31/LabRelay-silent-walkthrough.mp4) was completed on 31 October using fresh filming IDs rather than the proposed take1 IDs below. Its [timestamped voice-over cues](../deliverables/labrelay-walkthrough-2026-10-31/VOICEOVER_CUES.md) match the actual footage. The guide below remains available for another manual take.

Allow 6–8 minutes for a comfortable walkthrough, excluding login pauses. An optional three-minute edit is below; this is an editing suggestion, not a verified submission duration limit. Narration alone is in [VIDEO_NARRATION.txt](VIDEO_NARRATION.txt).

## Before recording

1. Read [the one-minute use case](USE_CASE.md). The central rule is: assignment reserves work; acceptance changes confirmed custody.
2. Use the existing fictional collector, courier and receiver accounts. Find their credentials privately in `E:\Appwrite\LabRelay\.local\demo-accounts.json`. Do not record that file, passwords, the root `.env`, or sign-in entry. Use the live URL, not the local preview.
3. Maximize the browser. Open this script on a second screen or print it. Use fictional paper labels A and B if you want a physical prop; say they are demonstration labels.
4. Pause or cut the recording during each role sign-in. Use **Open navigation → Sign out**, then sign in with the next account and click **Open workspace**. Production has no role-switching dropdown. Show a small role caption when resuming.
5. After a role change, check the account name. The current app can retain a previous success notice: dismiss it before the next shot. Check the actual sample status and confirmed custodian after each action, rather than relying only on a toast.
6. Rehearse with a different prefix, such as `vid1030_practice`. Use the IDs below for a fresh recording take. If an ID already exists, change `take1` to `take2` everywhere, including scans and batch ID. Never undo custody history or reuse the old validation samples to recreate a take.
7. This guide creates both samples through the UI. It has not preloaded these proposed IDs or performed their custody actions.

## Your filming data

| Field | Bottle A | Bottle B |
|---|---|---|
| Sample label | Video demo - River water A | Video demo - River water B |
| Sample ID | `vid1030_take1_a` | `vid1030_take1_b` |
| Batch ID | `vid1030_take1_batch` | `vid1030_take1_batch` |
| Collection site | Fictional north bank collection site | Fictional north bank collection site |

Unexpected scan: `vid1030_take1_x`. Do not register X. In the story, A arrives first, B arrives later, and X is an unexpected physical label.

For single-sample work, choose **Handoff**, type `vid1030_take1` in **Find a sample**, then select A or B. This finder searches sample IDs/labels, so use that prefix, not the batch ID. If using Dispatch instead, set **All statuses**, clear any distance filter and use the row arrow (**Open handoff for…**); clicking a sample's name opens its history.

## Scene 1 — Introduce the problem · 20–30 seconds

**Show:** The sign-in page or the collector's Dispatch screen. Keep sign-in details off camera.

**Say:**

> This is LabRelay, a prototype for accountable water-sample handoffs from the field to a laboratory. The question is simple: who last confirmed possession of each bottle? I’ll follow two fictional samples through collection, transport and laboratory check-in, including a bottle that arrives late.

## Scene 2 — Register the samples · 45–60 seconds

**Role:** Demo field collector.

**Do:**

1. Click **Register sample**.
2. Replace the generated values with A's label, sample ID and batch ID from the table. Choose the named collection site.
3. Click **Register sample** in the form. Wait for the server confirmation.
4. Repeat for B, using the same batch ID. You may cut the repetitive form entry, but actually perform it.
5. Open A in Handoff. Point to **Ready for pickup** and **Confirmed custodian: You · Field collector**.

**Say:**

> As the collector, I register each bottle with a physical-label ID, a collection site and a shared batch. These are two separate samples travelling together. Registration records collection; it does not imply a handoff. The collector is still the confirmed custodian.

**Checkpoint:** Both samples exist and are ready; collector custody remains.

## Scene 3 — Reserve pickup without transferring custody · 30–45 seconds

**Switch off camera:** Collector → Demo courier.

**Do:**

1. Open A in **Handoff** and click **Claim pickup**.
2. Wait for **Pickup assigned**. Point to **Confirmed custodian: Field collector**.
3. Select B and click **Claim pickup** as well. Cut this repetition if needed.

**Say:**

> The courier claims the pickup to reserve the work. The status becomes Pickup assigned, but the collector remains the confirmed custodian. Planning a collection is different from physically taking possession.

**Checkpoint:** Both samples are assigned to Courier 01; collector custody remains.

## Scene 4 — The collector offers possession · 30–45 seconds

**Switch off camera:** Courier → Demo field collector.

**Do:**

1. Open A in Handoff.
2. Verify **Intended receiver: Courier 01**; click **Offer handoff**.
3. Point to **Awaiting acceptance**, **Waiting for the receiver**, and unchanged collector custody.
4. Repeat the offer for B.

**Say:**

> The courier has arrived, so the collector offers each sample to Courier 01. An offer is still not a completed transfer. The collector remains the confirmed custodian until the intended courier accepts possession after checking the physical label and seal.

**Checkpoint:** Both have pending offers to Courier 01; collector custody remains.

## Scene 5 — Courier accepts, then offers to the laboratory · 60–75 seconds

**Switch off camera:** Collector → Demo courier.

**Do:**

1. Open A. In this fictional scenario its ID and seal match and the courier has the bottle.
2. Click **I have this sample · accept custody**.
3. Point to **In transit** and **Confirmed custodian: You · Courier 01**.
4. In **Intended receiver**, choose **Lab receiver**; click **Offer handoff**.
5. Repeat acceptance and the lab offer for B.
6. Verify both now show **Awaiting acceptance**, with Courier 01 still the confirmed custodian.

**Say:**

> After checking the bottle and taking possession, the courier accepts the offered handoff. Now confirmed custody changes to Courier 01 and the sample is in transit. The courier then offers both bottles to the lab. That new offer leaves custody with the courier until the laboratory acknowledges receipt.

**Checkpoint:** Both samples have active offers to the lab. Do not accept either individually as the lab: the next scene needs both offers on the batch manifest.

## Scene 6 — Receive the partial delivery · 60–90 seconds

**Switch off camera:** Courier → Demo lab receiver.

**Do:**

1. Click **Receive batch**. The header should say **Batch receipt**.
2. Choose `vid1030_take1_batch` in **Batch offered to you**.
3. Click **Load manifest**. Confirm **2 expected samples**, both held by Courier 01.
4. Paste these three lines into **Scanned sample IDs**:

```text
vid1030_take1_a
vid1030_take1_a
vid1030_take1_x
```

5. Point to the comparison: Expected 02, Matching 01, Missing 01, Unexpected 01, Repeated IDs 01.
6. Click **Accept 1 & record receipt**. Wait for **Discrepancies recorded** and the saved report.
7. Point to A **Accepted at lab / You · Lab receiver** and B **Missing · custody unchanged / Courier 01**. Show the unexpected and repeated ID sections.
8. Capture this report now. Its time and receipt ID identify the first check-in when you return later.

**Say:**

> At the lab, I use Receive batch to compare the delivery with samples currently offered to me. Only A arrived. I deliberately scan A twice and include an unexpected label. The comparison flags one match, one missing bottle, one unexpected ID and one repeated ID.
>
> Saving accepts A once. B stays with Courier 01 in the confirmed record, and the discrepancy is preserved. The unexpected label does not create or receive another sample. This report captures what happened at this check-in.

**Checkpoint:** One saved receipt: 2 expected, 1 accepted, 1 missing, 1 unexpected, 1 repeated. B remains courier-held and offered to the lab.

## Scene 7 — The missing bottle arrives later · 45–60 seconds

**Role:** Stay signed in as Demo lab receiver.

**Do:**

1. In the saved report click **Start another check-in**.
2. Select the same batch if necessary, then **Load manifest**. Only B should now be expected.
3. Paste only `vid1030_take1_b` into **Scanned sample IDs**.
4. Click **Accept 1 & record receipt**.
5. Show **Manifest matched**: 1 expected, 1 accepted, no discrepancies in this later check-in.

**Say:**

> B arrives later. I start another batch check-in, load a fresh manifest and scan B. This records a second receipt and transfers B to the lab. I am using a new batch check-in here, rather than the individual acceptance button, so the later delivery has its own receipt.

**Checkpoint:** A second receipt exists; B is now with the lab. The later manifest matches its one outstanding offer, not a new two-bottle delivery.

## Scene 8 — Show history without rewriting the first delivery · 45–60 seconds

**Do:**

1. In **Recent receipts**, select the older entry for this batch: it says **Discrepancy**, **1/2 accepted · 1 missing**. Do not select the newer **Matched**, **1/1 accepted** entry.
2. Show that the first report still says B was missing with Courier 01 at that check-in.
3. In B's row, click its History arrow (**History for vid1030_take1_b**). Show **Chain of custody** and the current **Confirmed custodian: You · Lab receiver**.
4. Point to **Missing at batch receipt**, followed by **Accepted in batch receipt**. The latter confirms you used the later batch path. An event called only **Custody accepted** indicates individual acceptance instead.

**Say:**

> The original receipt still shows B missing with Courier 01. That is the earlier snapshot, not B's current holder. The custody history shows the later batch acceptance, and the current custodian is now the laboratory receiver. The new arrival adds to the trail instead of rewriting the first report.

## Scene 9 — Explain Appwrite and close · 25–40 seconds

**Show:** The app and its live-update indicator. An architecture slide is optional; the indicator alone is not a demonstration of cross-client updates.

**Say:**

> LabRelay uses Appwrite for sign-in, TablesDB records, an authenticated Function for membership and custody checks, authorized Realtime refreshes, and Sites hosting. The demo shows assignment versus possession, a two-sided custody transfer, and partial deliveries with preserved receipt history. This is a fictional prototype demonstration; feedback from people doing collection and laboratory receiving is still the next validation step.

Pause recording, then sign out. This core video does not demonstrate offline operation or cross-client Realtime; use the optional segments below only if you actually film them.

## If something does not match

| What you see | Check before continuing |
|---|---|
| A sample name opens history | Use Handoff and the sample picker, or the Dispatch row arrow, for custody actions. |
| A sample disappears after a status change | Set Dispatch to All statuses; clear distance/search filters. Search the take prefix in the detail picker. |
| No batch, or only one expected sample, before Scene 6 | Both samples must have been accepted by the courier and offered to the lab. If already accepted by the lab, they have left the active manifest. Use a fresh take; do not undo history. |
| Old success notice after switching roles | Dismiss it during the cut and inspect current custody. This known UI cleanup is scheduled after recording. |
| Saved on this device / pending sync | Wait for connectivity and server confirmation. Do not narrate that custody transferred yet. |
| Second report still has old scans | Confirm Start another check-in → Load manifest, and enter only B. |
| No second receipt after later arrival | Individual acceptance updates custody but creates no batch receipt. Preserve that take's history; use fresh IDs to record the intended path. |

## Optional feature shots — record separately after the core story

**Nearby sites, 20 seconds:** In Dispatch select **Reference collection site** and **Search radius**, click **Find nearby sites**, show the sorted site distances, then **Clear distance filter**. Say: “I can narrow the loaded workspace to nearby collection sites. These are approximate straight-line distances between sites, not live courier GPS or route planning.”

**Realtime, 20–30 seconds:** Rehearse Scene 3 with independent browser sessions: for example Edge normal as collector and Edge InPrivate as courier. Two normal tabs share the same sign-in, so they are not two roles. Keep the collector viewing A while the courier claims A, and film the collector's view updating without a refresh. Say: “Another signed-in client's change refreshes the authorized workspace. The claim updates assignment while collector custody remains unchanged.” Sign out both sessions afterward.

**Offline observation, 30–45 seconds:** After the core story, while the lab holds B, load B's detail/history online. In browser Developer Tools → Network, select Offline. In **Handling observation** enter “Demo observation: seal intact at laboratory receipt.” Click **Save pending observation** and show that it is saved on this device, not confirmed. Return Network to its normal online setting, wait for sync, and show the Handling observation in history. If needed, use **Retry original requests** for the existing queued request. Say: “Handling notes can be saved locally during a connection gap. They are confirmed only when synchronization succeeds. Custody transfers and new batch receipts require a connection.” Rehearse this before filming; do not imply the core video already demonstrated it.

## Optional three-minute edit

| Time | Keep |
|---|---|
| 0:00–0:20 | Problem and the two fictional bottles |
| 0:20–1:15 | One registration; claim preserving custody; sender offer; courier acceptance and lab offer. Cut repeated B actions and logins, retaining accurate state. |
| 1:15–2:05 | Two expected bottles, three scan entries, saved partial receipt and unchanged missing custody |
| 2:05–2:40 | Later B check-in, older receipt unchanged, current custody/history |
| 2:40–3:00 | Appwrite components and honest prototype closing |

Keep the causal sequence intact. Leave enough time to read both the missing-custody row and the later history. Verify the actual submission video requirements before making a submission-specific cut.
