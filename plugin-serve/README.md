# Plugin Serve

Rollup plugin for a dev server.

Points:

- Uses `koa`, customizable through koa middleware
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
import serve from '@rollup-extras/plugin-serve';

export default {
    input: 'src/index.js',

    output: {
        format: 'es',
        dir: 'dest'
    },

    plugins: [serve()],
} 
```

## Providing options

Just pass options to the plugin function. The returned object is the plugin instance which can be passed to rollup.

```javascript
serve({option: value, option2: value2})
```

For additional plugin instances (in case of multiple configs) please use `firstInstance.api.addInstance()`

## Options

### pluginName

Optional, `string`.

For debugging purposes, so many instances of a plugin can be differentiated in debugging output.

### useWriteBundle

Optional, `boolean`, default: `true`.

Option to use `writeBundle` hook instead of `generateBundle`.

### dirs

Optional, `string` | `string[]`, default: `output.dir`.

Defines what dir to serve using `koa-static` middleware. If you want to disable `koa-static` you can use `[]` (empty array) as `dirs`.

### port

Optional, `number`, default: `8080`.

Port to use for the server.

### host

Optional, `string`.

Host to use, by default, does not provide a host to createServer and lets nodejs decide.

### useKoaLogger

Optional, `boolean`, default: `true`.

If the plugin should use koa-logger middleware.

### koaStaticOptions

Optional.

Please check [`koa-static`](https://github.com/koajs/static) for options.

### https

Optional, `{ cert: string, key: string, ca?: string; }`.

Key and certificate to use for https. The best way to generate a certificate and key (and to install ca) is [`mkcert`](https://github.com/FiloSottile/mkcert).

### customizeKoa

Optional, `(koa: Koa) => void`

Extension point to customize `koa`.

### onListen

Optional, `(server: Server) => void | true`

Extension point after the server is live. Please return true to suppress the default banner.

## Configuration

```typescript
type ServePluginOptions = {
    pluginName?: string;
    useWriteBundle?: boolean;
    dirs?: string | string[];
    port?: number;
    useKoaLogger?: boolean;
    koaStaticOptions?: 'koa-static'.Options;
    host?: string;
    https?: {
        cert: string;
        key: string;
        ca?: string;
    },
    customizeKoa?: (koa: Koa) => void;
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