---
"@rollup-extras/plugin-copy": patch
---

Restore following directory symlinks during glob expansion on newer Node versions. Add a followSymlinks option, enabled by default, to control traversal independently of preserveSymlinks, including on older supported Node versions.
