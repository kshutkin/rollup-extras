---
"@rollup-extras/plugin-prebundle": patch
---

Keep prebundle caches private to each plugin instance so projects importing the same package names do not reuse another project's dependency code. Cached rebuilds within an instance continue to reuse their prebundled chunks.
