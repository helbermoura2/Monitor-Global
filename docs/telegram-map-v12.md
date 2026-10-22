# Telegram map v12

Alert photos prefer the Esri topographic map to satellite imagery. The computed land-only intensity fill uses 28% color instead of 64%, with boundaries between calculated bands. Existing USGS ShakeMap data remains preferred over the approximate radial model when available; the legend distinguishes the two. No contours are presented as confirmed damage.

The alert adds a regional topographic inset with the event's coordinates, a latitude-adjusted kilometer scale, a prominent epicenter label and up to four non-overlapping locality labels from the USGS GeoNames response. Missing geographic data produces no invented locality. Optional place lookup is bounded to eight entries per response, a 3.5-second timeout and a 24-entry one-hour cache. Map context uses the existing bounded map-image loader and no extra Durable Object/KV requests.

Card version `cartographic-v12-context` enables the normal existing-image refresh for sent photos younger than 24 hours. It edits the original Telegram message; it does not intentionally resend the alert. Existing message IDs, captions, delivery deduplication and seismic source selection are preserved. Other recently sent eligible photos can also receive the new layout through this normal version migration.

Validation: local rendering of the China event, inspected at 1080 × 1920; unit tests for geographic references and annotations; Worker service/delivery and image snapshot checks. Production Telegram update is authorized for the existing China alert; no test messages are sent.
