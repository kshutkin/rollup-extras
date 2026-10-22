# @rollup-extras/plugin-prebundle

## 0.1.1

### Patch Changes

- 5444f54: Restore discovered dependencies from cached proxy modules so rebuilds re-emit their prebundled chunk.
- 1524d5d: Preserve package default exports and live bindings through prebundle proxies while keeping named and namespace imports intact.
- 1b270f9: Emit and cache every child chunk so prebundled dependencies with dynamic imports load correctly and retain lazy execution.
- 9b9410e: Replace deprecated pkg-dir with package-directory.

## 0.1.0

### Minor Changes

- faf004b: Initial release
