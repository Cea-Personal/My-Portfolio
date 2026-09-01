# Performance validation

The production webpack build completes successfully. Release CI runs the k6 smoke budget in
`tests/performance/release.js`; public pages use server-rendered sections and explicit cache tags.
