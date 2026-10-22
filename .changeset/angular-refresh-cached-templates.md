---
"@rollup-extras/plugin-angularjs-template-cache": patch
---

Rescan templates when loading the generated cache module so cached rebuilds refresh template contents and matched files. This also supports fresh plugin instances reusing a Rollup cache when autoImport is disabled.
