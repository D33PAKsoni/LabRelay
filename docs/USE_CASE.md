# LabRelay in one minute

LabRelay helps a water-testing team record who last acknowledged holding each sample as it travels from a collection site to a laboratory. A collector labels a bottle, a courier transports it, and a lab receiver checks it in. The demonstration uses fictional samples.

## Follow one bottle

1. The **collector registers** the sample and remains its confirmed custodian.
2. A **courier claims the pickup**. This reserves the work; the collector still holds custody.
3. The **collector offers the handoff**. After checking the physical sample ID and seal and taking possession, the intended courier accepts. Custody changes to the courier.
4. The **courier offers it to the lab receiver**. The receiver checks the bottle and accepts possession, individually or through a batch check-in.

The recorded custodian changes when the intended receiver accepts. A reservation or an offer alone does not transfer custody.

## Choose the receiving route

| Your goal | Use | Saved result |
|---|---|---|
| Acknowledge possession of one offered bottle | Individual sample handoff | Its custody transition and history |
| Compare a delivery with its expected offered samples | Receive batch | A receipt with accepted, missing, unexpected and repeated IDs, plus matching custody transitions |
| See how custody changed over time | Sample history / Chain of custody | The recorded sequence of events |

Individual acceptance is valid, but does not create a batch receipt. The batch manifest includes samples currently offered to that receiver; an already accepted sample is no longer on that active manifest.

## Example: two bottles expected, one arrives

The lab expects A and B. The physical scans are A, A and an unexpected label X. A batch check-in accepts A once, records B as missing with the courier, and records the repeated A and unexpected X. X does not become a registered or received sample.

When B arrives later, start another check-in for the same batch and scan B. The new receipt records its arrival. The first receipt keeps its original missing result; Chain of custody shows B's later transfer to the lab. If B is accepted individually instead, its current custody is still updated, but no second batch receipt is created.

For the complete controls and limits, see [batch receiving](BATCH_RECEIPTS.md). Recorded acknowledgments describe the app's custody trail; they are not independent proof of physical possession.
