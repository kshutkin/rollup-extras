---
"@rollup-extras/plugin-serve": minor
---

Add a `/watch` helper that generates every configured output in memory without writing Rollup output to disk. It handles rebuilds, output errors, and build cleanup. Close the dev server when its watcher closes, and correct the disk-free serving example.
