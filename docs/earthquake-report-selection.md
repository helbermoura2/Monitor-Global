# Stable earthquake solution selection

## Vanuatu reproduction, 20 October 2026

Read directly from the public USGS FDSN and real-time catalogues (no project
Worker/DO calls). The two origin times differ by 1.737 seconds; positions are
nearby and aliases link the same event:

| Native ID | Network | Magnitude / scale | Status | Updated (epoch ms) |
|---|---|---|---|---|
| us6000u3jl | us | 6.3 mww | reviewed | 1792477739943 |
| pt26293000 | pt | 6.6 Mi | REVIEWED | 1792470573579 |

The FDSN response contained both. The real-time day summary contained the
reviewed us6000u3jl solution only, with pt26293000 among its associated IDs.
The PT record also listed usauto6000u3jl, the automatic alias of us6000u3jl.
Catalogue data can change after this snapshot; these are observations, not a
hard-coded magnitude for Vanuatu.

The previous merge preferred a larger magnitude when review status and source
rank tied. It also overwrote the per-agency magnitude with the last encountered
report. Thus a published rapid tsunami-centre Mi estimate could replace a
reviewed seismic mww solution when the catalogue mix changed.

## Policy

- Keep native network, magnitude scale, associated IDs and source update time.
- Prefer reviewed to preliminary solutions as before. Within USGS, prefer its
  seismic `us` solution to the distributed tsunami-centre rapid solution.
- Compare update time for competing versions from the same agency. Treat
  USGS summary and FDSN channels as the same agency, rather than giving stale
  FDSN data precedence over newer summary data.
- Retain previously seen USGS solutions only when native/associated IDs link
  them to a currently returned event; do not resurrect unrelated old events.
  Normalize the explicit USGS `usauto` alias prefix for this linkage.
- Select equal-ranked agencies deterministically; a larger magnitude is not a
  tie breaker. Preserve real inter-agency divergence in the displayed breakdown.
- Compute the primary solution, coordinates, depth and per-agency magnitude
  breakdown consistently from the same selected reports.
- Accept genuinely newer upward AND downward revisions. The revision threshold
  uses a floating-point tolerance so 6.3→6.2 is not missed as 0.099999999… .

All changes are client-side: no additional polling, Worker or Durable traffic.
Tests use offline snapshots, alternating stale/summary/full catalogues and the
real ingestion path, checking stable identity, no phantom revision badges or
camera queue, and acceptance of a genuine subsequent revision.

## Partial agency failure follow-up

The first fix linked retained USGS reports only while some USGS report was
returned. If BOTH USGS paths were missing but EMSC/GEOFON still supplied this
event, a lower-priority M6.6 estimate could become primary; the next successful
USGS response restored M6.3. This is separate from two USGS solution IDs.

After the existing canonical event match, reconcile that event's previous raw
agency reports with its current reports before testing for revisions. An absent
agency response does not withdraw its last published reviewed solution. Fresh
versions supersede old versions according to the existing policy. Reconciliation
must still produce one physical event, otherwise the current event is preserved.
No previously absent event is inserted into the current catalogue.

The regression now alternates actual simulated USGS failures, PTWC-only USGS,
realtime and complete responses while EMSC/GEOFON continue supplying different
magnitudes. Twelve cycles keep M6.3/16 km and one ID without revision badges or
camera queue; a newer M6.2 update is still accepted. A session previously showing
M6.6/10 km may correctly show one M6.6→6.3 / 10→16 km correction after rollout.

## Telegram coordinator policy

The Telegram sender is a separate Worker path. It previously treated every
changed network estimate as a replacement of `root.currentEvent`, editing the
photo and queueing a reply. Frontend-only fixes do not change this path.
`worker/seismic-solution-policy.mjs` now gives USGS-distributed seismic network
solutions precedence over the rapid PT/AT/USAUTO tsunami-centre solutions.
The full catalogue is processed with the preferred solutions first. A secondary
estimate is recorded as observed once, without editing the original photo or
queueing a magnitude-change reply. Same-ID older timestamps and a downgrade
from reviewed to automatic are rejected. Newer real revisions remain valid.

Root/alias delivery IDs, baseline handling, timeout reservations and 30-second
reply coalescing remain intact. Old queued notices that would switch a current
preferred solution back to a secondary estimate are discarded at flush time.
No production Telegram calls are made by the tests. There is no increase in
polling or additional Durable Object alarms. The health response publishes
`telegramSolutionPolicy: reviewed-seismic-priority-v1`, checked during deployment.

Regression coverage: `tests/unit/telegram-solution-priority-check.mjs`, included
in `npm run worker:test`, simulates PT-first and US solutions in one catalogue,
PT changes, missing USGS catalogue data, object restart, a genuine downward US
revision, an older US snapshot and a queued stale PT reply, using mocked fetch,
Telegram, clock and storage only.

## Reappearing record without a revision badge

A separate frontend bus route reopened desktop records on every `official-map`
notification. Painting/viewing an official map could therefore show an 11-hour-old
M6.3 / 16 km quake as a transient record with neither NOVO nor ATUALIZADO, even
though the seismic solution had not changed. The map and quake revision paths
must not be conflated.

`DesktopRecords` no longer treats map presentation as a quake arrival. Existing
map-specific informational notices and map rendering stay available. Record
notices still open for new arrivals and qualifying actual revisions. A bounded
per-event seismic snapshot prevents repeated revision notifications with the
same magnitude, depth, coordinates, selected source/native ID and preliminary
state from reopening a notice or extending its deadline. Source-list/quality
metadata alone does not renew a snapshot already presented.

`tests/quake-record-notice-regression.spec.js` reproduced the old failure before
the change: an `official-map` event opened the hidden record panel immediately.
It now checks USGS/EU/same/new map versions leave it hidden, an actual magnitude
revision opens it, repeat notifications do not renew the one-minute deadline,
and a subsequent real depth correction can open a new notice.
