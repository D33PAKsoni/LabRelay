# Verification artifacts

Current sign-off: PRODUCT_PHASE_STATUS.md and PRODUCT_VERIFICATION.json.

- unit-results.xml: 24 passing unit/contract checks.
- browser-results.json: four passing offline diagnostic scenarios.
- product-browser-results.json: six passing product scenarios including offline refresh and 390px layout.
- product-cloud-results.json: four passing product route checks against real Appwrite Auth/TablesDB.
- hosted-function-results.json: four passing checks through the deployed Function.
- cloud-ui-results.json: one passing full real-browser hosted journey with three accounts and sign-out.
- function-deployment.json: active deployment identity, runtime and execution scopes.
- demo-setup.json: fictional account setup verification without credentials.
- product-dispatch.png, product-history.png, product-mobile.png: fictional preview captures.
- hosted-product-history.png: real browser capture after hosted laboratory receipt.
- LOCAL_HANDOFF.md: current setup and next task.

The current phase has 43 passing checks. The historical seven-check spike result remains cloud-results.json and LIVE_CLOUD_VERIFICATION.md. DAY_ONE_STATUS.md preserves the original planning record.

API keys, generated passwords, JWTs and session secrets are excluded. The ignored .local directory is not part of the shareable package.
