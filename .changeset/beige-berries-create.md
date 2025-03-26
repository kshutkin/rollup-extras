---
"@rollup-extras/plugin-copy": minor
---

Pass result of path.resolve() in originalFileName property into emitFile. It should not affect older rollup versions but potentially fixes #182.
