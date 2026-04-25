![Coverage](https://raw.githubusercontent.com/kshutkin/rollup-extras/refs/heads/coverage/plugin-mangle/badge.svg)

# @rollup-extras/plugin-mangle

Rollup plugin to mangle (minify) specific variables and properties based on a configurable prefix.

This plugin walks the AST of each chunk and replaces identifiers, property keys, member expressions, and string literals that match a given prefix with short generated names (`a`, `b`, ..., `z`, `aa`, `ab`, ...).

## Installation

Using npm:

```
npm install --save-dev @rollup-extras/plugin-mangle
```

Using pnpm:

```
pnpm add -D @rollup-extras/plugin-mangle
```

## Usage

### Minimal (output plugin)

```js
import mangle from '@rollup-extras/plugin-mangle';

export default {
    input: 'src/index.js',
    output: {
        dir: 'dist',
        format: 'es',
        plugins: [mangle()],
    },
};
```

By default the plugin mangles all identifiers and properties that start with `$_`.

### Custom prefix

```js
mangle('$$')
```

### Full options

```js
mangle({
    prefix: '$$',
    pluginName: 'my-mangle',
})
```

## Options

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `prefix` | `string` | `'$_'` | The prefix used to identify properties / variables to mangle. |
| `pluginName` | `string` | `'@rollup-extras/plugin-mangle'` | Override the plugin name reported to Rollup. |

## How it works

The plugin operates in the `renderChunk` hook (making it an output plugin). For every chunk it:

1. Parses the code into an AST using Rollup's built-in `this.parse()`.
2. Walks the AST with `estree-walker`.
3. Replaces every occurrence of the configured prefix with a short, deterministic mangled name.
4. Returns the transformed code together with a high-resolution source map.

### What gets mangled

- **Property keys** in object literals and destructuring patterns: `{ $_prop: value }` → `{ a: value }`
- **Shorthand properties**: `{ $_prop }` → `{ a: a }`
- **Member expressions**: `obj.$_prop` → `obj.a`
- **String literals**: `'$_prop'` → `'a'`
- **Identifiers** used as variables (but not property keys or member access which are handled separately)

## License

[MIT](https://github.com/kshutkin/rollup-extras/blob/main/LICENSE)
