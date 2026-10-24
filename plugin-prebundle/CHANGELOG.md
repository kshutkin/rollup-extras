# @rollup-extras/plugin-prebundle

## 0.1.3

### Patch Changes

- 164dfa5: Preserve importer-specific dependency resolution when prebundling. Keep different package copies separate, retain parent-resolved file paths, resolve remaining packages from their original importers, and invalidate cached prebundles when parent-resolved targets change. Report unresolved dependencies and child-build failures instead of emitting broken imports.
- Updated dependencies [eddbaef]
  - @rollup-extras/utils@2.0.2

## 0.1.2

### Patch Changes

- f857fe0: Escape punctuation in prebundle namespace identifiers without collisions so distinct package names and subpaths retain their own exports.
- e21f599: Keep prebundle caches private to each plugin instance so projects importing the same package names do not reuse another project's dependency code. Cached rebuilds within an instance continue to reuse their prebundled chunks.
- e998fa2: Register resolved dependencies and the child build's full watch list with Rollup, including transitive and dynamically imported files. Preserve these watches when reusing a prebundle and invalidate it when a dependency changes.

## 0.1.1

### Patch Changes

- 5444f54: Restore discovered dependencies from cached proxy modules so rebuilds re-emit their prebundled chunk.
- 1524d5d: Preserve package default exports and live bindings through prebundle proxies while keeping named and namespace imports intact.
- 1b270f9: Emit and cache every child chunk so prebundled dependencies with dynamic imports load correctly and retain lazy execution.
- 9b9410e: Replace deprecated pkg-dir with package-directory.

## 0.1.0

### Minor Changes

- faf004b: Initial release
