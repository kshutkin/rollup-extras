# Utils

Utils to support creation of rollup plugins.

*Disclaimer: It is not a substitute of `@rollup/pluginutils` package.*


[Changlelog](./CHANGELOG.md)

## Installation

```
npm install --save-dev @rollup-extras/utils
```
## Options Utils

```typescript
function getOptions<T extends string | string[] | undefined | Record<string, unknown>, D, F extends DefaultsFactory<Partial<{[K in C]: string[]}> & Partial<Exclude<T, SimpleOptions>>>, C extends string>(options: T | undefined, defaults: D | undefined, field: C, factory?: F);
```

Utility function to get options object.

- `options` - object passed to plugin, can be `string`, `string[]` or `undefined` (applied second)
- `defaults` - defaults (applied first)
- `factory` - additional factories (applied last)
- `field` - `string` to set property in case options is `string` or `string[]`, if `options[field]` is `string` it will be converted to `string[]`

## Multiconfig Plugin Base

Utility to construct plugin that should/can be executed when multiple configs used to gather information for plugin.

```typescript
function multiConfigPluginBase(useWriteBundle: boolean, pluginName: string, execute: ExecuteFn): Partial<PluginHooks>
```
- `useWriteBundle` - truthy if function should be executed on last `writeBundle`, falthy if it should be executed on `generateBundle`
- `pluginName` - plugin name
- `execute` - function to execute

Returns plugin instance.

## Types

```typescript
type SimpleOptions = string | string[] | undefined;

type DefaultsFactory<T extends {[key: string]: unknown}> = {
    [key: string]: ((options: T | undefined, field: string) => unknown);
}

type Result<T extends {[key: string]: unknown}, F extends DefaultsFactory<T>> = T & {
    [key in keyof F]: F[key] extends ((options: T | undefined, field: string) => unknown) ? ReturnType<F[key]> : unknown;
}
```

# License

[MIT](https://github.com/kshutkin/rollup-extras/blob/main/LICENSE)
