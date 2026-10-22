---
"@rollup-extras/plugin-script-loader": patch
---

Separate concatenated scripts with a semicolon on its own line so scripts without trailing semicolons retain their behavior, including when followed by an IIFE or array expression.
