# @rollup-extras/plugin-mangle

## 0.1.1

### Patch Changes

- 3fc06c6: Fixed shorthand property guard to correctly allow mangling of prefixed variables used as property values. Added `buildStart` hook to reset mangling state between builds (watch mode). Added `TemplateLiteral` handler to mangle prefixed names inside template literals without interpolation.

## 0.1.0

### Minor Changes

- 8bb6ce7: initial release
