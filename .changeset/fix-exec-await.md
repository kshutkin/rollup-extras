---
"@rollup-extras/plugin-exec": patch
---

Added `await` to exec callback invocation so async callbacks complete before the build finishes and errors are properly propagated.
