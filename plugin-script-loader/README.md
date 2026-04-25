![Coverage](https://raw.githubusercontent.com/kshutkin/rollup-extras/refs/heads/coverage/plugin-script-loader/badge.svg)

# Plugin Script Loader

Rollup plugin to mimic Webpack's `script-loader` inline behavior. Inlines raw scripts into the bundle in import order, or emits them as a separate asset file for non-module, non-strict mode execution.

[Changelog](./CHANGELOG.md)

## Installation

Using npm:

```
npm install --save-dev @rollup-extras/plugin-script-loader
```

## The Problem

In legacy codebases using libraries like d3 or AngularJS, you need to:

- Load scripts in a **stable, deterministic order** (e.g., d3 before d3 plugins, AngularJS before Angular modules)
- **Concatenate** everything into a single bundle
- Pass all code through the **optimization layer** (terser) — not hidden inside `eval()` strings
- Support **legacy libraries** that aren't proper ES modules
- Optionally, run legacy code in **sloppy mode** (non-strict) outside the main ES module bundle

In Webpack, this is solved with `script-loader`:

```javascript
import "script-loader!d3";
import "script-loader!d3-plugin1";
import "script-loader!angular";
import "script-loader!angular-route";
```

This plugin brings the same pattern to Rollup.

## How It Works

The plugin intercepts imports that start with a configurable prefix (`script!` by default), resolves the underlying module, and processes it based on the `emit` option:

- **`emit: 'inline'`** (default) — Inlines the raw source code directly into the bundle at the import site
- **`emit: 'asset'`** — Collects all scripts and emits them as a separate concatenated asset file

Because the code is handled as real JavaScript (not wrapped in `eval()` or `new Function()`), it:

- Preserves **import order** — scripts appear exactly as imported
- Is fully visible to **terser** and other optimization plugins
- Gets **concatenated** into a single output
- Is **CSP-safe** — no dynamic code evaluation

## Example: Inline Mode (Default)

```javascript
import scriptLoader from "@rollup-extras/plugin-script-loader";

export default {
  input: "src/index.js",

  output: {
    format: "iife",
    file: "dist/bundle.js",
  },

  plugins: [scriptLoader()],
};
```

In your entry point:

```javascript
// Legacy libraries — inlined in this exact order
import "script!d3";
import "script!d3-tip";
import "script!angular";
import "script!angular-route";
import "script!angular-sanitize";

// Your application code (regular ES module imports)
import { app } from "./app.js";

app.init();
```

## Example: Asset Mode (Emit Separate File)

For legacy code that must run in true sloppy (non-strict) mode, use `emit: 'asset'` to emit a separate classic script file:

```javascript
import scriptLoader from "@rollup-extras/plugin-script-loader";

export default {
  input: "src/index.js",

  output: {
    format: "es",
    dir: "dist",
    sourcemap: true,
  },

  plugins: [
    scriptLoader({
      emit: "asset",
      name: "vendor.js",
      sourcemap: true,
    }),
  ],
};
```

This emits `vendor.js` as a separate asset file containing all concatenated scripts. Include it in your HTML before the main bundle:

```html
<script src="vendor.js"></script>
<script src="main.js" type="module"></script>
```

### With Content Hashing

To let Rollup apply its `assetFileNames` pattern for content hashing:

```javascript
scriptLoader({
  emit: "asset",
  name: "vendor.js",
  exactFileName: false, // Use Rollup's assetFileNames pattern
});
```

With `output.assetFileNames: 'assets/[name].[hash].[ext]'`, this outputs `assets/vendor.abc123.js`.

### With Minification

Provide a custom `minify` function to minify the concatenated output:

```javascript
import { minify } from "terser";

scriptLoader({
  emit: "asset",
  name: "vendor.js",
  minify: async (code, map) => {
    const result = await minify(code, {
      sourceMap: map ? { content: map } : false,
    });
    return { code: result.code, map: result.map };
  },
});
```

Or with oxc-minify:

```javascript
import { minify } from "oxc-minify";

scriptLoader({
  emit: "asset",
  minify: async (code) => {
    const result = await minify("vendor.js", code);
    return { code: result.code, map: result.map };
  },
});
```

### Integration with plugin-html

Use with `@rollup-extras/plugin-html` to automatically inject the vendor bundle:

```javascript
import scriptLoader from "@rollup-extras/plugin-script-loader";
import html from "@rollup-extras/plugin-html";
import {
  simpleES5Script,
  combineAssetFactories,
} from "@rollup-extras/plugin-html/asset-factories";

export default {
  input: "src/main.js",
  output: {
    format: "es",
    dir: "dist",
    sourcemap: true,
    assetFileNames: "assets/[name].[hash].[ext]",
  },
  plugins: [
    scriptLoader({
      emit: "asset",
      name: "vendor.js",
      exactFileName: false,
      sourcemap: true,
    }),

    html({
      template: "index.html",
      assetsFactory: combineAssetFactories(
        simpleES5Script(/vendor\..*\.js$/) // Inject vendor as classic script
      ),
    }),
  ],
};
```

## Configuration

```typescript
type ScriptLoaderPluginOptions = {
  // Existing options
  prefix?: string; // 'script!' by default
  useStrict?: boolean; // true by default (for inline mode)
  pluginName?: string; // '@rollup-extras/plugin-script-loader' by default
  verbose?: boolean; // false by default

  // Emit mode options
  emit?: "inline" | "asset"; // 'inline' by default
  name?: string; // 'vendor.js' by default
  exactFileName?: boolean; // true by default
  sourcemap?: boolean; // true by default when emit: 'asset'
  minify?: (
    code: string,
    sourcemap?: SourceMap
  ) => Promise<{ code: string; map?: SourceMap }>;
};
```

### `emit`

- **`'inline'`** (default) — Scripts are inlined into the main bundle (current behavior)
- **`'asset'`** — Scripts are concatenated and emitted as a separate asset file

### `name`

Base name for the emitted asset file. Only used when `emit: 'asset'`.

Default: `'vendor.js'`

### `exactFileName`

Controls how the asset filename is determined. Only used when `emit: 'asset'`.

- **`true`** (default) — Uses Rollup's `fileName` property; asset emitted with exact name (e.g., `vendor.js`)
- **`false`** — Uses Rollup's `name` property; Rollup applies `output.assetFileNames` pattern (e.g., `assets/vendor.abc123.js`)

### `sourcemap`

Whether to generate sourcemaps for the emitted asset. Only used when `emit: 'asset'`.

Default: `true` when `emit: 'asset'`

When enabled, generates a concatenated sourcemap (`vendor.js.map`) pointing back to original source files.

### `minify`

Optional async function to minify the concatenated code. Only used when `emit: 'asset'`.

Receives the code and optionally the sourcemap, returns minified code and optionally a new sourcemap.

### `useStrict`

Controls whether the inlined script is parsed in strict mode or sloppy (non-strict) mode. Only applies to `emit: 'inline'` mode.

- **`true`** (default) — appends `export {}` to the loaded code, which makes Rollup's parser treat the file as an ES module (strict mode)
- **`false`** — does not append `export {}`, so the parser uses script (sloppy) mode

```javascript
// Sloppy mode for legacy libraries that break under strict parsing
scriptLoader({ useStrict: false });
```

> **Note:** `useStrict` only controls _parse-time_ mode. For the output to actually run in non-strict mode at runtime, you also need `output.strict: false` in your Rollup config (applies to `iife`, `cjs`, and `umd` formats). The `es` format is always strict per spec. For true sloppy mode at runtime, use `emit: 'asset'` instead.

### `prefix`

The import prefix that triggers script loading.

Default: `'script!'`

For Webpack migration compatibility:

```javascript
scriptLoader({ prefix: "script-loader!" });
```

### `verbose`

Enables detailed logging of processed scripts.

Default: `false`

## Notes

### Global Scope

With `format: 'iife'`, all inlined code shares the same function scope. Libraries that explicitly assign to `window` (e.g., `window.d3 = ...`, `window.angular = ...`) work correctly.

With `emit: 'asset'`, the emitted file runs as a classic script in true global scope — ideal for legacy libraries.

### Works With node-resolve

The plugin delegates module resolution to other plugins via Rollup's `this.resolve()`. This means `script!d3` will be resolved by `@rollup/plugin-node-resolve` (if present) just like a regular import — picking up the file from `node_modules`.

### Works With terser

Since the code is handled as real JavaScript, `@rollup/plugin-terser` can process inline mode output. For asset mode, use the `minify` option to apply minification to the concatenated output.

### Watch Mode

The plugin properly clears its state between builds, fully supporting Rollup's watch mode.

## Prior Art

- [script-loader](https://github.com/webpack-contrib/script-loader) (Webpack, deprecated)

# License

[MIT](https://github.com/kshutkin/rollup-extras/blob/main/LICENSE)
