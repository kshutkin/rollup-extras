# Plugin Script Loader

Rollup plugin to mimic Webpack's `script-loader` inline behavior. Inlines raw scripts into the bundle in import order, enabling legacy library loading with stable ordering, terser optimization and concatenation.

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

In Webpack, this is solved with `script-loader`:

```javascript
import "script-loader!d3";
import "script-loader!d3-plugin1";
import "script-loader!angular";
import "script-loader!angular-route";
```

This plugin brings the same pattern to Rollup.

## How It Works

The plugin intercepts imports that start with a configurable prefix (`script!` by default), resolves the underlying module, reads its raw source code, and inlines it directly into the bundle at the import site.

Because the code is inlined as real JavaScript (not wrapped in `eval()` or `new Function()`), it:

- Preserves **import order** — scripts appear in the bundle exactly as imported
- Is fully visible to **terser** and other optimization plugins
- Gets **concatenated** into a single output file
- Is **CSP-safe** — no dynamic code evaluation

## Example

Basic:

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

With custom prefix (for Webpack migration compatibility):

```javascript
import scriptLoader from "@rollup-extras/plugin-script-loader";

export default {
  input: "src/index.js",

  output: {
    format: "iife",
    file: "dist/bundle.js",
  },

  plugins: [scriptLoader({ prefix: "script-loader!" })],
};
```

This allows keeping the original Webpack-style imports unchanged:

```javascript
import "script-loader!d3";
import "script-loader!angular";
```

## Configuration

```typescript
type ScriptLoaderPluginOptions = {
  prefix?: string; // 'script!' by default, the import prefix that triggers script inlining
  useStrict?: boolean; // true by default, controls strict vs sloppy mode parsing
  pluginName?: string; // '@rollup-extras/plugin-script-loader' by default
  verbose?: boolean; // false by default, enables detailed logging of inlined scripts
};
```

### `useStrict`

Controls whether the inlined script is parsed in strict mode or sloppy (non-strict) mode.

- **`true`** (default) — appends `export {}` to the loaded code, which makes Rollup's parser treat the file as an ES module (strict mode). This is fine for well-behaved libraries.
- **`false`** — does not append `export {}`, so the parser uses script (sloppy) mode. Required for legacy code that uses `with`, `arguments.callee`, octal literals, or assigns to undeclared variables — all of which are syntax errors in strict mode.

```javascript
// Sloppy mode for legacy libraries that break under strict parsing
scriptLoader({ useStrict: false });
```

> **Note:** `useStrict` only controls _parse-time_ mode. For the output to actually run in non-strict mode at runtime, you also need `output.strict: false` in your Rollup config (applies to `iife`, `cjs`, and `umd` formats). The `es` format is always strict per spec.

## Notes

### Global Scope

With `format: 'iife'`, all inlined code shares the same function scope. Libraries that explicitly assign to `window` (e.g., `window.d3 = ...`, `window.angular = ...`) work correctly. If a legacy library relies on bare `var` declarations becoming globals, you may need to either:

- Patch the library to use explicit `window.*` assignments
- Use `format: 'es'` with a non-module `<script>` tag

### Works With node-resolve

The plugin delegates module resolution to other plugins via Rollup's `this.resolve()`. This means `script!d3` will be resolved by `@rollup/plugin-node-resolve` (if present) just like a regular import — picking up the file from `node_modules`.

### Works With terser

Since the raw code is inlined as real JavaScript, `@rollup/plugin-terser` can minify it just like any other code in the bundle.

## Prior Art

- [script-loader](https://github.com/webpack-contrib/script-loader) (Webpack, deprecated)

# License

[MIT](https://github.com/kshutkin/rollup-extras/blob/main/LICENSE)
