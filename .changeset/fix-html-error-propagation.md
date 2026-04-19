---
"@rollup-extras/plugin-html": patch
---

Fixed error propagation when `templateFactory` throws — errors are now re-thrown after logging instead of being silently swallowed.
