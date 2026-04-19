---
"@rollup-extras/plugin-script-loader": patch
---

Fixed external sourcemap path resolution to use the path referenced in the source file instead of appending `.map` to the file path. Added sourcemap composition via `@ampproject/remapping` so original source maps are properly composed with the bundle map.
