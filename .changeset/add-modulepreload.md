---
"@rollup-extras/plugin-html": minor
---

Added automatic `<link rel="modulepreload">` generation for ES module entry chunks' static dependencies, eliminating the browser's sequential module discovery waterfall. Controlled by the new `modulepreload` option (default: `true`).
