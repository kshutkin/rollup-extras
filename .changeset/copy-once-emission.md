---
"@rollup-extras/plugin-copy": patch
---

Restore copyOnce for emitted assets so unchanged files are not rewritten on rebuilds. Use copyOnce: false when each generated bundle needs to include all assets.
