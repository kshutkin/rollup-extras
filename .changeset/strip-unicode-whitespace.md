---
"@rollup-extras/plugin-strip-comments": patch
---

Port package-prune's complete JavaScript whitespace classification. Recognize Unicode spaces as token separators instead of identifier characters so regular expressions after control conditions are preserved.
