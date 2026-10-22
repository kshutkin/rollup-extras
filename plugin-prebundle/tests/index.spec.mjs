import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { pathToFileURL } from 'node:url';

import nodeResolve from '@rollup/plugin-node-resolve';
import { packageDirectory } from 'package-directory';
import { rollup } from 'rollup';
import { afterEach, describe, expect, it, vi } from 'vitest';

import prebundle from '../src/index.js';

vi.mock('package-directory', async importOriginal => {
    const mod = await importOriginal();
    return {
        ...mod,
        packageDirectory: vi.fn(mod.packageDirectory),
    };
});

const { realRollupImpl, childRollupShouldFail, childPlugins } = vi.hoisted(() => {
    return {
        realRollupImpl: { current: /** @type {any} */ (null) },
        childRollupShouldFail: { value: false },
        childPlugins: { current: [] },
    };
});

vi.mock('rollup', async importOriginal => {
    const mod = await importOriginal();
    realRollupImpl.current = mod.rollup;
    return {
        ...mod,
        rollup: vi.fn((...args) => {
            if (childRollupShouldFail.value && args[0]?.input === '\0prebundle-entry') {
                throw new Error('simulated child rollup failure');
            }
            if (args[0]?.input === '\0prebundle-entry') {
                args[0] = { ...args[0], plugins: [...args[0].plugins, ...childPlugins.current] };
            }
            return realRollupImpl.current(...args);
        }),
    };
});

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

const isPrebundled = o => o.fileName.startsWith('_prebundled.') && o.fileName.endsWith('.js');
const isNotPrebundled = o => !isPrebundled(o);

/**
 * Helper: run a Rollup build with the given virtual modules and plugin options,
 * then return the full output array.
 *
 * @param {Record<string, string>} modules   Virtual module map (id -> source).
 * @param {object} [pluginOptions]           Options forwarded to the prebundle plugin.
 * @param {{ extraPlugins?: import('rollup').Plugin[], generateOptions?: import('rollup').OutputOptions }} [buildOptions]
 */
async function build(modules, pluginOptions, buildOptions = {}) {
    const bundle = await rollup({
        input: 'entry',
        plugins: [virtual(modules), ...(buildOptions.extraPlugins ?? []), prebundle(pluginOptions)],
        onwarn() {},
    });
    const { output } = await bundle.generate({ format: 'es', ...buildOptions.generateOptions });
    await bundle.close();
    return output;
}

async function runOutput(output, run = module => module.default) {
    const dir = await mkdtemp(join(tmpdir(), 'prebundle-output-'));
    try {
        await writeFile(join(dir, 'package.json'), '{"type":"module"}');
        for (const item of output) {
            const file = join(dir, item.fileName);
            await mkdir(dirname(file), { recursive: true });
            await writeFile(file, item.type === 'chunk' ? item.code : item.source);
        }
        const entry = output.find(item => item.type === 'chunk' && item.isEntry);
        return await run(await import(pathToFileURL(join(dir, entry.fileName)).href));
    } finally {
        await rm(dir, { recursive: true, force: true });
    }
}

