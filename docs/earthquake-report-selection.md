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
