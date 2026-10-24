---
"@rollup-extras/utils": patch
"@rollup-extras/plugin-html": patch
"@rollup-extras/plugin-size": patch
"@rollup-extras/plugin-clean": patch
"@rollup-extras/plugin-serve": patch
---

Recover completion bookkeeping after failed renders without resetting active sibling outputs. Discard partial HTML, size, and in-memory serve data and release clean's deletion bookkeeping so subsequent builds can complete normally.
