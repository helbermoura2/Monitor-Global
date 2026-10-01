# Hazard provenance and details

The card labels the product: local observation, official warning, institutional report, model estimate, or river-stage observation. Institutional origin is not proof that a forecast has occurred. Earthquake priority remains unchanged.

- NOAA Aviation Weather Center METAR: 55 sampled airports worldwide, five-minute refresh; the actual observation must be at most 90 minutes old. Gusts at least 70 km/h and observed thunderstorm groups become records. TEMPO/BECMG/RMK groups do not count as current observations. This is aerodrome coverage, not global city coverage.
- NWS: actual, unexpired severe thunderstorm, high wind, flash/river flood warnings in the US. A real polygon is required to put a representative marker on the map. Warnings without geometry are skipped rather than assigned invented coordinates.
- Meteoalarm: six validated country feeds (Germany, France, Spain, Portugal, Italy, UK), every ten minutes. Regional notices without coordinates appear in Meteorologia > Ver fontes e detalhes. The list links back to Meteoalarm, credits national services and identifies forecast/expiry times. This does not cover every country.
- GDACS: existing regional flood reports keep the original start date where supplied.
- GloFAS/Copernicus through the public Open-Meteo Flood API: seven-day river-discharge context on the reverse of a flood record. m³/s, daily forecast, returned river grid coordinates; it is not street flooding or a flood probability. No local flood-stage threshold is inferred.
- Open-Meteo/WeatherAPI: modeled/aggregated conditions are labeled model estimates. They no longer play sirens, show warning toasts, become live badges, or automatically select the main card.
- ANA: the legacy series requires an explicit unit and a fresh reading. A river rise is informational, not a confirmed flood. Unspecified units are rejected. Broader ANA/CEMADEN station coverage still requires documented public access or credentials; no tokens or fictitious observations were introduced. INMET and existing cyclone-center feeds remain in use.

“Detalhes ↻” uses the existing flip, with original live DOM nodes on the reverse and an explicit return button. Information is organized in collapsible groups. Changing the event restores nodes to the front before updating them. Glass styling is preserved. Automatic population flip still runs unless the person explicitly opens the persistent detail reverse.
