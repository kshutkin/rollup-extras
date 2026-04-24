# @rollup-extras/plugin-size

## 0.3.0

### Minor Changes

- a9dc199: add `outputPlugin` option to allow using the plugin inside `output.plugins` (skips the input-only `buildStart` hook)

## 0.2.1

### Patch Changes

- 3fc06c6: Added `buildStart` hook to clear accumulated stats at the start of each new build cycle, preventing stale data from carrying over in watch mode.

## 0.2.0

### Minor Changes

- ee21fd0: make minification optional

## 0.1.0

### Minor Changes

- 7f1df1d: initial release
