# Accessibility and compatibility

The public accessibility spec runs axe-core against the semantic page and the UI includes keyboard,
focus, reduced-motion, and mobile layout affordances. Chromium, Firefox, and WebKit matrices run via
the Playwright project configuration when browsers are installed.

## Measured run — 2026-09-04

Chromium passed the public axe scan and six release scenarios covering mobile (390px), narrow desktop
(1024px), large desktop (1440px), light/dark themes, 200% zoom, keyboard focus, reduced motion, and
Ask Basil mode switching. The cached Firefox binary exits before launch on this macOS host because its
`libmozglue.dylib` runtime is unavailable, and WebKit is not installed; the cross-engine gate remains
open for CI.
