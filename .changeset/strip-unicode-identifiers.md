---
"@rollup-extras/plugin-strip-comments": patch
---

Port package-prune's Unicode-escaped identifier scanning. Consume fixed-width and braced escapes as part of identifiers so their braces cannot corrupt division, regular-expression, label, or property context.
