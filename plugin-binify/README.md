# Plugin Binify

Rollup plugin to create CLI entry files during the build.

Points:

- simple
- respects source maps
- changes permissions of the file(s)
- configurable

[Changelog](./CHANGELOG.md)

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

For debugging purposes, so many instances of a plugin can be differentiated in debugging output.

### verbose

Optional, `boolean`.

Bumps loglevel so more messages go through the default logger filter.

### shebang

Optional, `string`.

Default: `#!/usr/bin/env node`

Override default shebang with something else.

### executableFlag

Optional, `number | false`.

Default: `0o755`

Number/string defines permissions for a file, passed to `fs.chmod`.
`false` (falsy values not working) disables permissions settings.

### filter

Optional, `(item: OutputAsset | OutputChunk) => boolean`.

Default: `(item: OutputAsset | OutputChunk) => item.type === 'chunk' && item.isEntry`

Filters chunks/assets before applying plugin transformation.

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

[MIT](https://github.com/kshutkin/rollup-extras/blob/main/LICENSE)