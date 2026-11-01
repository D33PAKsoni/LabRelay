# Appwrite Sites frontend hosting - 29 October 2026

**Complete:** [LabRelay is live](https://labrelay.appwrite.network).

Site `labrelay-web` serves active deployment `6ae33994c83334191154` from the existing Frankfurt project `6ae20a1500011bd3e5da`. The user-selected hostname is verified and registered as a web platform. The backend Function and its row-only dynamic scopes remain as previously verified.

## Production verification

- HTTPS returned 200 and the index exactly matched the production build.
- Hosted JavaScript, CSS and service-worker hashes matched local production files.
- Actual server-key and fictional demo-password values were absent from served assets.
- Two fictional users signed in on the production domain. Registration appeared automatically in the courier's workspace; a courier claim appeared automatically in the collector's selected history.
- Both users signed out and their Appwrite WebSockets closed.
- All sixteen fictional test users had zero remaining sessions after verification.

Evidence: [deployment and cleanup audit](site-deployment.json), [HTTPS and asset audit](SITE_HTTP_VERIFICATION.json), [browser results](hosted-site-results.json), and [production screenshot](production-realtime-history.png). The hosted browser integration scenario passed. The earlier Realtime phase's 103 checks remain separate evidence.

The public page requires sign-in to retrieve organization records. Demo credentials remain in ignored local state and are not published. Use fictional records; workflow validation, organizer eligibility clarification, licensing and submission materials remain open.
