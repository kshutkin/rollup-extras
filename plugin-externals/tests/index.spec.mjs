import { packageDirectory } from 'pkg-dir';
import { rollup } from 'rollup';
import { describe, expect, it, vi } from 'vitest';

import externals from '../src/index.js';

vi.mock('pkg-dir', async importOriginal => {
    const mod = await importOriginal();
    return {
        ...mod,
        packageDirectory: vi.fn(mod.packageDirectory),
    };
});

/**
 * A minimal virtual-input plugin that serves modules from an in-memory map.
 */
function virtual(modules) {
    return {
        name: 'virtual-input',
        resolveId(id) {
            if (modules[id] != null) return id;
        },
        load(id) {
            if (modules[id] != null) return modules[id];
        },
    };
}

/**
 * Helper: run a Rollup build with the given virtual modules and plugin options,
 * then return the generated ES module code for the single output chunk.
 *
 * @param {Record<string, string>} modules   Virtual module map (id -> source).
 * @param {object | Function} [pluginOptions] Options forwarded to the externals plugin.
 * @param {{ externalsFirst?: boolean }} [buildOptions] Extra build-level options.
 */
async function build(modules, pluginOptions, buildOptions = {}) {
    const virtualPlugin = virtual(modules);
    const externalsPlugin = externals(pluginOptions);

    // When externalsFirst is true the externals plugin resolveId hook runs
    // before the virtual plugin, which allows custom predicates to intercept
    // ids that the virtual plugin would otherwise resolve first.
    const plugins = buildOptions.externalsFirst ? [externalsPlugin, virtualPlugin] : [virtualPlugin, externalsPlugin];

    const bundle = await rollup({
        input: 'entry',
        plugins,
        // Silence Rollup's "unresolved import" warnings for externals
        onwarn() {},
    });
    const { output } = await bundle.generate({ format: 'es' });
    await bundle.close();
    return output[0].code;
}

