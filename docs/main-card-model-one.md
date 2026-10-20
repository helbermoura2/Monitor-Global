# Shared main event card

All hazard cards use model 1: centered title, live magnitude/severity gauge, location, occurrence time and measurements, with Image/Details actions in the header and source evidence in the footer. Capital weather retains its own temperature and weather fields within the centered shared styling; hazard-only actions remain hidden there.

Earthquakes retain depth and source/estimated intensity on the front. Energy, estimated impact, timeline, distance and per-network magnitudes remain in Details. Other hazards retain all three measurements (including wind, pressure or volcanic levels) and their activity descriptions, warnings and bulletins. The layout supplies no measurements or tsunami conclusions.

`MainCardLayout` moves original live DOM nodes, retaining IDs and handlers. Its `prepare` hook restores nodes before switching presentation families, so a new regional notice is not accidentally attached to the previous quake's technical section. Repeated updates and the existing flip/details behavior continue to use the same nodes. The compact mobile summary keeps top actions and location visible.

Country flags use local flag-icons SVGs, avoiding platform-dependent emoji rendering. Hazard nationality comes only from confident coordinate/boundary lookup; ocean events and uncertain borders get no invented nation. For Brazil, an available state flag is secondary to the national flag. Capital country codes come from the capital dataset. SVGs load only when displayed; no flag service, Worker/DO request, polling or timer is added.

Offline browser coverage includes all hazard types, a quake-to-regional-warning transition, country flag image loading, ocean abstention, desktop/mobile detail opening/closing, repeated updates, layout restoration and Brazilian/international capital cards.
