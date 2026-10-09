# Mobile energy budget

The previous sustained measurement found 141/147 new ArcGIS tile fetches during
one minute of simulated hidden visibility: rotation and camera motion continued
after feed polling paused. This change gates automatic presentation while hidden
and retains pending earthquake/weather/volcano arrivals for priority on resume.
Hidden tabs stop map flights, CSS animations and current card effects/video.
Wave camera callbacks suspend; physical elapsed time remains wall-clock based.

For widths up to 900px or coarse pointers, map pixel ratio is capped at 1.25.
At DPR 3 this reduces the map framebuffer pixel count by about 83%; this is a
pixel-count calculation, not a measured battery saving. Text remains at normal
CSS size. Mobile card/full-screen effect policies start balanced (0.8 resolution,
70% decorative particles) and draw at most 20 fps. Letter displacement and effect
durations are unchanged. Wave camera updates on mobile cap at 20 per second.
During mobile card scenes blurred map compositing behind the panel is disabled.

Periodic CEMADEN UI and local impact lookups now respect visibility. City result
and administrative caches retain at most 128 keys each; local impact retains 64.
Uncached nearby-city queries do not start while hidden. Existing server Telegram
alerts remain independent of the browser presentation lifecycle.

Tests cover high-DPR framebuffer size, mobile budgets, letter restoration and
16-second expiry, retained hidden arrivals, resume priority, cache eviction,
physical wave geometry and the M5+ camera sequence. Browser lifecycle visibility
is simulated. Actual battery power/temperature must be checked on a physical
phone; web APIs do not expose reliable device temperature.
