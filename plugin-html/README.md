# Plugin Html

Rollup plugin to inject assets names into html template.

Points:

- Inject file names with hashes
- Watch on a template file and trigger rebuild if it is changed
- Provides a minimalistic template by default, so you are ready to start without configuration
- Supports multiple rollup configs (will trigger only when last output generated)
- Extensible through API so you can plug in something for HTML processing or generate new types of HTML elements

Uses [`@niceties/logger`](https://github.com/kshutkin/niceties/blob/main/logger/README.md) to log messages, which can be configured through `@niceties/logger` API.

[Changelog](./CHANGELOG.md)

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

Just pass options to the plugin function. The returned object is the plugin instance which can be passed to rollup.

```javascript
html({option: value, option2: value2})
```

For additional plugin instances (in case of multiple configs) please use `firstInstance.api.addInstance()`

## Options

### pluginName

Optional, string.

For debugging purposes, so many instances of a plugin can be differentiated in debugging output.

### outputFile

Optional, string, default: `'index.html'`.

Used to override output file name. If a filename with the same name exists in the pipeline it will be removed or overwritten in the process but its content by default will be used as input for this plugin. In the following example file emitted by copy plugin will be used as input for this plugin:

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
};
```

### template

Optional, string, default: `'<!DOCTYPE html><html><head></head><body></body></html>'`.

Default template string or template file name. If it is a template string it should contain `</head>` and `</body>` substrings to be useful by default template factory.

### watch

Optional, boolean, default: true.

If the plugin found a template file name this option defines if the plugin needs to watch it or not.

### emitFile

Optional, boolean, default: true.

Defines if the plugin should use this.emitFile or should just write it to disk. The option can be ignored in setup with multiple rollup configs.

### useEmittedTemplate

Optional, boolean, default: true.

Defines what the plugin does if it finds a file with the expected file name in the bundle. By default, it will be used as a template. Templates provided through the template option should be of higher priority to the plugin.

### conditionalLoading

Optional, boolean, default: undefined.

Defines if the plugin adds `nomodule` attributes for non-modular js chunks. By default, it is done only if we have an `es` output in one of the bundles processed by the plugin. Also plugin values `iife` outputs higher than `umd` and if we have both filters out `umd` ones. This can be changed only by providing a custom `assetFactory`.

### injectIntoHead

Optional, RegExp | function | boolean, default: `(fileName: string) => fileName.endsWith(cssExtention)`.

Option to customize what assets should be injected into the head element of a template.

### ignore

Optional, RegExp | function | boolean, default: false.

Option to customize what assets should be ignored in the process.

### verbose

Optional, boolean, default: false.

Option to print more debug information into the console (with default appender).

### useWriteBundle

Optional, boolean, default: false.

Option to use `writeBundle` hook instead of `generateBundle`.

### assetsFactory

Optional, function (please check type in configuration section).

To process additional types of assets / enhance default behavior. If a known asset is processed by a factory (it returns an object, string or promise), the plugin skips default processing for this asset.

Example (adds integrity attribute to a css file):
```javascript
import copy from '@rollup-extras/plugin-copy';
import html from '@rollup-extras/plugin-html';
import crypto from 'crypto';

export default {
    input: 'src/index.js',

    output: {
        format: 'es',
        dir: 'dest'
    },

    plugins: [copy('src/test.css'), html({
        assetsFactory: (fileName, content) => {
            if (fileName.endsWith('.css')) {
                const data = crypto
                    .createHash('sha384')
                    .update(content);
                return `<link rel="stylesheet" href="${fileName}" integrity="sha384-${data.digest('base64')}" type="text/css">`;
            }
            return undefined;
        }
    })],
};
```

### templateFactory

Optional, function (please check type in configuration section).

Used to customize templates with external libraries.

Example (pretty print html):

```javascript
import html from '@rollup-extras/plugin-html';
import sb from 'simply-beautiful';

export default {
    input: 'src/index.js',

    output: {
        format: 'es',
        dir: 'dest'
    },

    plugins: [html({
        templateFactory: (template, assets, defaultFactory) => sb.html(defaultFactory(template, assets))
    })],
};
```

## Asset Factories (/asset-factories export)

### simpleES5Script

`(PredicateSource) => AssetFactory`

Creates a simple script element.

### simpleES5FallbackScript

`(PredicateSource) => AssetFactory`

Creates a simple script element with `nomodule` attribute.

### simpleModuleScript

`(PredicateSource) => AssetFactory`

Creates a simple module script element.

### combineAssetFactories

`(...factories: AssetFactory[]) => AssetFactory`

Combines several factories, and calls them in order, the first factory-created asset wins.

## Configuration

[Definition of config typings in typescript](./src/types.ts)

## Prior Art

- https://github.com/haifeng2013/rollup-plugin-bundle-html
- https://github.com/rollup/plugins/tree/master/packages/html
- https://github.com/modernweb-dev/web/tree/master/packages/rollup-plugin-html
- https://github.com/posthtml/posthtml#rollup

# License

[MIT](https://github.com/kshutkin/rollup-extras/blob/main/LICENSE)
