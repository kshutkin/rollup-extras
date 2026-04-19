---
"@rollup-extras/plugin-size": patch
---

Added `buildStart` hook to clear accumulated stats at the start of each new build cycle, preventing stale data from carrying over in watch mode.
