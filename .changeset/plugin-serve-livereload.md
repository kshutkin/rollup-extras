---
'@rollup-extras/plugin-serve': minor
---

Add live reload (enabled by default in watch mode).

The plugin now exposes a Server-Sent Events endpoint at `/__livereload` and injects a tiny client script into every served `text/html` response. After each rebuild the server broadcasts a `reload` event that triggers `location.reload()` in the browser. Works uniformly for in-memory, disk, and custom `customize` HTML responses. Disable with `liveReload: false`.

The public `ServePluginOptionsObject` type also now includes the previously undocumented `inMemory?: boolean` option.
