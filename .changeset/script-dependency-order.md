---
"@rollup-extras/plugin-script-loader": patch
---

Order asset-mode scripts by the completed dependency graph instead of module parsing order, so nested library imports execute before dependent scripts. Preserve declared entry order, handle shared and cyclic imports once, and retain fallback load order for force-loaded scripts.
