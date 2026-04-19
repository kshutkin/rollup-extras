# @rollup-extras/plugin-script-loader

## 0.1.1

### Patch Changes

- 3fc06c6: Fixed external sourcemap path resolution to use the path referenced in the source file instead of appending `.map` to the file path. Added sourcemap composition via `@ampproject/remapping` so original source maps are properly composed with the bundle map. Made sourcemap source paths relative instead of absolute. Removed dead code guard in bundle mutation path.

## 0.1.0

### Minor Changes

- ce67412: initial release
