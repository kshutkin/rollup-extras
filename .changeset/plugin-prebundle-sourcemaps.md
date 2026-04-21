---
"@rollup-extras/plugin-prebundle": minor
---

Add sourcemap support. The prebundled chunk is now built with `sourcemap: 'hidden'` and the resulting sourcemap is passed through to `emitFile` as the `map` property of the `prebuilt-chunk`. The `renderChunk` path-rewriting step preserves existing sourcemaps by returning `{ code, map: null }`.
