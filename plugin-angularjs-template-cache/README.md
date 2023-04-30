# Plugin AngularJS template cache

Plugin to build AngularJS template cache.

[Changelog](./CHANGELOG.md)

## Installation

Using npm:
```
npm install --save-dev @rollup-extras/plugin-angularjs-template-cache
```

## Example

Basic:

```javascript
import templatesCache from '@rollup-extras/plugin-angularjs-template-cache';

export default {
	input: 'src/index.js',

    output: {
        format: 'es',
        dir: 'dest'
    },

	plugins: [
        templateCache('./views/**/*.html'),
    ],
}
```

With `useImports = true` and `rootDir`:

```javascript
import templatesCache from '@rollup-extras/plugin-angularjs-template-cache';
import htmlImport from 'rollup-plugin-html';

export default {
	input: 'src/index.js',

    output: {
        format: 'es',
        dir: 'dest'
    },

	plugins: [
        htmlImport({include: '**/*.html'}),
        templateCache({ templates: './src/**/*.html', rootDir: './src', useImports: true}),
    ],
}
```

## Configuration

```typescript
type AngularTemplatesCachePluginOptions = {
    templates?: string | string[], // defaults to ./**/*.html, glob to get files into templateCache
    watch?: boolean, // true by default
    rootDir?: string, // default to '.', root directory from which the plugin will construct template URIs (IDs)
    transformTemplateUri?: (uri: string) => string, // last chance to transform template URI before actually using it in `templateCache.put` call
    processHtml?: (html: string) => string, // function to process html templates, for example htmlmin, not applied when `useImports = true`
    pluginName?: string, // defaults to '@rollup-extras/plugin-angularjs-template-cache'    
    angularModule?: string, // 'templates' by default, angular module name
    standalone?: boolean, // true by default, true if we plugin needs to create module and false to just retrieve it
    module?: string, // 'templates' by default, javascript module name, import not automatically injected into bundle
    importAngular?: boolean, // default true, wheather to import angular or use global
    autoImport?: boolean, // false by default, automatically import generated module (useful for standalone module referenced by name)
    verbose?: boolean | 'list-filenames', // false by default
    useImports?: boolean // false by default, instead of reading files from filesystem generate imports to get them through rollup pipeline. this probably requires additional plugins like `rollup-plugin-html`
} | string | string[];
```

## Prior Art

- https://github.com/miickel/gulp-angular-templatecache
- https://github.com/darlanalves/gulp-templatecache
- https://github.com/rafaelmussi/angular-templatecache-webpack-plugin

# License

[MIT](https://github.com/kshutkin/rollup-extras/blob/main/LICENSE)
