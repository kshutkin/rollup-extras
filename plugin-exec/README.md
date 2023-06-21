# Plugin Exec

Executes some code when the bundle you are building is finished.

[Changelog](./CHANGELOG.md)

## Installation

Using npm:
```
npm install --save-dev @rollup-extras/plugin-exec
```

## Usage

```javascript
import exec from '@rollup-extras/plugin-exec';

export default {
    input: 'src/index.js',

    output: {
        format: 'es',
        dir: 'dest'
    },

    plugins: [exec(() => {
        console.log('finished');
    })],
} 
```

## Providing options

Just pass options to the plugin function. The returned object is the plugin instance which can be passed to rollup.

```javascript
exec({option: value, option2: value2})
```

For additional plugin instances (in case of multiple configs) please use `firstInstance.api.addInstance()`

## Options

### pluginName

Optional, `string`.

For debugging purposes, so many instances of the plugin can be differentiated in debugging output.

### exec

Optional, `(this: Context) => void`

Main 

## Configuration

```typescript
type CallbackFunction = (this: PluginContext & { logger: Logger }) => void;

export type ExecPluginOptions = {
    pluginName?: string;
    exec?: CallbackFunction;
} | CallbackFunction;
```

# License

[MIT](https://github.com/kshutkin/rollup-extras/blob/main/LICENSE)