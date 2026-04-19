---
"@rollup-extras/plugin-clean": patch
---

Removed dead `if (targets)` guard in `buildStart()` — `targets` is always initialized by `optionsHook` before `buildStart` runs.
