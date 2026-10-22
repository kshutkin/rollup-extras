---
"@rollup-extras/plugin-prebundle": patch
---

Register resolved dependencies and the child build's full watch list with Rollup, including transitive and dynamically imported files. Preserve these watches when reusing a prebundle and invalidate it when a dependency changes.
