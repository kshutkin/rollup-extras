# Plugin Binify

Rollup plugin to create cli entry files during build.

Points:

- simple
- respects sourcemaps
- changes permissions of the file(s)
- configurable

[Changlelog](./CHANGELOG.md)

## Installation

Using npm:
```
npm install --save-dev @rollup-extras/plugin-binify
```

Using yarn:
```
yarn add --dev @rollup-extras/plugin-binify
```

## Example

Normal usage:

```javascript
import binify from '@rollup-extras/plugin-binify';

export default {
	input: 'src/index.js',

    output: {
        format: 'cjs',
        dir: 'dest'
    },

	plugins: [binify()],
}
```

## Options

### pluginName

Optional, `string`.

For debugging purposes, so many instances of a plugin can be differenciated in debugging output.

### verbose

Optional, `boolean`.

Bumps loglevel so more messages goes through default logger filter.

### shebang

Optional, `string`.

Default: `#!/usr/bin/env node`

Override default shebang with something else.

### executableFlag

Optional, `number | false`.

Default: `0o755`

Number / string means try to set permissions on file using fs.chmod.
`false` (falsy values not work) disables permissions setting.

### filter

Optional, `(item: OutputAsset | OutputChunk) => boolean`.

Default: `(item: OutputAsset | OutputChunk) => item.type === 'chunk' && item.isEntry`

Filters chunks / assets before applying plugin transformation.

## Configuration

```typescript
type BinifyPluginOptions = {
    pluginName?: string,
    verbose?: boolean,
    shebang?: string,
    executableFlag?: number | string | false,
    filter?: (item: OutputAsset | OutputChunk) => boolean
};
```

## Prior Art

- https://www.npmjs.com/package/rollup-plugin-bin

# License

[MIT](./LICENSE)