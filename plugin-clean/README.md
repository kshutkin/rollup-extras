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

[Changlelog](./CHANGELOG.md)

## Installation

```
npm install --save-dev @rollup-extras/plugin-clean
```

### Examples

Normal usage:

```javascript
import clean from '@rollup-extras/plugin-clean';

export default {
	input: 'src/index.js',

    output: {
        format: 'es',
        dir: 'dest'
    },

	plugins: [clean()],
}
```

To override / provide target directory to clean use:
```javascript
clean('dir')
```
or

```javascript
clean(['dir1', 'dir2'])
```
or

```javascript
clean({targets: 'dir1'})
```

or

```javascript
clean({targets: ['dir1', 'dir2']})
```

Other supporded fields in options object: `pluginName`, `deleteOnce`, `outputPlugin` and `verbose`.

`pluginName` is just for debugging purpose so you can understand which instance of plugin responsible for an error.

`deleteOnce` can be set to `false` if you want to clean directory every rebuild.

`outputPlugin` can be set to `false` if you want plugin to trigger earlier (use with caution, you may want to define `targets` youself in this mode)

`verbose` is to get more messages in console.

## Configuration

```typescript
type CleanPluginOptions = {
    targets?: string | string[], // defaulted to output.dir per output
    pluginName?: string, // for debugging purposes, default is `@rollup-extras/plugin-clean`
    deleteOnce?: boolean, // default true
    outputPlugin?: boolean, // default true
    verbose?: boolean // default false
} | string | string[];
```

## Prior Art

- https://github.com/vladshcherbin/rollup-plugin-delete
- https://github.com/saf33r/rollup-plugin-cleaner
- https://github.com/DongShelton/rollup-plugin-clear

# License

[MIT](https://github.com/kshutkin/rollup-extras/blob/main/LICENSE)
