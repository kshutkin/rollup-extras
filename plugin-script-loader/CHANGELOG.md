# @rollup-extras/plugin-script-loader

## 0.1.3

### Patch Changes

- ef9ca93: Order asset-mode scripts by the completed dependency graph instead of module parsing order, so nested library imports execute before dependent scripts. Preserve declared entry order, handle shared and cyclic imports once, and retain fallback load order for force-loaded scripts.
- Updated dependencies [eddbaef]
  - @rollup-extras/utils@2.0.2

## 0.1.2

### Patch Changes

- c2d1451: Separate concatenated scripts with a semicolon on its own line so scripts without trailing semicolons retain their behavior, including when followed by an IIFE or array expression.

## 0.1.1

### Patch Changes

- 3fc06c6: Fixed external sourcemap path resolution to use the path referenced in the source file instead of appending `.map` to the file path. Added sourcemap composition via `@ampproject/remapping` so original source maps are properly composed with the bundle map. Made sourcemap source paths relative instead of absolute. Removed dead code guard in bundle mutation path.

## 0.1.0

### Minor Changes

- ce67412: initial release
