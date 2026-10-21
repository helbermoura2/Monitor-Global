# Long-session stability, 21 October 2026

The Samsung Internet / DeX report covers 4.14 hours. It records 23 opaque JavaScript errors and 385 observed HTTP errors among 9,587 Worker-category resource entries. These are browser observations, not Durable Object operations. The report lacks routes and status codes, so historical failures cannot all be attributed to one cause. Its final JavaScript heap is 326.16 MiB; a rising sampled heap alone does not establish a leak.

Changes:

- Open-Meteo cache stores reusable text rather than an already consumed Response. It expires after eight minutes, holds at most 24 entries and 4 MiB of estimated UTF-16 text, and tracks at most eight concurrent shared jobs. These limits describe retained weather text, not total process memory. An isolated reproduction with 100 weather URLs retained 101 entries before and 24 after; reading the same URL twice required two network calls before and one after.
- Retired EMSC JSONP callbacks become shared no-ops for up to 60 seconds, bounded to 64 tombstones. Late responses no longer immediately encounter a deleted callback. This is a possible source of opaque cross-origin errors, not proof of the cause of all 23 historical errors.
- Public requests honor server source cooldown and HTTP 429 Retry-After, keyed by request identity and bounded to 64 entries. Other sources continue independently. No successful-response cache is introduced here.
- City lookup fallback skips Worker requests for Photon and two Overpass mirrors absent from its host allowlist. Direct access remains available, as does the authorized Overpass proxy fallback. Those rejected proxy paths were deterministically capable of producing 403 responses; their historical share is unknown.
- Opt-in diagnostic version 4 records native Worker attempts by fixed route/provider names and HTTP status, plus bounded cache counters and opaque-error classification. It retains no query strings, coordinates, raw messages or complete stacks and sends no telemetry. Shared consumers and locally suppressed retries are not counted as extra native requests.

Validation uses mocked/local sources only. No production Worker, Durable Object or Telegram functional tests are needed. A fresh long session after loading the updated scripts is necessary to assess phone heap growth and the remaining failures. No measured post-deployment phone-memory reduction is claimed.
