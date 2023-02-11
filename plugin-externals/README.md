# plugin-externals

Rollup plugin to declare dependencies external with reasonable defaults and customizable logic.

Uses [is-builtin-module](https://www.npmjs.com/package/is-builtin-module) to check for buildin modules.

[Changlelog](./CHANGELOG.md)

## Installation

Using npm:
```
npm install --save-dev @rollup-extras/plugin-externals
```

## Example

Normal usage:

```javascript
import externals from '@rollup-extras/plugin-externals';

export default {
	input: 'src/index.js',

    output: {
        format: 'cjs',
        dir: 'dest'
    },

	plugins: [externals()],
}
```

## Options

### pluginName

Optional, `string`.

For debugging purposes, so many instances of a plugin can be differenciated in debugging output.

### verbose

Optional, `boolean`.

Bumps loglevel so more messages goes through default logger filter.

### external

Optional, `(id: string, external: boolean) => boolean`.

Default: `id.includes('node_modules') || isBuiltinModule(id) || isOutsideProjectDirectory(id, importer)`

Receives in `external` argument result of default function.

## Configuration

```typescript
type ExternalsPluginOptions = {
    pluginName?: string,
    verbose?: boolean,
    external?: (id: string, external: boolean) => boolean
};
```

## Prior Art

- https://github.com/Septh/rollup-plugin-node-externals

# License

[MIT](https://github.com/kshutkin/rollup-extras/blob/main/LICENSE)