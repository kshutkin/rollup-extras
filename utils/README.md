# Utils

Utils to support the development of rollup plugins.

*Disclaimer: It is not a substitute for the `@rollup/pluginutils` package.*


[Changelog](./CHANGELOG.md)

## Installation

```
npm install --save-dev @rollup-extras/utils
```
## Options Utils

```typescript
function getOptions<T extends string | string[] | undefined | Record<string, unknown>, D, F extends DefaultsFactory<Partial<{[K in C]: string[]}> & Partial<Exclude<T, SimpleOptions>>>, C extends string>(options: T | undefined, defaults: D | undefined, field: C, factory?: F);
```

Utility function to get options object.

- `options` - object passed to the plugin, can be `string`, `string[]` or `undefined` (applied second)
- `defaults` - defaults (applied first)
- `factory` - additional factories (applied last)
- `field` - `string` to set a property in case options is `string` or `string[]`, if `options[field]` is `string` it will be converted to `string[]`

## Multi-config Plugin Base

Utility to construct a plugin that should/can be executed when multiple configs are used to gather information for the plugin.

```typescript
function multiConfigPluginBase(useWriteBundle: boolean, pluginName: string, execute: ExecuteFn): Partial<PluginHooks>
```
- `useWriteBundle` - truthy if `execute` function should be executed on the last `writeBundle`, falsy if it should be executed on `generateBundle`
- `pluginName` - plugin name
- `execute` - function to execute

Returns a plugin instance.

## Statistics

Utility to construct a collector of data that reports count if verbose / more than 5 items. The assumption is that in case of verbose an external logger will take care of reporting. It is very niche and probably you don't need it. The main idea for this is that in case we report thousands of files we are not holding data in memory but discarding it / writing it to log.

```typescript
function statistics(verbose: boolean, messageFactory: (result: number | string[]) => string): (name?: string) => undefined | string
```

Returns a collector that accepts new data if you pass a non-null/non-undefined parameter or constructs a message using the message factory.

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