describe('@rollup-extras/plugin-prebundle integration', () => {
    afterEach(() => {
        childRollupShouldFail.value = false;
        childPlugins.current = [];
    });

    it('should use @rollup-extras/plugin-prebundle as the default plugin name', () => {
        const plugin = prebundle();
        expect(plugin.name).toBe('@rollup-extras/plugin-prebundle');
    });

    it('should override the default name when custom pluginName is provided', () => {
        const plugin = prebundle({ pluginName: 'my-prebundle' });
        expect(plugin.name).toBe('my-prebundle');
    });

    it('should be a no-op in build mode by default', async () => {
        const output = await build({
            entry: "import isBuiltin from 'is-builtin-module'; export default isBuiltin;",
        });

        const prebundled = output.find(o => isPrebundled(o));
        expect(prebundled).toBeUndefined();
        expect(output[0].code).toContain("from 'is-builtin-module'");
    });

    it('should prebundle external packages when enableInBuildMode is true', async () => {
        const output = await build(
            { entry: "import isBuiltin from 'is-builtin-module'; export default isBuiltin;" },
            { enableInBuildMode: true }
        );

        const prebundled = output.find(o => isPrebundled(o));
        expect(prebundled).toBeDefined();
        expect(prebundled.code.length).toBeGreaterThan(0);

        const mainChunk = output.find(o => isNotPrebundled(o));
        expect(mainChunk.code).toContain('_prebundled.');
        expect(mainChunk.code).not.toContain("from 'is-builtin-module'");
    });

    it('should preserve live default exports through the proxy', async () => {
        const proxy = prebundle().load('\0prebundle:live');
        const bundle = await rollup({
            input: 'entry',
            plugins: [
                virtual({
                    entry: `
                    import value, { set } from 'proxy';
                    import * as namespace from 'proxy';
                    const before = value;
                    set(2);
                    export default [before, value, namespace.default];
                `,
                    proxy,
                    './_prebundled.js': `
                    let value = 1;
                    export const __pre_live = { get default() { return value; }, set(next) { value = next; } };
                `,
                }),
            ],
        });
        try {
            const { output } = await bundle.generate({ format: 'es' });
            expect(await runOutput(output)).toEqual([1, 2, 2]);
        } finally {
            await bundle.close();
        }
    });

    it('should preserve default, named, and namespace import values at runtime', async () => {
        const output = await build(
            {
                entry: `
                    import resolve, { nodeResolve } from '@rollup/plugin-node-resolve';
                    import * as namespace from '@rollup/plugin-node-resolve';
                    export default [typeof resolve, resolve === nodeResolve, namespace.default === resolve, typeof namespace.nodeResolve];
                `,
            },
            { enableInBuildMode: true }
        );
        expect(await runOutput(output)).toEqual(['function', true, true, 'function']);
    });

    it('should emit dynamic child chunks and preserve lazy execution, including cached rebuilds', async () => {
        childPlugins.current = [
            virtual({
                'review-dynamic': 'export const run = () => import("review-lazy").then(module => module.value);',
                'review-lazy': 'globalThis.__prebundleLazyLoaded = true; export const value = 42;',
            }),
        ];
        const plugin = prebundle({ enableInBuildMode: true });
        let cache;
        try {
            for (let index = 0; index < 2; index++) {
                delete globalThis.__prebundleLazyLoaded;
                const bundle = await rollup({
                    input: 'entry',
                    cache,
                    plugins: [virtual({ entry: "export { run } from 'review-dynamic';" }), plugin],
                });
                try {
                    cache = bundle.cache;
                    const { output } = await bundle.generate({ format: 'es', sourcemap: true });
                    expect(output.filter(isPrebundled)).toHaveLength(2);
                    await runOutput(output, async module => {
                        expect(globalThis.__prebundleLazyLoaded).toBeUndefined();
                        expect(await module.run()).toBe(42);
                        expect(globalThis.__prebundleLazyLoaded).toBe(true);
                    });
                } finally {
                    await bundle.close();
                }
            }
        } finally {
            delete globalThis.__prebundleLazyLoaded;
        }
    });

    it('should not prebundle Node.js builtins', async () => {
        const output = await build({ entry: "import fs from 'node:fs'; export default fs;" }, { enableInBuildMode: true });

        const prebundled = output.find(o => isPrebundled(o));
        expect(prebundled).toBeUndefined();
        expect(output[0].code).toContain("from 'node:fs'");
    });

    it('should not prebundle bare builtins without node: prefix', async () => {
        const output = await build({ entry: "import path from 'path'; export default path;" }, { enableInBuildMode: true });

        const prebundled = output.find(o => isPrebundled(o));
        expect(prebundled).toBeUndefined();
    });

    it('should bundle local relative imports inline without prebundling', async () => {
        const output = await build(
            {
                entry: "import { foo } from './local'; export default foo;",
                './local': 'export const foo = 42;',
            },
            { enableInBuildMode: true }
        );

        const prebundled = output.find(o => isPrebundled(o));
        expect(prebundled).toBeUndefined();
        expect(output[0].code).toContain('42');
        expect(output[0].code).not.toContain("from './local'");
    });

    it('should not intercept absolute paths', async () => {
        const output = await build({ entry: "import { foo } from '/absolute/path'; export default foo;" }, { enableInBuildMode: true });

        const prebundled = output.find(o => isPrebundled(o));
        expect(prebundled).toBeUndefined();
    });

    it('should not intercept null-byte prefixed ids', async () => {
        const output = await build(
            {
                entry: "import { foo } from '\\0virtual:something'; export default foo;",
                '\0virtual:something': 'export const foo = 99;',
            },
            { enableInBuildMode: true }
        );

        const prebundled = output.find(o => isPrebundled(o));
        expect(prebundled).toBeUndefined();
    });

    it('should skip packages not in the packages filter', async () => {
        const output = await build(
            { entry: "import isBuiltin from 'is-builtin-module'; export default isBuiltin;" },
            { enableInBuildMode: true, packages: ['some-other-package'] }
        );

        const prebundled = output.find(o => isPrebundled(o));
        expect(prebundled).toBeUndefined();
    });

    it('should prebundle only packages matching the packages filter', async () => {
        const output = await build(
            { entry: "import isBuiltin from 'is-builtin-module'; export default isBuiltin;" },
            { enableInBuildMode: true, packages: ['is-builtin-module'] }
        );

        const prebundled = output.find(o => isPrebundled(o));
        expect(prebundled).toBeDefined();
    });

    it('should handle a mix of externals, builtins, and local imports', async () => {
        const output = await build(
            {
                entry: [
                    "import isBuiltin from 'is-builtin-module';",
                    "import fs from 'node:fs';",
                    "import { helper } from './utils';",
                    'export { isBuiltin, fs, helper };',
                ].join('\n'),
                './utils': "export const helper = 'local';",
            },
            { enableInBuildMode: true }
        );

        const prebundled = output.find(o => isPrebundled(o));
        expect(prebundled).toBeDefined();

        const mainChunk = output.find(o => isNotPrebundled(o));
        expect(mainChunk.code).toContain("'local'");
        expect(mainChunk.code).toContain("from 'node:fs'");
        expect(mainChunk.code).not.toContain("from 'is-builtin-module'");
    });

    it('should behave identically with an empty options object as with no options', async () => {
        const output = await build({ entry: "import isBuiltin from 'is-builtin-module'; export default isBuiltin;" }, {});

        const prebundled = output.find(o => isPrebundled(o));
        expect(prebundled).toBeUndefined();
    });

    it('should handle scoped packages in the packages filter', async () => {
        const output = await build(
            { entry: "import resolve from '@rollup/plugin-node-resolve'; export default resolve;" },
            { enableInBuildMode: true, packages: ['@rollup/plugin-node-resolve'] }
        );

        const prebundled = output.find(o => isPrebundled(o));
        expect(prebundled).toBeDefined();
    });

    it('should not emit prebundled chunk when no specifiers are discovered', async () => {
        const output = await build(
            {
                entry: "import { foo } from './local'; export default foo;",
                './local': 'export const foo = 1;',
            },
            { enableInBuildMode: true }
        );

        const prebundled = output.find(o => isPrebundled(o));
        expect(prebundled).toBeUndefined();
    });

    it.each([false, true])('should re-emit prebundles with Rollup cache (new instance: %s)', async newInstance => {
        let plugin = prebundle({ enableInBuildMode: true });
        let cache;
        for (let index = 0; index < 2; index++) {
            if (newInstance) plugin = prebundle({ enableInBuildMode: true });
            const bundle = await rollup({
                input: 'entry',
                cache,
                plugins: [virtual({ entry: "import isBuiltin from 'is-builtin-module'; export default isBuiltin('node:fs');" }), plugin],
            });
            try {
                cache = bundle.cache;
                const { output } = await bundle.generate({ format: 'es' });
                expect(output.some(isPrebundled)).toBe(true);
                expect(await runOutput(output)).toBe(true);
            } finally {
                await bundle.close();
            }
        }
    });

    it('should reuse cache on second build with the same specifiers', async () => {
        const plugin = prebundle({ enableInBuildMode: true });
        const v = virtual({ entry: "import isBuiltin from 'is-builtin-module'; export default isBuiltin;" });

        const bundle1 = await rollup({ input: 'entry', plugins: [v, plugin], onwarn() {} });
        const result1 = await bundle1.generate({ format: 'es' });
        await bundle1.close();

        const prebundled1 = result1.output.find(o => isPrebundled(o));
        expect(prebundled1).toBeDefined();

        // Second build with same plugin instance — should reuse cache
        const bundle2 = await rollup({ input: 'entry', plugins: [v, plugin], onwarn() {} });
        const result2 = await bundle2.generate({ format: 'es' });
        await bundle2.close();

        const prebundled2 = result2.output.find(o => isPrebundled(o));
        expect(prebundled2).toBeDefined();
        expect(prebundled2.code).toBe(prebundled1.code);
    });

    it("should isolate project caches while retaining each instance's cached rebuilds", async () => {
        const cwd = process.cwd();
        const dir = await mkdtemp(join(tmpdir(), 'prebundle-projects-'));
        const projects = ['first', 'second'].map(name => ({
            name,
            dir: join(dir, name),
            plugin: prebundle({ enableInBuildMode: true }),
            cache: undefined,
        }));
        const childBuildCount = () => vi.mocked(rollup).mock.calls.filter(([options]) => options.input === '\0prebundle-entry').length;
        const initialBuildCount = childBuildCount();
        try {
            for (const project of projects) {
                const dependency = join(project.dir, 'node_modules', 'cache-isolation-fixture');
                await mkdir(dependency, { recursive: true });
                await writeFile(join(project.dir, 'package.json'), '{"type":"module"}');
                await writeFile(
                    join(dependency, 'package.json'),
                    '{"name":"cache-isolation-fixture","type":"module","exports":"./index.js"}'
                );
                await writeFile(join(dependency, 'index.js'), `export default ${JSON.stringify(project.name)};`);
                await writeFile(join(project.dir, 'entry.js'), "export { default } from 'cache-isolation-fixture';");
            }
            for (const index of [0, 1, 0, 1]) {
                const project = projects[index];
                process.chdir(project.dir);
                const bundle = await rollup({
                    input: join(project.dir, 'entry.js'),
                    cache: project.cache,
                    plugins: [project.plugin],
                });
                try {
                    project.cache = bundle.cache;
                    const { output } = await bundle.generate({ format: 'es' });
                    expect(await runOutput(output)).toBe(project.name);
                } finally {
                    await bundle.close();
                }
            }
            expect(childBuildCount() - initialBuildCount).toBe(2);
        } finally {
            process.chdir(cwd);
            await rm(dir, { recursive: true, force: true });
        }
    });

    it('should invalidate cache when specifiers change between builds', async () => {
        const plugin = prebundle({ enableInBuildMode: true });

        const v1 = virtual({ entry: "import isBuiltin from 'is-builtin-module'; export default isBuiltin;" });
        const bundle1 = await rollup({ input: 'entry', plugins: [v1, plugin], onwarn() {} });
        const result1 = await bundle1.generate({ format: 'es' });
        await bundle1.close();

        const prebundled1 = result1.output.find(o => isPrebundled(o));
        expect(prebundled1).toBeDefined();

        // Second build — different specifier set (more specifiers)
        const v2 = virtual({
            entry: [
                "import isBuiltin from 'is-builtin-module';",
                "import resolve from '@rollup/plugin-node-resolve';",
                'export { isBuiltin, resolve };',
            ].join('\n'),
        });
        const bundle2 = await rollup({ input: 'entry', plugins: [v2, plugin], onwarn() {} });
        const result2 = await bundle2.generate({ format: 'es' });
        await bundle2.close();

        const prebundled2 = result2.output.find(o => isPrebundled(o));
        expect(prebundled2).toBeDefined();
        expect(prebundled2.code).not.toBe(prebundled1.code);
    });

    it('should invalidate cache when specifiers differ but count matches', async () => {
        const plugin = prebundle({ enableInBuildMode: true });

        // First build — is-builtin-module
        const v1 = virtual({ entry: "import isBuiltin from 'is-builtin-module'; export default isBuiltin;" });
        const bundle1 = await rollup({ input: 'entry', plugins: [v1, plugin], onwarn() {} });
        const result1 = await bundle1.generate({ format: 'es' });
        await bundle1.close();

        expect(result1.output.find(o => isPrebundled(o))).toBeDefined();

        // Second build — same count, different package
        const v2 = virtual({ entry: "import resolve from '@rollup/plugin-node-resolve'; export default resolve;" });
        const bundle2 = await rollup({ input: 'entry', plugins: [v2, plugin], onwarn() {} });
        const result2 = await bundle2.generate({ format: 'es' });
        await bundle2.close();

        const prebundled2 = result2.output.find(o => isPrebundled(o));
        expect(prebundled2).toBeDefined();
    });

    it('should prebundle packages resolved to node_modules via node-resolve', async () => {
        const v = virtual({ entry: "import isBuiltin from 'is-builtin-module'; export default isBuiltin;" });
        const p = prebundle({ enableInBuildMode: true });
        const nr = nodeResolve({ preferBuiltins: false });

        // prebundle before nodeResolve so prebundle's resolveId runs first,
        // then this.resolve() delegates to nodeResolve for the real resolution
        const bundle = await rollup({ input: 'entry', plugins: [v, p, nr], onwarn() {} });
        const { output } = await bundle.generate({ format: 'es' });
        await bundle.close();

        const prebundled = output.find(o => isPrebundled(o));
        expect(prebundled).toBeDefined();
    });

    it('should prebundle imports that resolve outside the project root', async () => {
        vi.mocked(packageDirectory).mockResolvedValueOnce('/tmp/fake-project');

        // Plugin placed after prebundle so this.resolve() finds it,
        // but returns a path outside the mocked project root without node_modules
        const resolveOutside = {
            name: 'resolve-outside-project',
            resolveId(source) {
                if (source === 'is-builtin-module') return '/tmp/outside/is-builtin-module.js';
            },
        };

        const v = virtual({ entry: "import isBuiltin from 'is-builtin-module'; export default isBuiltin;" });
        const p = prebundle({ enableInBuildMode: true });

        const bundle = await rollup({ input: 'entry', plugins: [v, p, resolveOutside], onwarn() {} });
        const { output } = await bundle.generate({ format: 'es' });
        await bundle.close();

        const prebundled = output.find(o => isPrebundled(o));
        expect(prebundled).toBeDefined();
    });

    it('should not prebundle imports that resolve within the project', async () => {
        // Plugin resolves a bare specifier to a local file inside the project
        const resolveInsideProject = {
            name: 'resolve-inside-project',
            resolveId(source) {
                if (source === 'my-local-alias') return `${process.cwd()}/fake-local-lib.js`;
            },
            load(id) {
                if (id.endsWith('/fake-local-lib.js')) return 'export default 42;';
            },
        };

        const v = virtual({ entry: "import foo from 'my-local-alias'; export default foo;" });
        const p = prebundle({ enableInBuildMode: true });

        const bundle = await rollup({ input: 'entry', plugins: [v, p, resolveInsideProject], onwarn() {} });
        const { output } = await bundle.generate({ format: 'es' });
        await bundle.close();

        const prebundled = output.find(o => isPrebundled(o));
        expect(prebundled).toBeUndefined();
        expect(output[0].code).toContain('42');
    });

    it('should prebundle imports that resolve as external via this.resolve', async () => {
        // Plugin marks the specifier as external so this.resolve returns { external: true }
        const markExternal = {
            name: 'mark-external',
            resolveId(source) {
                if (source === 'is-builtin-module') return { id: source, external: true };
            },
        };

        const v = virtual({ entry: "import isBuiltin from 'is-builtin-module'; export default isBuiltin;" });
        const p = prebundle({ enableInBuildMode: true });

        const bundle = await rollup({ input: 'entry', plugins: [v, p, markExternal], onwarn() {} });
        const { output } = await bundle.generate({ format: 'es' });
        await bundle.close();

        const prebundled = output.find(o => isPrebundled(o));
        expect(prebundled).toBeDefined();
    });

    it('should use current directory when packageDirectory returns null', async () => {
        vi.mocked(packageDirectory).mockResolvedValueOnce(undefined);

        const output = await build(
            { entry: "import isBuiltin from 'is-builtin-module'; export default isBuiltin;" },
            { enableInBuildMode: true }
        );

        // Should not throw — falls back to '.'
        const prebundled = output.find(o => isPrebundled(o));
        expect(prebundled).toBeDefined();
    });

    it('should handle child rollup failure gracefully', async () => {
        childRollupShouldFail.value = true;

        // Use a unique specifier not cached by previous tests to force a child build attempt
        const output = await build(
            { entry: "import commonjs from '@rollup/plugin-commonjs'; export default commonjs;" },
            { enableInBuildMode: true }
        );

        // Build completes without throwing, but no prebundled chunk since child build failed
        const prebundled = output.find(o => isPrebundled(o));
        expect(prebundled).toBeUndefined();
    });

    it('should fix prebundled import path when chunks are in a subdirectory', async () => {
        const output = await build(
            { entry: "import isBuiltin from 'is-builtin-module'; export default isBuiltin;" },
            { enableInBuildMode: true }
        );

        const prebundled = output.find(o => isPrebundled(o));
        expect(prebundled).toBeDefined();

        // Now re-generate with chunkFileNames in a subdirectory
        const bundle = await rollup({
            input: 'entry',
            plugins: [
                virtual({ entry: "import isBuiltin from 'is-builtin-module'; export default isBuiltin;" }),
                prebundle({ enableInBuildMode: true }),
            ],
            onwarn() {},
        });
        const { output: subDirOutput } = await bundle.generate({
            format: 'es',
            entryFileNames: 'assets/[name].js',
        });
        await bundle.close();

        const entryChunk = subDirOutput.find(o => o.fileName.startsWith('assets/'));
        expect(entryChunk).toBeDefined();
        // The import should reference ../_prebundled.[hash].js, not ./_prebundled.js
        expect(entryChunk.code).toMatch(/\.\.\/_prebundled\.[a-f0-9]+\.js/);
        expect(entryChunk.code).not.toMatch(/(?<!\.)\.\/_prebundled\./);
    });

    it('should emit sourcemap for the prebundled chunk when sourcemap is enabled', async () => {
        const output = await build(
            { entry: "import isBuiltin from 'is-builtin-module'; export default isBuiltin;" },
            { enableInBuildMode: true },
            { generateOptions: { sourcemap: true } }
        );

        const prebundled = output.find(o => isPrebundled(o) && o.type === 'chunk');
        expect(prebundled).toBeDefined();
        expect(prebundled.map).toBeTruthy();
        expect(prebundled.map.mappings).toBeTruthy();
    });

    it('should not include sourceMappingURL in prebundled chunk code when sourcemap is hidden', async () => {
        const output = await build(
            { entry: "import isBuiltin from 'is-builtin-module'; export default isBuiltin;" },
            { enableInBuildMode: true },
            { generateOptions: { sourcemap: 'hidden' } }
        );

        const prebundled = output.find(o => isPrebundled(o) && o.type === 'chunk');
        expect(prebundled).toBeDefined();
        expect(prebundled.code).not.toContain('sourceMappingURL');
    });

    it('should preserve sourcemaps from renderChunk path rewriting', async () => {
        const output = await build(
            { entry: "import isBuiltin from 'is-builtin-module'; export default isBuiltin;" },
            { enableInBuildMode: true },
            { generateOptions: { sourcemap: true } }
        );

        const mainChunk = output.find(o => isNotPrebundled(o) && o.type === 'chunk');
        expect(mainChunk).toBeDefined();
        expect(mainChunk.map).toBeTruthy();
    });
});
