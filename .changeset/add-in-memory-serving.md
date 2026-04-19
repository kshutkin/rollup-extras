---
"@rollup-extras/plugin-serve": minor
---

Added `inMemory` option to serve all emitted Rollup assets from memory without writing to disk, similar to webpack-dev-server. Uses Hono's built-in MIME type utility for content type detection.
