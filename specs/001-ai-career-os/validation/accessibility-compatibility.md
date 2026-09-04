# Accessibility and compatibility

The public accessibility spec runs axe-core against the semantic page and the UI includes keyboard,
focus, reduced-motion, and mobile layout affordances. Chromium, Firefox, and WebKit matrices run via
the Playwright project configuration when browsers are installed.

## Measured run — 2026-09-04

Chromium passed the public axe scan and semantic public journey. Playwright MCP also verified desktop
(1440px), narrow desktop (1024px), and mobile (390px) layouts with no horizontal overflow, the profile
image and landmarks present, light/dark theme contrast values applied, keyboard focus on the skip link,
and reduced-motion CSS rules present. A simulated 200% zoom check also found no horizontal overflow.
The cached Firefox binary exits before launch on this macOS host because its `libmozglue.dylib` runtime
is unavailable; WebKit is not installed. Screen-reader verification is still a manual release check,
so the full T318 cross-engine gate remains open for CI.
