# Plugin Prebundle

Rollup plugin to prebundle external npm dependencies into a single cached chunk for faster dev/serve builds.

Points:

- Intercepts bare specifier imports that resolve into `node_modules` or outside the project root
- Bundles all discovered externals into one hashed chunk via a child Rollup build
- Uses `@rollup/plugin-node-resolve`, `@rollup/plugin-json`, and `@rollup/plugin-commonjs` internally — no extra config needed
- Emits the prebundled chunk via Rollup's `prebuilt-chunk` API (Rollup ≥ 3.23.0)
- Includes sourcemap support (`sourcemap: 'hidden'` in the child build)
- Caches the result across rebuilds — only rebuilds when the set of prebundled specifiers changes
- Disabled in build mode by default (enabled in watch mode only)

Uses [`@niceties/logger`](https://github.com/kshutkin/niceties/blob/main/logger/README.md) to log messages, can be configured through `@niceties/logger` API.

[Changelog](./CHANGELOG.md)

## Installation

```
npm install --save-dev @rollup-extras/plugin-prebundle
```

## Usage

```javascript
import prebundle from "@rollup-extras/plugin-prebundle";

export default {
    input: "src/index.js",

    output: {
        format: "es",
        dir: "dest",
    },

    plugins: [prebundle()],
};
```

By default the plugin activates only in watch mode. To also enable it in regular builds:

```javascript
prebundle({ enableInBuildMode: true });
```

To prebundle only specific packages (all other bare specifiers pass through untouched):

```javascript
prebundle({ packages: ["react", "react-dom"] });
```

## Options

### pluginName

Optional, `string`.

For debugging purposes, so many instances of a plugin can be differentiated in debugging output. Default is `@rollup-extras/plugin-prebundle`.

### packages

Optional, `string[]`.

List of package names to prebundle. When provided, only packages whose name (the first path segment, e.g. `react` for `react/jsx-runtime`) appears in this list are prebundled. When omitted, every import that resolves into `node_modules` or outside the project root is a candidate.

### enableInBuildMode

Optional, `boolean`, default: `false`.

By default the plugin is a no-op during a regular (non-watch) Rollup build so production output is unaffected. Set to `true` to also prebundle during build.

## Configuration

```typescript
type PrebundlePluginOptions = {
    pluginName?: string;       // default: '@rollup-extras/plugin-prebundle'
    packages?: string[];       // default: undefined (all external npm packages)
    enableInBuildMode?: boolean; // default: false
};
```

## Requirements

Requires Rollup ≥ 3.23.0 (uses the `prebuilt-chunk` emit type).

# License

[MIT](https://github.com/kshutkin/rollup-extras/blob/main/LICENSE)
