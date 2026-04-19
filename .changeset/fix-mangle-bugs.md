---
"@rollup-extras/plugin-mangle": patch
---

Fixed shorthand property guard to correctly allow mangling of prefixed variables used as property values. Added `buildStart` hook to reset mangling state between builds (watch mode). Added `TemplateLiteral` handler to mangle prefixed names inside template literals without interpolation.
