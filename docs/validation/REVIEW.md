# Assistant workflow review - 29 October 2026

This is a source/interface review, not a user interview. These are questions to test; none is claimed as an observed participant failure. The live implementation and earlier screenshots/tests supply the evidence named below.

| Review question | Evidence and implication | Priority |
|---|---|---|
| Does the lab expect all dispatched samples, or only electronically offered samples? | `src/domain/batch.ts` derives the receipt manifest from valid active offers to this receiver. `web/batch-receiving.tsx` explains that other registered samples remain in Dispatch. A missing electronic offer could therefore fall outside a matched delivery. Validate this definition with a receiving practitioner before describing the flow as complete batch reconciliation. | High: domain assumption |
| Does the two-sided handoff fit the participants' time and devices? | Claim, sender offer and intended receiver acceptance are separate actions. Existing tests prove the distinction is enforced; only people performing the work can judge whether the interaction cost is acceptable. | High: adoption assumption |
| Can people identify the actual person who last held a bottle? | `web/main.tsx` maps development identities to labels such as Field collector and Courier 01. `src/product.ts` returns member IDs/roles. These labels support fictional scenarios; test what staff identifiers a real team needs rather than treating fixture labels as a validated identity scheme. | High before real teams |
| Can a mobile participant find confirmed custody promptly? | Dispatch uses a horizontally scrollable table, with custodian after status and optional distance. Earlier `reports/nearby-dispatch-mobile.png` shows the narrow layout. The detail view exposes custody separately. Test discoverability rather than equating no page overflow with usability. | Medium: findability hypothesis |
| Can someone distinguish committed state from an uncertain local request? | Durable pending actions and the server-confirmed workspace can coexist after a lost response. Existing retry tests cover correctness. Ask the participant to explain which action is still pending without coaching. | High: comprehension hypothesis |
| Do overview totals and filtered rows imply the same scope? | Nearby filtering changes the table while summary counts describe the loaded workspace. The footer names the shown/loaded count. Test whether this scope is clear if participants use distance filtering. | Medium: optional dispatch task |

## Changes deliberately waiting for evidence

Do not rename custody roles, collapse acknowledgments, broaden a delivery manifest, or alter pending/retry behavior just to make the walkthrough easier. Record the response first and tie any change to a decision. The current run stages fictional data and signs into a test role without changing product behavior.

## Owner walkthrough evidence added during the baseline

P01 reported accepting the delivered bottle individually in Handoff during T3. Server reads confirmed lab custody for that bottle and no batch receipt. This establishes a mismatch between the intended batch task and the route taken, without establishing its cause. The task wording, prior individual-handoff practice, retained starting screen and interface discoverability remain possible contributors. A guided retry uses a fresh fictional delivery and explicit batch navigation; its completion must be labeled assisted. After the round, review how the app distinguishes individual acceptance from a batch check-in and retest with an intended user.

The guided T3R partial receipt was subsequently saved with the intended counts and correct missing custody. In T4, the owner correctly explained historical/current custody from Chain of custody, but again used individual acceptance: no second batch receipt exists. The original receipt was unchanged by a canonical SHA256 comparison. Treat this as a repeated task/route mismatch to explore in the owner debrief, without claiming a custody correctness failure or an established interface cause.

In the actual debrief, P01 said they had not yet read the use case and selected what seemed easy and relevant. This supplies participant context for the route choice; it does not isolate a control defect or establish how a practitioner would behave. The next informed review should begin with the new [one-minute guide](../USE_CASE.md), while a separate unassisted practitioner trial should record its orientation consistently. Preserve the first trial rather than relabeling it after teaching the workflow.
