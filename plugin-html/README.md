# Plugin Html

Rollup plugin to inject filenames into html template.

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

## Options



## Configuration

[Definition of config typings in typescript](./src/types.ts)

## Prior Art

- https://github.com/haifeng2013/rollup-plugin-bundle-html
- https://github.com/rollup/plugins/tree/master/packages/html
- https://github.com/open-wc/open-wc/tree/master/packages/building-rollup
- https://github.com/modernweb-dev/web/tree/master/packages/rollup-plugin-html
- https://github.com/posthtml/posthtml#rollup

# License

[MIT](./LICENSE)
