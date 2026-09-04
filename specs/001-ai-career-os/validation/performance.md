# Performance validation

The production webpack build completes successfully. Release CI runs the k6 smoke budget in
`tests/performance/release.js`; public pages use server-rendered sections and explicit cache tags.

The release profile now fails when `BASE_URL` is missing and enforces <1% HTTP failure, p95 response
under 2.5 seconds, and >99% successful checks across the portfolio, public projection, and bounded chat
requests. k6 was not installed in this environment, so no measured performance pass is claimed yet.
