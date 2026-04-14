# @rollup-extras/plugin-size

Rollup plugin that reports the size of generated artifacts — raw, minified (via [oxc-minify](https://www.npmjs.com/package/oxc-minify)), and compressed (gzip and/or brotli).

Output is summarised by category:

| Category             | Grouping                              | Sizes shown                    |
| -------------------- | ------------------------------------- | ------------------------------ |
| **Entry chunks**     | output format (`es`, `cjs`, `umd`, …) | raw → minified → gzip / brotli |
| **Non-entry chunks** | output format                         | raw → minified → gzip / brotli |
| **Assets**           | file extension (`.css`, `.svg`, …)    | raw → gzip / brotli            |

A JSON stats file is maintained between builds so that size deltas are printed on subsequent runs. Only categories that appear in either the current or the previous build are shown — nothing irrelevant is printed.

## Installation

Using npm:

```
npm install --save-dev @rollup-extras/plugin-size
```

Using pnpm:

```
pnpm add -D @rollup-extras/plugin-size
```

## Usage

### Minimal

```js
import size from "@rollup-extras/plugin-size";

export default {
  input: "src/index.js",
  output: {
    dir: "dist",
    format: "es",
  },
  plugins: [size()],
};
```

### Custom stats file path

```js
size({ statsFile: "build/.size-stats.json" });
```

### Disable stats file update (report-only)

```js
size({ updateStats: false });
```

### Enable brotli reporting

```js
size({ brotli: true });
```

### Brotli only (no gzip)

```js
size({ gzip: false, brotli: true });
```

### Full options

```js
size({
  statsFile: ".stats.json",
  updateStats: true,
  gzip: true,
  brotli: true,
  pluginName: "my-size",
});
```

## Options

| Option        | Type      | Default                        | Description                                                         |
| ------------- | --------- | ------------------------------ | ------------------------------------------------------------------- |
| `statsFile`   | `string`  | `'.stats.json'`                | Path to the JSON stats file (relative to project root or absolute). |
| `updateStats` | `boolean` | `true`                         | Whether to overwrite the stats file with the current build data.    |
| `gzip`        | `boolean` | `true`                         | Report gzip-compressed sizes.                                       |
| `brotli`      | `boolean` | `false`                        | Report brotli-compressed sizes.                                     |
| `pluginName`  | `string`  | `'@rollup-extras/plugin-size'` | Override the plugin name reported to Rollup.                        |

## How it works

The plugin hooks into Rollup's `generateBundle` and `closeBundle` lifecycle:

1. **`generateBundle`** — iterates over every chunk and asset in the output bundle.
   - **Chunks** (entry and non-entry) are minified with `oxc-minify` and then compressed with the enabled algorithms (gzip and/or brotli). Sizes are accumulated per output format.
   - **Assets** are compressed with the enabled algorithms (no JS minification). Sizes are accumulated per file extension.
2. **`closeBundle`** (via `multiConfigPluginBase`) — loads the previous stats file (if any), prints a comparison report using [`@niceties/ansi`](https://www.npmjs.com/package/@niceties/ansi) colours, and writes the updated stats file.

Size deltas are colour-coded: **green** for decreases, **red** for increases, and dim for no change. Categories that existed in the previous build but are absent in the current one are reported as _removed_.

## License

[MIT](https://github.com/kshutkin/rollup-extras/blob/main/LICENSE)
