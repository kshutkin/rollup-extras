# Plugin Copy

Rollup plugin to copy assets during build.

Points:

- Uses emitFile by default so all files goes through rollup asset pipeline
- Minimal configuration
- Runs once per file by default
- Support hashes (uses `assetFileNames` from rollup)
- Watch on files so when they changed thay can be copied again (but only if timestamp is changed)
- Minimal amount of logs by default
- Supports globs (check ['glob'](https://github.com/isaacs/node-glob) for syntax)
- Can be run both as output or build plugin (build plugin by default for watch)

Uses [`@niceties/logger`](https://github.com/kshutkin/niceties/blob/main/logger/README.md) to log messages, can be configured through `@niceties/logger` API.

[Changlelog](./CHANGELOG.md)

## Installation

Using npm:
```
npm install --save-dev @rollup-extras/plugin-copy
```

Using yarn:
```
yarn add --dev @rollup-extras/plugin-copy
```

## Examples

Assuming you imported plugin using:

```javascript
import copy from '@rollup-extras/plugin-copy';
```

Next examples are equivalent:
```javascript
copy('assets/*')
```

```javascript
copy(['assets/*'])
```

```javascript
copy({ src: 'assets/*' })
```

```javascript
copy([{ src: 'assets/*' }])
```

```javascript
copy({ targets: 'assets/*' })
```

```javascript
copy({ targets: ['assets/*'] })
```

```javascript
copy({ targets: [{ src: 'assets/*' }] })
```

all of them will trigger a copy (through emitFile) of all files in assets in each output directory.

To copy files on every rebuild in watch mode use `copyOnce` = `false`:

```javascript
copy({ src: 'assets/*', copyOnce: false })

// or

copy({ targets: ['assets/*'], copyOnce: false })
```

To stop triggering on changes in files use `watch` = `false`:

```javascript
copy({ src: 'assets/*', watch: false })

// or

copy({ targets: ['assets/*'], watch: false })
```

To display more information in console use `verbose` = `true`:

```javascript
copy({ src: 'assets/*', verbose: true })

// or

copy({ targets: ['assets/*'], verbose: true })
```

By default plugin uses `glob-parent` to preserve directory structure of assets (relative to glob parent path). To flattern files in assets directory use `flattern` = `true`:

```javascript
copy({ src: 'assets/*', flattern: true })

// or

copy({ targets: ['assets/*'], flattern: true })
```

To add hashes to file names use `exactFileNames` = `false`, tweek `assetFileNames` option in rollup config if needed. Files with same content will be deduplicated by `rollup` in this mode.

```javascript
copy({ src: 'assets/*', exactFileNames: false })

// or

copy({ targets: ['assets/*'], exactFileNames: false })
```

To work as output plugin use `outputPlugin` = `true` option (watch mode will be disabled because of `rollup` limitations):

```javascript
copy({ src: 'assets/*', outputPlugin: true })

// or

copy({ targets: ['assets/*'], outputPlugin: true })
```

To stop files being emitted through rollup pipeline use can use `emitFiles` = `false`. Please note that you need to specify `dest` and it will not be relative to output directory, also file will not be copied into each output directory.

```javascript
copy({ src: 'assets/*', dest: 'public', emitFiles: false })

// or

copy({ targets: [{ src: 'assets/*', dest: 'public' }], emitFiles: false })
```

### `dest` and `exclude`

Use `dest` option to put assets into subfolder in assets directory. As an example if we have `assets` as a directory for assets and `public` as an output directory and we specify `'dest'` = `'fonts'` assets will be copied into `public/assets/fonts` preserving assets directory structure.

Use `exclude` option to filter out files in assets (passed to ignore option of glob options). For example `*.json` will filter out json files.

```javascript
copy({ src: 'assets/*', dest: 'fonts', exclude: '*.json' })

// or

copy({ targets: [{ src: 'assets/*', dest: 'fonts', exclude: '*.json' }] })
```

## Configuration

```typescript
type SingleTargetDesc = {
    src: string,
    exclude?: string | string[],
    dest?: string;
};

type MultipleTargetsDesc = string | string[] | SingleTargetDesc | SingleTargetDesc[];

type CopyPluginOptions = {
    targets?: MultipleTargetsDesc,
    pluginName?: string, // defaults to '@rollup-extras/plugin-copy'
    copyOnce?: boolean, // true by default
    watch?: boolean, // true by default
    verbose?: boolean, // false by default
    flattern?: boolean, // false by default
    exactFileNames?: boolean, // true by default
    outputPlugin?: boolean, // false by default
    emitFiles?: boolean // true by default
} | MultipleTargetsDesc;
```

## Prior Art

- https://github.com/vladshcherbin/rollup-plugin-copy
- https://github.com/bengsfort/rollup-plugin-copy-assets
- https://github.com/paulmelnikow/rollup-plugin-cpy
- https://github.com/sormy/rollup-plugin-smart-asset
- https://github.com/modernweb-dev/web/tree/master/packages/rollup-plugin-copy
- https://github.com/rollup/plugins/tree/master/packages/url

# License

[MIT](./LICENSE)
