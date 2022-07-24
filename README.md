![workflow](https://github.com/kshutkin/rollup-extras/actions/workflows/main.yml/badge.svg)

# rollup-extras
Collection of rollup plugins

## Packages

- [utils](./utils) - utils package used by other plugins, mainly handlel options and multi output builds
- [plugin-clean](./plugin-clean) - plugin to clean build directory (lightweight, reliable and fast)
- [plugin-copy](./plugin-copy) - plugin to copy files: watch mode, minimalistic config, globs
- [plugin-html](./plugin-html) - plugin to inject assets in html file, optionally provide API to plug in minification, buitification and more
- [plugin-serve](./plugin-serve) - plugin to serve build directory using koa with extensible API
- [plugin-binify](./plugin-binify) - plugin to make your output file executable (using shebang and file attributes)
