# Participant task cards and moderator setup

Read only the current participant prompt aloud. Do not show a later task or an answer key before the participant responds. Substitute IDs from `.local/validation/current.json`. Setup accounts are fictional and role-scoped; use separate browser contexts or facilitator-assisted sign-out/sign-in when changing role.

## T1 - Arrange a pickup (courier)

**Prompt:** You are planning your next collection. Arrange to collect PICKUP_ID, labeled PICKUP_LABEL. You have not met the collector yet. Stop once the pickup is reserved. Describe what you tried, who the app now lists as confirmed custodian, and anything confusing.

**Setup:** Start in Dispatch, signed in as the fictional courier. Ensure PICKUP_ID is ready. Do not pre-filter or open the sample for the participant. Keep prior development records visible; finding the correct fictional label is part of the task. If the label list itself becomes the barrier, record that before helping.

**Record:** Actual click path if reported/observed; assistance; current custodian explanation; visibility of the next step; final server revision. A failure to explain custody remains a comprehension issue even if the reservation commits.

## T2 - Hand the sample to the courier (collector, then courier)

**Prompt to collector:** The courier has arrived for PICKUP_ID. Prepare the handover in the app and explain what still needs to happen before the recorded holder changes.

**Prompt to courier after the collector finishes:** The collector has given you the matching physical bottle. Complete your side of this handover and explain how you checked the result.

**Setup:** Use the same pickup from T1. Facilitate role sign-in only. Do not click custody actions on the participant's behalf. If T1 was blocked, record any facilitator correction before proceeding.

## T3 - Receive a partial delivery (lab receiver)

**Prompt:** You have a delivery for DELIVERY_BATCH. The physical bottles in front of you have these scanned IDs, in this order: ARRIVED_ID, ARRIVED_ID, UNEXPECTED_ID. Record what arrived, then identify anything that needs follow-up and who the app last recorded holding the outstanding sample.

**Setup:** The scenario prepares two valid laboratory offers in that delivery batch. Present the three IDs as physical-label evidence. Do not name the intended screen or describe the missing/duplicate categories in advance.

**Record:** Where the participant starts, how they establish the expected list, whether they inspect custody before committing, their reading of the saved report, and whether they distinguish an unexpected label from a newly received registered sample. Verify the saved record after their explanation.

## T4 - A later bottle arrives (receiver)

**Prompt:** The remaining bottle MISSING_ID arrives later. Record its arrival and show what your earlier check-in says about that first delivery. Explain who held the bottle at each check-in.

**Setup:** Begin only after T3 is saved, retaining the original report. Do not remove or rewrite historical data. Record any help with locating the earlier report.

## T5 - Handling note during a connection gap (optional)

**Prompt:** While you hold a sample, its seal is intact. You lose connectivity before recording that note. Record what you can, explain what is confirmed, and then reconnect and check the result.

**Setup:** Use a sample the current participant's fictional role actually holds. Load it online first. Let the facilitator simulate offline/online only after explicitly telling the participant when connectivity changes. Do not create a conflicting custody event without a separate, clearly described test scenario.

## Post-task questions

1. Which step made you pause, and what did you expect to happen?
2. Which words or labels would you change?
3. Does the expected-delivery list fit how you think a receiving lab would work? For P01 this is a design opinion; ask experienced participants about their actual list/process separately.
4. What would prevent you using this during a busy shift? Project-owner speculation and actual operating experience must be labeled separately.
5. Which single change should be tested next?

Facilitator results are stored privately in P01.json. Leave a task as not_run, in_progress, blocked, or reported_complete until there is actual evidence to justify a stronger conclusion. Record any hints as assistance; do not silently label helped completion as independent.
