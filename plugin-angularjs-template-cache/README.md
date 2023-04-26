# Plugin AngularJS templates cache

Builds AngularJS templates cache.

[Changlelog](./CHANGELOG.md)

## Installation

Using npm:
```
npm install --save-dev @rollup-extras/plugin-angularjs-template-cache
```

## Configuration

```typescript
type AngularTemplatesCachePluginOptions = {
    templates?: string, // defaults to ./**/*.html
    exclude?: string, // defaults to empty string
    rootDir?: string, // default to '.', relative to this directory will be resolved template url
    processHtml?: (html: string) => string, // function to process html templates
    pluginName?: string, // defaults to '@rollup-extras/plugin-angularjs-template-cache'
    angularModule?: string, // 'templates' by default
    module?: string, // 'templates' by default
    watch?: boolean, // true by default
    verbose?: boolean | 'list-filenames' // false by default
} | string | string[];
```

## Prior Art

- https://github.com/miickel/gulp-angular-templatecache
- https://github.com/darlanalves/gulp-templatecache
- https://github.com/rafaelmussi/angular-templatecache-webpack-plugin

# License

[MIT](https://github.com/kshutkin/rollup-extras/blob/main/LICENSE)
