# Plugin Html

Rollup plugin to inject file names into html template.

Points:

- Inject file names with hashes
- Watch on a template file and trigger rebuild if it is changed
- Provides minimalistic template by default, so you are ready to start without configuration
- Support mutliple rollup configs (will trigger only when last output generated)
- Extensible through API so you can plug in something for html processing or generate new types of html elements

Uses [`@niceties/logger`](https://github.com/kshutkin/niceties/blob/main/logger/README.md) to log messages, can be configured through `@niceties/logger` API.

[Changlelog](./CHANGELOG.md)

## Installation

Using npm:
```
npm install --save-dev @rollup-extras/plugin-html
```

## Usage

```javascript
import html from '@rollup-extras/plugin-html';

export default {
    input: 'src/index.js',

    output: {
        format: 'es',
        dir: 'dest'
    },

    plugins: [html()],
} 
```

## Providing options

Just pass options to the plugin function. Returned object is the plugin instance which can be passed to rollup.

```javascript
html({option: value, option2: value2})
```

For additional plugin instances (in case of multiple configs) please use: `firstInstance.api.addInstance()`

## Options

### pluginName

Optional, string.

For debugging purposes, so many instances of a plugin can be differenciated in debugging output.

### outputFile

Optional, string, default: `'index.html'`.

Use to override output file name. If file name with the same name exits in pipeline it will be removed or overwritten in the process but its content by default will be used as an input for this plugin. In the following example file emitted by copy plugin will be used as an input for this plugin:

```javascript
import copy from '@rollup-extras/plugin-copy';
import html from '@rollup-extras/plugin-html';

export default {
    input: 'src/index.js',

    output: {
        format: 'es',
        dir: 'dest'
    },

    plugins: [copy('src/index.html'), html()],
} 
```

### template

Optional, string, default: `'<!DOCTYPE html><html><head></head><body></body></html>'`.

Default template string or template file name. If it is a template string it should contain `</head>` and `</body>` substrings to be useful by default template factory.

### watch

Optional, boolean, default: true.

If plugin found a template file name this option defines if plugin need to watch it or not.

### emitFile

Optional, boolean, default: true.

Defines if plugin should use this.emitFile or should just write it to disk. Option can be ignored in setup with mutliple rollup configs.

### useEmittedTemplate

Optional, boolean, default: true.

Defines what plugin does if it finds a file with expected file name in bundle. By default it will be used as a template. Template provided through template option should be of higher priority to the plugin.

### conditionalLoading

Optional, boolean, default: undefined.

Defines if plugin adds `nomodule` attribute for non modular js chunks. By default it is done only if we have `es` outputs in one of the bundles processed by plugin. Also plugin values `iife` outputs higher than `umd` and if we have both filters out `umd` ones. This can be changes only by providing custom `assetFactory`.

### injectIntoHead

Optional, RegExp | function | boolean, default: `(fileName: string) => fileName.endsWith(cssExtention)`.

Option to customize what assets should be injected into head element of a template.

### ignore

Optional, RegExp | function | boolean, default: false.

Option to customize what assets should be ignored in process.

### assetsFactory

Optional, function (please check type in configuration section).

To process additional types of assets. If known asset processed by factory (it returned an object, string or promise) plugin skips default processing for this asset.

Example:
```javascript

```

### templateFactory

Optional, function (please check type in configuration section).

Use to customize template with external libraries.

## Configuration

[Definition of config typings in typescript](./src/types.ts)

## Prior Art

- https://github.com/haifeng2013/rollup-plugin-bundle-html
- https://github.com/rollup/plugins/tree/master/packages/html
- https://github.com/modernweb-dev/web/tree/master/packages/rollup-plugin-html
- https://github.com/posthtml/posthtml#rollup

# License

[MIT](./LICENSE)
