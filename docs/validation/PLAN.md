# LabRelay workflow validation round 1 - 29 October 2026

Live app: https://labrelay.appwrite.network

## Evidence and current round

The project owner agreed to perform the first walkthrough and explicitly described their experience as **project owner**. This is a facilitated internal usability session. No field collector, courier or lab-worker interview has taken place yet. Prior automated checks demonstrate technical behavior and remain separate evidence.

Participant P01 performs fictional role tasks one at a time. Facilitator sign-in and scenario preparation are setup assistance, recorded separately from help with the task itself. The initial plan assumed project familiarity from ownership; the actual debrief corrected that assumption: P01 had not yet read the use case and chose actions that seemed easy and relevant. Record this as an unbriefed owner trial. It cannot establish adoption or demand from intended users.

## Decisions this round should inform

| Question | Task evidence | Change decision |
|---|---|---|
| Does reserving a pickup communicate the difference between assignment and confirmed custody? | P01's actions and custodian explanation after T1 | If confused, revise the claim/result wording and retest the same concept with fresh data. |
| Can someone complete the sender-offer / receiver-accept sequence without assuming an offer is a completed transfer? | T2, task completion and explanation | If unclear, expose the pending recipient and required next action more clearly. |
| Can a receiver record partial arrival while preserving a useful missing-sample trail? | T3, receipt and missing-custodian explanation | If misunderstood or blocked, revise comparison/report presentation before promoting the flow. |
| Does a later delivery preserve an understandable earlier discrepancy? | T4, participant's history comparison | If the owner confuses current and historical custody, revise snapshot wording/history navigation. |
| Does pending/offline status prevent a false sense of server confirmation? | Optional T5, explanation before and after reconnection | If unclear, revise confirmation and review cues. |

Do not infer task success from a successful backend transaction alone. Record the participant's explanation, actual committed state, help given and any uncertainty. Record elapsed time only if measured or explicitly estimated by the participant; chat-response delay is not task duration.

## Moderation

Present one task at a time without naming the intended button or explaining the answer. Let the participant try; if stuck, record the first attempted route and the blockage before giving a hint. Stop immediately if someone would enter real sample/person information. Use fictional labels only.

After each task ask what they tried, what they think changed, and what was confusing. Capture their wording before explaining the intended state. Ask a neutral follow-up if a statement is ambiguous. Keep observed state and reported behavior in separate fields.

For P01, a completed round means the critical tasks have been attempted, responses recorded, state checked, and a specific keep/change/retest decision written. It does not mean external workflow validation is complete.

## Intended-user follow-up

After the internal session, seek people with recent collection, transport and lab-receiving experience. Record actual experience and which role each person covers. If one person covers multiple roles, retain one participant ID rather than presenting them as several independent people. This is a small qualitative pilot; do not present its results as prevalence or market proof.

Before showing the app, ask about the last handoff they actually completed: their expected list, discrepancy process, current custody record, connectivity and time pressure. Ask which of the proposed steps would add work. In particular, establish whether the lab's authoritative expected manifest includes samples that a courier has not offered electronically.

Keep a proposed change tied to an actual response or an explicitly labeled review hypothesis. Confirm terminology and acknowledge the offline-cache/pagination pilot boundaries before real operations.

## Files

- [TASKS.md](TASKS.md): participant prompts and moderator setup.
- [REVIEW.md](REVIEW.md): assistant hypotheses and separately labeled owner evidence.
- `.local/validation/current.json`: fictional scenario IDs; no credentials.
- `.local/validation/P01.json`: raw owner responses and task record, kept local.
- [Current status](../../reports/WORKFLOW_VALIDATION_STATUS.md).

Use `node --env-file-if-exists=.env scripts/prepare-validation.mjs` to resume the prepared scenario. Pass `--new` only when deliberately starting a fresh round. Existing demo credentials stay in the ignored `.local/demo-accounts.json` file; no new accounts or password changes are needed. Keep the current fictional role session only while needed for a round, then sign it out. P01's round is now closed with limitations; all 16 fictional accounts were audited with zero sessions. [LabRelay in one minute](../USE_CASE.md) was added after the debrief for future orientation; earlier answers remain unbriefed evidence.
