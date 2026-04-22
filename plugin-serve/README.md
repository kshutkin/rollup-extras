# Plugin Serve

Rollup plugin for a dev server.

Points:

- Uses `hono`, customizable through Hono middleware
- Zero-config by default (works if you have `output.dir` defined)

Uses [`@niceties/logger`](https://github.com/kshutkin/niceties/blob/main/logger/README.md) to log messages, which can be configured through `@niceties/logger` API.

[Changelog](./CHANGELOG.md)

## Installation

Using npm:

```
npm install --save-dev @rollup-extras/plugin-serve
```

## Usage

```javascript
import serve from "@rollup-extras/plugin-serve";

export default {
  input: "src/index.js",

  output: {
    format: "es",
    dir: "dest",
  },

  plugins: [serve()],
};
```

## Providing options

Just pass options to the plugin function. The returned object is the plugin instance which can be passed to rollup.

```javascript
serve({ option: value, option2: value2 });
```

For additional plugin instances (in case of multiple configs) please use `firstInstance.api.addInstance()`

## Options

### pluginName

Optional, `string`.

For debugging purposes, so many instances of a plugin can be differentiated in debugging output.

### useWriteBundle

Optional, `boolean`, default: `true`.

Option to use `writeBundle` hook instead of `generateBundle`.

### inMemory

Optional, `boolean`, default: `false`.

When enabled, serves all emitted assets directly from memory instead of from disk. This is similar to how webpack-dev-server works — Rollup output never needs to hit the filesystem.

When `inMemory` is `true`, the plugin automatically uses the `generateBundle` hook (regardless of `useWriteBundle`) to capture all chunks and assets in memory. A custom Hono middleware serves these files before falling through to any disk-based static serving configured via `dirs`.

For a fully disk-free dev server, set `watch: { skipWrite: true }` in your Rollup config to prevent Rollup from writing files to disk. The plugin does not force this — you control it.

**Limitations:**
- Only covers Rollup's own output. Other plugins (e.g., plugin-copy, plugin-html) may still perform disk I/O independently.
- Plugins that only use the `writeBundle` hook won't participate when `skipWrite` is enabled.

### dirs

Optional, `string` | `string[]`, default: `output.dir`.

Defines what dir to serve using Hono static middleware. If you want to disable static serving you can use `[]` (empty array) as `dirs`.

### port

Optional, `number`, default: `8080`.

Port to use for the server.

### host

Optional, `string`.

Host to use, by default, does not provide a host to createServer and lets Node.js decide.

### useLogger

Optional, `boolean`, default: `true`.

If the plugin should use Hono logger middleware.

### staticOptions

Optional.

Please check [`@hono/node-server/serve-static`](https://hono.dev/docs/getting-started/nodejs#serve-static-files) for options.

### https

Optional, `{ cert: string, key: string, ca?: string; }`.

Key and certificate to use for https. The best way to generate a certificate and key (and to install ca) is [`mkcert`](https://github.com/FiloSottile/mkcert).

### customize

Optional, `(app: Hono) => void`

Extension point to customize the Hono app.

### onListen

Optional, `(server: Server) => void | true`

Extension point after the server is live. Please return true to suppress the default banner.

### liveReload

Optional, `boolean`, default: `false`.

> **Note:** Live reload is currently disabled by default. Set to `true` to opt in.

When enabled and Rollup is running in watch mode, the plugin exposes a Server-Sent Events endpoint at `/__livereload` and injects a tiny client script into every served `text/html` response. After each rebuild the server broadcasts a `reload` event that triggers `location.reload()` in the browser.

Injection happens uniformly for in-memory HTML, disk-served HTML (via `dirs`), and any HTML returned by routes registered in `customize`. Non-HTML responses are left unchanged.

Set to `false` (or leave unset) to disable both the endpoint and the script injection.

## In-Memory Serving

```javascript
import serve from "@rollup-extras/plugin-serve";

export default {
  input: "src/index.js",
  output: {
    format: "es",
    dir: "dest",
  },
  watch: {
    skipWrite: true, // recommended: avoid writing files to disk
  },
  plugins: [serve({ inMemory: true })],
};
```

Hybrid mode — bundle from memory, static assets from disk:

```javascript
serve({ inMemory: true, dirs: ["public"] })
```

## Configuration

```typescript
type ServePluginOptions = {
    pluginName?: string;
    useWriteBundle?: boolean;
    inMemory?: boolean;
    liveReload?: boolean;
    dirs?: string | string[];
    port?: number;
    useLogger?: boolean;
    staticOptions?: object;
    host?: string;
    https?: {
      cert: string;
      key: string;
        ca?: string;
    };
    customize?: (app: Hono) => void;
    onListen?: (server: Server) => void | true;
} | string | string[]
```

## Prior Art

- https://github.com/thgh/rollup-plugin-serve
- https://github.com/pearofducks/rollup-plugin-dev
- https://github.com/modernweb-dev/web/tree/master/packages/dev-server-rollup
- https://github.com/lukeed/sirv

# License

[MIT](https://github.com/kshutkin/rollup-extras/blob/main/LICENSE)
