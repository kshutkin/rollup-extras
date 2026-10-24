---
"@rollup-extras/plugin-prebundle": patch
---

Preserve importer-specific dependency resolution when prebundling. Keep different package copies separate, retain parent-resolved file paths, resolve remaining packages from their original importers, and invalidate cached prebundles when parent-resolved targets change. Report unresolved dependencies and child-build failures instead of emitting broken imports.
