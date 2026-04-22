# Plugin Html Input

Rollup plugin that infers JS inputs from `<script src>` tags in an HTML template, strips those scripts from the template, and (by default) emits the cleaned HTML as a Rollup asset.

Designed to compose with [`@rollup-extras/plugin-html`](../plugin-html): emit the cleaned template here, let `plugin-html` pick it up via its `useEmittedTemplate` behavior and re-inject hashed JS/CSS references.

Uses [`@niceties/logger`](https://github.com/kshutkin/niceties/blob/main/logger/README.md) for log messages.

[Changelog](./CHANGELOG.md)

## Installation

```
npm install --save-dev @rollup-extras/plugin-html-input
```

## Quick start

HTML as Rollup input:

```javascript
import htmlInput from '@rollup-extras/plugin-html-input';
import html from '@rollup-extras/plugin-html';

export default {
    input: 'src/index.html',

    output: {
        format: 'es',
        dir: 'dist',
    },

    plugins: [htmlInput(), html()],
};
```

Given `src/index.html`:

```html
<!doctype html>
<html>
    <head>
        <link rel="stylesheet" href="/static/app.css">
    </head>
    <body>
        <script type="module" src="./main.js"></script>
    </body>
</html>
```

Rollup builds `./main.js` as an entry, `plugin-html-input` emits the template without the `<script>` tag, and `plugin-html` injects the hashed module script back into the final HTML.

## Options

### pluginName

Optional, string.

For debugging purposes.

### verbose

Optional, boolean, default: `false`.

Log more during processing.

### input

Optional, string or string[].

Path(s) to HTML file(s). When omitted, the plugin looks at Rollup's own `input` for entries ending in `.html` or `.htm`.

- If Rollup's `input` is the HTML (or includes HTML entries), the HTML entries are **replaced** with the inferred JS inputs.
- If the `input` plugin option is used, inferred JS inputs are **appended** to Rollup's `input` (user entries are preserved).

### emit

Optional, boolean, default: `true`.

When true, the cleaned HTML is emitted as a Rollup asset. Asset file name:

- Single HTML input: the basename of the HTML file.
- Multiple HTML inputs: the relative path from the common parent directory — MPA-friendly.

When false, the plugin only rewrites `input` and never touches the bundle (use this if you render the HTML yourself).

### filter

Optional, `(src: string, attrs: Record<string, string>) => boolean`.

Custom script selection. Default keeps a `<script>` tag when **all** of:

- `src` is local (not `http(s)://`, not `//…`, not `data:`)
- `type="module"`
- `src` has a JS-like extension: `.js`, `.mjs`, `.cjs`, `.ts`, `.mts`, `.cts`, `.tsx`, `.jsx` (query string and hash are ignored)

Matched scripts become Rollup inputs and are stripped from the emitted HTML.

### removeNonMatched

Optional, boolean, default: `false`.

When true, local `<script src>` tags that were **not** matched by `filter` are also stripped from the emitted HTML (they do not become inputs). Useful when you want `plugin-html` to fully own script injection.

## What the parser does and does not handle

The plugin uses a small hand-rolled HTML tokenizer focused on script extraction. No runtime dependency, no full DOM.

**Handled correctly:**

- HTML comments `<!-- … -->`
- `<!DOCTYPE …>` and processing instructions
- CDATA sections `<![CDATA[ … ]]>`
- Case-insensitive tag and attribute names
- Attribute values: double-quoted, single-quoted, unquoted
- Self-closing `<script … />`
- Script body is opaque until the first `</script>` (HTML spec)
- Surrounding whitespace on a removed line is swallowed so no blank line remains

**Not handled (by design):**

- HTML entity decoding of `src` attribute values (local paths don't need it)
- `<base href>` resolution
- Inline `<script type="module">…</script>` (no `src`) — left untouched
- Asset URL rewriting for `<link>`, `<img>`, etc. — not this plugin's job

## Prior art

- Vite's internal `vite:build-html` plugin (same concept, broader scope with asset rewriting and HMR)
- [@web/rollup-plugin-html](https://github.com/modernweb-dev/web/tree/master/packages/rollup-plugin-html)

# License

[MIT](https://github.com/kshutkin/rollup-extras/blob/main/LICENSE)
