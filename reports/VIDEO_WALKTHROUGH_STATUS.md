# Video walkthrough preparation — 30 October 2026

## Complete narrated delivery — Indian English male voice

The user requested free synthetic Indian English male narration added to the short edit. Delivered [the complete narrated MP4](../deliverables/labrelay-narrated-3min-2026-10-31/LabRelay-complete-Indian-male-English.mp4), measured at 174.97 seconds (2:55), 1920×1080, with AAC 48 kHz mono narration. The provider's live voice list confirmed Microsoft Prabhat (`en-IN-PrabhatNeural`) as Male / en-IN. Speech was generated using [edge-tts](https://github.com/rany2/edge-tts) without a paid API key; only the fictional narration text was transmitted, with no project credentials or secrets.

Narration was synthesized separately for all nine scenes and aligned to their chapter windows. Small pitch-preserving speed adjustments keep it within the existing video timing; the opening and closing were shortened to fit naturally. Speech levels were normalized with a -16 LUFS target and -1.5 dBTP target. Final decoded audio measured -1.5 dBFS peak and -17.2 dBFS mean, without clipping. Complete video and audio decoding passed. Video was copied without re-encoding. No new Appwrite actions, accounts, sessions, code or deployments were needed.

The deliverable folder also includes separate WAV/M4A narration, the exact final script, timed sentence subtitles, voice details and [verification metadata](../deliverables/labrelay-narrated-3min-2026-10-31/narration-summary.json). This standard synthetic voice is not a recording of the user; the fictional prototype and validation boundaries remain unchanged.

## Short delivery — maximum three minutes

At the user's request, the original live-app footage was edited into [a 2:55 silent MP4](../deliverables/labrelay-walkthrough-3min-2026-10-31/LabRelay-silent-walkthrough-under-3min.mp4). Measured runtime is 174.97 seconds, below the requested 180-second maximum. The export is 1920×1080 at 30 fps with zero audio streams and passed a complete decode check. Sampled frames from all nine edited sections were inspected.

Routine entry, waits and repeated actions were cut or accelerated while retaining the custody distinctions, partial receipt, later matching receipt, original discrepancy and current history comparison. [Revised voice-over cues](../deliverables/labrelay-walkthrough-3min-2026-10-31/VOICEOVER_CUES.md) and [a shorter spoken script](../deliverables/labrelay-walkthrough-3min-2026-10-31/VOICEOVER_SCRIPT.txt) match this edit. The original recording remains available. No new live samples, sessions or custody actions were created for the short edit; no app code or deployment changed.

## Recorded — 31 October 2026

After the user approved recording in a dedicated local browser, the live hosted walkthrough was captured using isolated authenticated browser contexts. Deliverable: [silent MP4](../deliverables/labrelay-walkthrough-2026-10-31/LabRelay-silent-walkthrough.mp4), 7 minutes 15 seconds, 1920×1080, 30 fps, zero audio streams. Includes nine core chapters, chapter cards and a highlighted cursor. Login footage and page warm-up were excluded. The existing user browser and desktop were not captured.

Actual fresh samples: film_1031_595d_a and film_1031_595d_b; batch film_1031_595d_batch. Registration, claims, offers, acceptances and both batch receipts were performed through the live product UI. Server verification confirms both samples at the lab, A at revision 5 and B at revision 6, a first discrepancy receipt (2 expected, 1 accepted, 1 missing, 1 unexpected, 1 repeated), and a second matching receipt for B. The original receipt retains B's earlier courier custody. These scripted results are separate from the incomplete owner-validation task; they do not retroactively complete that task.

The whole exported MP4 decoded successfully. Beginning and ending frames of every clean chapter were inspected; all show app content, with no credential entry. Three temporary recording sessions were revoked. Source viewport was 1600×900, scaled to 1920×1080 for delivery. [Evidence](../deliverables/labrelay-walkthrough-2026-10-31/recording-evidence.json), [media checks and session cleanup](../deliverables/labrelay-walkthrough-2026-10-31/recording-summary.json), [voice-over cues](../deliverables/labrelay-walkthrough-2026-10-31/VOICEOVER_CUES.md), and individual clean MP4s in the deliverable's chapters folder are available for editing. Optional nearby, offline and cross-client Realtime demonstrations are not included in this core recording.

No product source or deployment changed. The planned onboarding and transient-message fixes remain deferred.

## Original script preparation

The owner requested a recording walkthrough and narration before onboarding/message fixes. Prepared [the click-by-click recording guide](../docs/VIDEO_WALKTHROUGH.md) and [separate narration](../docs/VIDEO_NARRATION.txt), using one two-bottle story and a later-arrival batch check-in.

Control labels and transitions were checked against web/main.tsx, web/batch-receiving.tsx and existing product documentation. Proposed take IDs are created manually by the presenter in the registration scene. They were not preloaded, and no new live custody actions, sessions or receipts were created during script preparation. Rehearsals and retakes must use distinct prefixes.

The guide includes expected checkpoints, the distinction between individual and batch receipt, private off-camera role changes, troubleshooting, optional nearby/Realtime/offline shots and a three-minute editing outline. This is not confirmation of a particular submission video length requirement. No recording has been made or verified for the proposed IDs.

No product code, deployment or historical owner-validation result changed. Onboarding and stale-success-message fixes remain deferred until after the recording, as requested. Actual practitioner validation and submission preparation remain open.
