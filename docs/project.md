# rollup-extras — Project Memory

## Overview

`rollup-extras` is a **pnpm monorepo** of Rollup plugins and utilities, published under the `@rollup-extras` npm scope.

## Workspace Layout

```
utils/                 — shared utilities used by all plugins
plugin-*/              — individual rollup plugins
test/angularjs/        — integration test app
test/big-config/       — integration test app
.changeset/            — changeset versioning config
.github/workflows/     — CI via shared reusable pipeline
```

Workspace is defined in `pnpm-workspace.yaml`:
- packages: `utils`, `plugin-*`, `test/big-config`, `test/angularjs`

## Package Conventions

Each package follows this layout:
```
src/index.js           — source (plain JS with JSDoc types, NOT TypeScript)
types/                 — generated .d.ts (produced by dts-buddy)
tests/*.spec.mjs       — integration tests (vitest, actual rollup calls)
tsconfig.json          — for dts-buddy / editor support
tsconfig.types.json    — for type-checking tests
package.json           — type: "module", exports map with types + default
```

Key `package.json` fields:
- `"type": "module"` — all packages are ESM
- `"types"`: `./types/index.d.ts`
- `"exports"` maps each subpath to `types` + `default`
- `"files"`: `["src", "types"]` — only source and generated types are published
- `"engines"`: `{ "node": ">=15" }`
- `peerDependencies`: `rollup ^4.0.0` (optional)
- Internal workspace deps use `"workspace:^"`

## Build System

- **Type generation**: `dts-buddy` — run via `pnpm build` in each package
- **Prepack**: `pkgprn-internal --flatten types,src --strip-comments [--remove-sourcemaps]`
- **Root build**: `pnpm -r build` (recursive)
- Source is plain `.js` with JSDoc `@typedef` / `@param` / `@returns` annotations — no `.ts` source files

## Testing

- **Runner**: `vitest` (config in root `vitest.config.js`)
- **Test files**: `**/tests/**/*.spec.mjs`
- **Environment**: `node`, pool `forks`
- **Coverage**: `@vitest/coverage-v8`, output to `./coverage` per package
- Tests are **integration tests** — they call `rollup()` directly with virtual input plugins
- Root test command: `pnpm --parallel -r test`

## Linting / Formatting

- **Tool**: Biome (`biome.json` at root)
- **Indent**: 4 spaces, LF line endings, line width 140
- **Quotes**: single quotes, trailing commas (es5)
- **Import order**: Node built-ins → external packages (non-rollup-extras/niceties) → `@rollup-extras/**` / `@niceties/**` → local paths
- Lint: `pnpm lint` | Fix: `pnpm lint:fix`

## Core Utilities (`@rollup-extras/utils`)

| Module | Purpose |
|---|---|
| `@rollup-extras/utils` | Re-exports `multiConfigPluginBase` and `getOptions` |
| `@rollup-extras/utils/options` | `getOptions(options, defaults, field, factory?)` — normalises string/array/object plugin options into a plain object |
| `@rollup-extras/utils/multi-config-plugin-base` | `multiConfigPluginBase(useWriteBundle, pluginName, execute, onFinalHook?)` — base for plugins that must run once across multiple rollup configs/outputs |
| `@rollup-extras/utils/logger` | Thin wrapper over `@niceties/logger` using `pluginName` |
| `@rollup-extras/utils/statistics` | Statistics helpers |

### `getOptions` pattern

Plugins call `getOptions(userOptions, defaults, shorthandField)` so users can pass:
- a `string` → `{ [field]: [value] }`
- a `string[]` → `{ [field]: value }`
- an `object` → merged with defaults

### `multiConfigPluginBase` pattern

Plugins that need to run exactly once across multi-config/multi-output rollup builds extend this base. It tracks `renderStart` calls and fires the execute callback on the final `generateBundle`/`writeBundle`.

The returned plugin exposes `api.addInstance()` for use in additional rollup output configs.

## Versioning & Publishing

- **Changesets** (`@changesets/cli`) — version management
- Access: `public`, base branch: `main`
- `updateInternalDependencies`: `patch`
- Publish: `pnpm ci:publish` (runs `changeset publish`)
- Package `test` is ignored from changesets

## CI

- GitHub Actions, delegates to shared reusable workflow: `kshutkin/pipeline/.github/workflows/main.yml@main`
- Scope: `@rollup-extras`
- Triggers: push/PR to `main`, version branches (`N.N.x`, `N.x.x`, `N.x`), `next`, `next-major`, `alpha`, `beta`

## In-progress / Planned Work

- `plugin-script-loader`: "emit asset" mode — see [plugin-script-loader/EMIT_ASSET_PLAN.md](../plugin-script-loader/EMIT_ASSET_PLAN.md)
  - New `emit: "inline" | "asset"` option
  - Emits legacy scripts as a non-module `<script>` asset file
  - Minification, sourcemaps, integration with `plugin-html`