describe('@rollup-extras/plugin-externals integration', () => {
    it('marks Node.js builtins as external', async () => {
        const code = await build({
            entry: "import fs from 'node:fs'; export default fs;",
        });

        // The import should be preserved as-is (not bundled)
        expect(code).toContain("from 'node:fs'");
    });

    it('marks imports whose specifier contains node_modules as external', async () => {
        const code = await build({
            entry: "import foo from 'node_modules/some-pkg/index.js'; export default foo;",
        });

        // The import should be preserved because the id contains "node_modules"
        expect(code).toContain("from 'node_modules/some-pkg/index.js'");
    });

    it('bundles local relative imports inline (not external)', async () => {
        const code = await build({
            entry: "import { foo } from './local';\nexport default foo;",
            './local': 'export const foo = 42;',
        });

        // The local module should have been inlined
        expect(code).not.toContain("from './local'");
        expect(code).toContain('const foo = 42');
    });

    it('handles a mix of builtins, node_modules, and local imports together', async () => {
        const code = await build({
            entry: [
                "import fs from 'node:fs';",
                "import path from 'node:path';",
                "import pkg from 'node_modules/some-lib/main.js';",
                "import { helper } from './utils';",
                'export { fs, path, pkg, helper };',
            ].join('\n'),
            './utils': "export const helper = 'hi';",
        });

        // Builtins are external
        expect(code).toContain("from 'node:fs'");
        expect(code).toContain("from 'node:path'");

        // node_modules path is external
        expect(code).toContain("from 'node_modules/some-lib/main.js'");

        // Local import is bundled inline
        expect(code).not.toContain("from './utils'");
        expect(code).toContain("const helper = 'hi'");
    });

    it('uses a custom external predicate to override decisions', async () => {
        // Place the externals plugin before virtual so that the custom
        // predicate can intercept './local' before the virtual plugin
        // resolves it.
        const code = await build(
            {
                entry: "import { foo } from './local';\nexport default foo;",
                './local': 'export const foo = 99;',
            },
            {
                external(id, isExternal) {
                    // Force './local' to become external
                    if (id === './local') return true;
                    return isExternal;
                },
            },
            { externalsFirst: true }
        );

        // './local' should be external: its source must NOT be inlined,
        // and there must be an import referencing the module (Rollup may
        // resolve the relative path so we match on the basename).
        expect(code).not.toContain('const foo = 99');
        expect(code).toMatch(/from\s+['"].*local['"]/);
    });

    it('accepts a function directly as the options (shorthand for external predicate)', async () => {
        // A bare function is treated as the external predicate.
        // Place externals first so it can intercept './mylib'.
        const code = await build(
            {
                entry: "import { bar } from './mylib';\nexport default bar;",
                './mylib': "export const bar = 'bundled';",
            },
            // Force everything external except the entry point itself
            (id, _isExternal) => id !== 'entry',
            { externalsFirst: true }
        );

        // './mylib' should be external because the predicate returned true
        expect(code).not.toContain("const bar = 'bundled'");
        expect(code).toMatch(/from\s+['"].*mylib['"]/);
    });

    it('marks bare builtins without node: prefix as external', async () => {
        const code = await build({
            entry: "import fs from 'fs'; export default fs;",
        });

        // 'fs' (without node: prefix) should still be recognized as a builtin and be external
        expect(code).toContain("from 'fs'");
    });

    it('custom external predicate can override a builtin to not-external', async () => {
        // When the predicate returns false for a builtin, the plugin's resolveId
        // returns null instead of false. We verify this by calling resolveId directly.
        const plugin = externals({
            external(id, isExternal) {
                if (id === 'node:fs') return false;
                return isExternal;
            },
        });
        // resolveId should return null (not-external) for node:fs
        const result = await plugin.resolveId.call({}, 'node:fs', 'entry');
        expect(result).toBeNull();

        // Without the override, the default plugin marks node:fs as external (false)
        const defaultPlugin = externals();
        const defaultResult = await defaultPlugin.resolveId.call({}, 'node:fs', 'entry');
        expect(defaultResult).toBe(false);
    });

    it('default plugin name is @rollup-extras/plugin-externals', () => {
        const plugin = externals();
        expect(plugin.name).toBe('@rollup-extras/plugin-externals');
    });

    it('custom pluginName overrides the default name', () => {
        const plugin = externals({ pluginName: 'my-ext' });
        expect(plugin.name).toBe('my-ext');
    });

    it('empty options object works the same as no options', async () => {
        const code = await build(
            {
                entry: "import fs from 'node:fs'; import { helper } from './lib'; export { fs, helper };",
                './lib': "export const helper = 'local';",
            },
            {}
        );

        // Builtin should still be external
        expect(code).toContain("from 'node:fs'");
        // Local should still be inlined
        expect(code).not.toContain("from './lib'");
        expect(code).toContain("const helper = 'local'");
    });

    it('marks multiple builtins without node: prefix as external', async () => {
        const code = await build({
            entry: ["import http from 'http';", "import path from 'path';", "import os from 'os';", 'export { http, path, os };'].join(
                '\n'
            ),
        });

        expect(code).toContain("from 'http'");
        expect(code).toContain("from 'path'");
        expect(code).toContain("from 'os'");
    });

    it('does not mark a non-builtin bare specifier as external by default', async () => {
        // 'lodash' is not a builtin and doesn't contain 'node_modules' in the id,
        // so it should not be treated as external. It will be unresolved (warning
        // silenced by onwarn), and Rollup will leave it as an external import only
        // if the plugin marks it as such. Since we don't, resolveId returns null
        // and Rollup's default behavior treats unresolved bare specifiers as external
        // with a warning. However, the plugin's resolveId explicitly returns null
        // (not false), so Rollup may still keep it. Let's verify the plugin's logic
        // by checking that resolveId returns null (not false) for 'lodash'.
        const plugin = externals();
        // Call resolveId directly to verify the decision
        const result = await plugin.resolveId.call({}, 'lodash', 'entry');
        expect(result).toBeNull();
    });
});

// --- NEW TESTS FOR BRANCH COVERAGE ---

describe('@rollup-extras/plugin-externals (additional coverage)', () => {
    it('resolves correctly when importer is undefined (first entry resolution)', async () => {
        const plugin = externals();
        // When importer is undefined, the fallback to empty string is used
        const result = await plugin.resolveId.call({}, 'node:fs', undefined);
        // node:fs is a builtin, so it should be external (false)
        expect(result).toBe(false);
    });

    it('resolves a non-builtin with undefined importer', async () => {
        const plugin = externals();
        const result = await plugin.resolveId.call({}, './local', undefined);
        // ./local resolved from dirname('') = '.' so it stays local
        expect(result).toBeNull();
    });

    it('flips external decisions when custom predicate inverts isExternal', async () => {
        const { resolve } = await import('node:path');
        const plugin = externals({
            external: (_id, isExternal) => !isExternal,
        });

        // A builtin like node:fs is normally external, but the flip makes it not-external
        const builtinResult = await plugin.resolveId.call({}, 'node:fs', 'entry.js');
        expect(builtinResult).toBeNull();

        // A relative import inside the project is normally not-external
        // The flip makes it external (returns false)
        const importer = resolve('src/entry.js');
        const localResult = await plugin.resolveId.call({}, './local', importer);
        expect(localResult).toBe(false);
    });

    it('falls back to "." when packageDirectory() returns undefined', async () => {
        // Mock packageDirectory to return undefined for this test,
        // triggering the ?? '.' fallback on line 41
        packageDirectory.mockResolvedValueOnce(undefined);

        const plugin = externals();

        // First resolveId call initializes pkgDir; since packageDirectory()
        // returns undefined, pkgDir becomes '.'
        const builtinResult = await plugin.resolveId.call({}, 'node:fs', 'entry.js');
        // node:fs is still a builtin -> external
        expect(builtinResult).toBe(false);

        // pkgDir is now cached as '.', so a local import resolved within
        // the current working directory should NOT be external
        const localResult = await plugin.resolveId.call({}, './helper', 'entry.js');
        expect(localResult).toBeNull();
    });

    it('falls back to "." for packageDirectory and handles undefined importer together', async () => {
        // Both branches in one test: packageDirectory -> undefined AND importer -> undefined
        packageDirectory.mockResolvedValueOnce(undefined);

        const plugin = externals();

        // With pkgDir='.' and importer=undefined (falls back to ''),
        // resolve(dirname(''), 'node:fs') still identifies the builtin
        const result = await plugin.resolveId.call({}, 'node:fs', undefined);
        expect(result).toBe(false);
    });

    it('falls back to "." for packageDirectory with a non-builtin and undefined importer', async () => {
        packageDirectory.mockResolvedValueOnce(undefined);

        const plugin = externals();

        // ./local with pkgDir='.' and importer=undefined -> dirname('')='.'
        // resolve('.', './local') = <cwd>/local, relative('.', <cwd>/local) = 'local'
        // 'local' does not start with '..' -> not external
        const result = await plugin.resolveId.call({}, './local', undefined);
        expect(result).toBeNull();
    });

    it('custom predicate that inverts isExternal works with undefined importer', async () => {
        const plugin = externals({
            external: (_id, isExternal, _importer) => !isExternal,
        });

        // Builtin with undefined importer: normally external -> flipped to not-external
        const result = await plugin.resolveId.call({}, 'node:fs', undefined);
        expect(result).toBeNull();

        // Non-builtin local with undefined importer: normally not-external -> flipped to external
        const plugin2 = externals({
            external: (_id, isExternal, _importer) => !isExternal,
        });
        const localResult = await plugin2.resolveId.call({}, './local', undefined);
        expect(localResult).toBe(false);
    });

    it('works with verbose option enabled', async () => {
        const plugin = externals({ verbose: true });

        // Exercises the verbose ? LogLevel.info : LogLevel.verbose branch (truthy side)
        const result = await plugin.resolveId.call({}, 'node:fs', 'entry.js');
        expect(result).toBe(false);

        const localResult = await plugin.resolveId.call({}, './local', 'entry.js');
        expect(localResult).toBeNull();
    });
});
