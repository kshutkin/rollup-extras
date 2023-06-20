![workflow](https://github.com/kshutkin/rollup-extras/actions/workflows/main.yml/badge.svg)

# rollup-extras
Collection of rollup plugins

## Packages in this repo

- [utils](./utils) - utilities for other plugins, including options and multi-output handling.
- [plugin-clean](./plugin-clean) - lightweight, reliable cleaning of the build directory.
- [plugin-copy](./plugin-copy) - files copying with minimalistic config, watch mode and glob support.
- [plugin-html](./plugin-html) - asset injection into HTML files with optional minification, beautification, and more.
- [plugin-serve](./plugin-serve) - [Koa-based](https://koajs.com/) dev-server with an extensible API.
- [plugin-binify](./plugin-binify) - makes an output file executable with shebang and file attributes.
- [plugin-externals](./plugin-externals) - declares external dependencies with reasonable defaults and customizable logic.
- [plugin-angularjs-template-cache](./plugin-angularjs-template-cache) - builds AngularJS template cache.
- [plugin-exec](./plugin-exec) - exec some code when the bundle you are building is finished.

## Other places to search for plugins

- [Official Rollup plugins](https://github.com/rollup/plugins)
- [Awesome Rollup](https://github.com/rollup/awesome)
- [Modern Web](https://modern-web.dev/docs/)

## Plugins you might want to check

### From `@rollup/plugin*`

- [@rollup/plugin-node-resolve](https://github.com/rollup/plugins/tree/master/packages/node-resolve/#readme) - if you have npm packages installed you probably need this as a first plugin
- [@rollup/plugin-commonjs](https://github.com/rollup/plugins/tree/master/packages/commonjs/#readme) - and if you have at least one file in legacy commonjs format then you need this one
- [@rollup/plugin-json](https://github.com/rollup/plugins/tree/master/packages/json/#readme) - allows to import JSON files, do not forget to use `resolveJsonModule` in `tsconfig.json` if you are using Typescript
- [@rollup/plugin-terser](https://github.com/rollup/plugins/tree/master/packages/terser/#readme) - minifies output js files, must-have for production browser builds

### Community

- [rollup-plugin-typescript2](https://github.com/ezolenko/rollup-plugin-typescript2) - best to use with Typescript, slightly less effort to use comparing to official [@rollup/plugin-typescript](https://github.com/rollup/plugins/tree/master/packages/typescript/#readme), faster incremental builds
- [rollup-plugin-preprocess](https://github.com/Katochimoto/rollup-plugin-preprocess) - despite being version 0.0.4 and not being updated for many years flawlessly preprocess files using [preprocess](https://github.com/jsoverson/preprocess) syntax, relatively safe compared to [@rollup/plugin-replace](https://github.com/rollup/plugins/blob/master/packages/replace/README.md) which is good mainly in case you don't have access to the source code of a 3-d party library but still want to replace some expression there
- [rollup-plugin-styles](https://github.com/Anidetrix/rollup-plugin-styles) - if you want to bundle CSS/SCSS/SASS/LESS/Stylus and want to use PostCSS plugins. I recommend using it with [postcss-lightningcss](https://github.com/onigoetz/postcss-lightningcss)
- [rollup-plugin-livereload](https://github.com/thgh/rollup-plugin-livereload) - simple livereload, I recommend always having a delay in config
- [rollup-plugin-glob-import](https://github.com/gjbkz/rollup-plugin-glob-import) if you want to import files using glob pattern. I would say it is antipattern and vendor-lock in most cases but sometimes it is extremely useful, especially in migrating old code bases and building component showcases.
- [rollup-plugin-html](https://github.com/bdadam/rollup-plugin-html) - allows importing html files as strings in that rare cases when you need it. Consider using [wildcard module declarations](https://www.typescriptlang.org/docs/handbook/modules.html#wildcard-module-declarations) if you are using Typescript.

## pkgbld

If you want to author a library and are happy with a relatively simple build give a chance to [pkgbld](https://github.com/kshutkin/package-build).

# License
[MIT](./LICENSE)
