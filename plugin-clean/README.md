# Plugin Clean

Rollup plugin to clean a directory during build.

Points:

- Uses fs.rm to remove directories that shipped with nodejs and has built-in retries
- Can be used with no configuration
- Runs once per directory by default (good for watch mode)
- Minimal amount of logs by default

No globs support, please use [rollup-plugin-delete](https://github.com/vladshcherbin/rollup-plugin-delete) for globs.

Plugin runs on `renderStart` per each output and uses output.dir as a default target.

Uses [`@niceties/logger`](https://github.com/kshutkin/niceties/blob/main/logger/README.md) to log messages, can be configured through `@niceties/logger` API.

## Configuration

```typescript
export type CleanPluginOptions = {
    targets?: string | string[], // defaulted to output.dir per output
    pluginName?: string, // for debugging purposes, default is `@rollup-extras/plugin-clean`
    runOnce?: boolean, // default true
    verbose?: boolean // default false
};
```

## Prior Art

- https://github.com/vladshcherbin/rollup-plugin-delete
- https://github.com/saf33r/rollup-plugin-cleaner
- https://github.com/DongShelton/rollup-plugin-clear
