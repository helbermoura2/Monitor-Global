# Periodic work (performance step 6)

`js/periodic-scheduler.js` loads before its consumers. A keyed job registry uses
one pending timeout for the earliest eligible job, instead of one interval per
feed/widget. Main feeds retain their configured startup delays and intervals.
Supplementary METAR, NWS, ECCC, BOM, Meteoalarm, CGE bulletins, weather evidence,
climate/global dashboards and correlations now participate in the same pause.

Hidden tabs have no scheduler timeout. Already-started requests may finish; they
are not aborted. When visible, overdue feed starts are spaced 750 ms apart and
missed periods are discarded. The critical seismic feeds can be triggered
immediately on resume. Visibility/focus/pageshow triggers coalesce, and the same
scheduled request cannot overlap itself, even if it takes longer than its period
or rejects. `pausarBuscas()` still manually pauses all feeds; UI jobs remain
separate from that group. UI clocks update from current wall time on return.

Periodic UI status, expiry, offline snapshots, fire deduplication and selected
record age share the scheduler. KPI feed aggregation runs every 15 seconds as a
fallback, with existing source/boot update hooks preserved; the clock still ticks
once a second when visible. A duplicate freshness refresh was removed.

The seismic watchdog and list recovery watchdog stay independent. Physical wave
rendering, camera animation, random-event deadlines, effect expiry, optional
Election polling (30 seconds when its panel is open/visible), request timeouts,
and short one-shot initialization retries keep their existing mechanisms. This
change does not shorten new-earthquake presentations or change alert priorities.

Validation uses a deterministic clock for deduplication, hidden/manual pause,
staggered resume, slow/rejected requests and cancellation; browser checks cover
desktop/mobile lifecycle plus existing new-event priority and duration tests.
No whole-site CPU/battery percentage is claimed from these tests.
