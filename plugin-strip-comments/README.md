# @rollup-extras/plugin-strip-comments

Rollup output plugin that strips comments from generated chunks, with full sourcemap support.

Comments are classified into four types — `jsdoc`, `regular`, `license`, `annotation` — and you choose which types to remove. The plugin uses a purpose-built JS tokenizer (ported from [`package-prune`](https://github.com/kshutkin/package-prune)) that correctly handles strings, template literals with nested `${…}` expressions, regex literals, character classes, and hashbang lines.

## Installation

```
npm install --save-dev @rollup-extras/plugin-strip-comments
```

```
pnpm add -D @rollup-extras/plugin-strip-comments
```

## Usage

```js
import stripComments from '@rollup-extras/plugin-strip-comments';

export default {
    input: 'src/index.js',
    output: {
        dir: 'dist',
        format: 'es',
        plugins: [stripComments()],
    },
};
```

By default the plugin removes `jsdoc` and `regular` comments and preserves `license` and `annotation` comments.

### Strip everything including license headers

```js
stripComments(['jsdoc', 'regular', 'license', 'annotation'])
```

### Strip only license comments

```js
stripComments('license')
```

### Full options

```js
stripComments({
    types: ['jsdoc', 'regular'],
    pluginName: 'my-strip',
})
```

## Options

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `types` | `CommentType \| CommentType[] \| true` | `['jsdoc', 'regular']` | Comment types to remove. `true` is a shorthand for the default set. |
| `pluginName` | `string` | `'@rollup-extras/plugin-strip-comments'` | Override the plugin name reported to Rollup. |

`CommentType` is one of:

| Type | Matches |
| --- | --- |
| `jsdoc` | Block comments starting with `/**` (excluding the degenerate `/**/`). |
| `license` | Block comments starting with `/*!` or containing `@license` / `@preserve`. |
| `annotation` | Block comments whose trimmed body matches `/^[#@]__[A-Z_]+__$/` (e.g. `/*#__PURE__*/`, `/*@__PURE__*/`, `/*#__NO_SIDE_EFFECTS__*/`). |
| `regular` | Everything else — line comments (`//`) and non-matching block comments. |

## How it works

The plugin operates in the `renderChunk` hook (making it an output plugin). For every JS chunk (`.js` / `.mjs` / `.cjs`) it:

1. Scans the source for comments using a hand-rolled tokenizer.
2. Classifies each block comment as `license`, `jsdoc`, `annotation`, or `regular`.
3. Removes the comments whose type is in the configured set using `magic-string`.
4. Returns the transformed code together with a high-resolution source map.

Non-JS chunks (e.g. assets) are passed through unchanged.

## License

[MIT](https://github.com/kshutkin/rollup-extras/blob/main/LICENSE)
