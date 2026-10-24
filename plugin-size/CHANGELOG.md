# @rollup-extras/plugin-size

## 0.3.2

### Patch Changes

- eddbaef: Recover completion bookkeeping after failed renders without resetting active sibling outputs. Discard partial HTML, size, and in-memory serve data and release clean's deletion bookkeeping so subsequent builds can complete normally.
- Updated dependencies [eddbaef]
  - @rollup-extras/utils@2.0.2

## 0.3.1

### Patch Changes

- 7b992f2: Reset output-plugin size statistics between builds while preserving accumulation across formats and linked configurations within the same build. Removed chunks and asset categories no longer carry over from earlier builds.

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
