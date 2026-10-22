import { access, mkdtemp, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import serve from '../src/index.js';
import watch from '../src/watch.js';

function nextBuild(watcher) {
    return new Promise((resolve, reject) => {
        const errors = [];
        const timer = setTimeout(() => {
            watcher.off('event', onEvent);
            reject(new Error('Timed out waiting for watch build'));
        }, 5000);
        function onEvent(event) {
            if (event.code === 'ERROR') errors.push(event.error);
            if (event.code === 'END') {
                clearTimeout(timer);
                watcher.off('event', onEvent);
                resolve(errors);
            }
        }
        watcher.on('event', onEvent);
    });
}

describe('in-memory watch helper', () => {
    let dir;
    let input;
    let watcher;

    beforeEach(async () => {
        dir = await realpath(await mkdtemp(join(tmpdir(), 'serve-watch-')));
        input = join(dir, 'entry.js');
        await writeFile(input, 'console.log(1);');
    });

    afterEach(async () => {
        await watcher?.close();
        watcher = undefined;
        await rm(dir, { recursive: true, force: true });
    });

    it('serves all formats and assets, refreshes hashes, and closes the server without writing output', async () => {
        let server;
        let onListen;
        const listening = new Promise(resolve => {
            onListen = value => {
                server = value;
                resolve();
                return true;
            };
        });
        let closedBuilds = 0;
        const files = [];
        const outDir = join(dir, 'out');
        const config = {
            input,
            output: [
                { dir: outDir, format: 'es', entryFileNames: 'es-[hash].js', sourcemap: true },
                { dir: outDir, format: 'cjs', entryFileNames: 'cjs-[hash].js' },
            ],
            watch: { skipWrite: false, buildDelay: 10 },
            plugins: [
                {
                    name: 'assets-and-cleanup',
                    buildStart() {
                        this.emitFile({ type: 'asset', fileName: 'style.css', source: 'body { color: red; }' });
                    },
                    generateBundle(_options, bundle, isWrite) {
                        expect(isWrite).toBe(false);
                        files.push(...Object.keys(bundle).filter(file => file.endsWith('.js')));
                    },
                    closeBundle() {
                        closedBuilds++;
                    },
                    writeBundle() {
                        throw new Error('Must not write output');
                    },
                },
                serve({ port: 0, dirs: [], inMemory: true, useLogger: false, onListen }),
            ],
        };
        watcher = watch(config);
        expect(await nextBuild(watcher)).toEqual([]);
        await listening;
        const base = `http://127.0.0.1:${server.address().port}`;
        expect(files).toHaveLength(2);
        for (const file of files) {
            const response = await fetch(`${base}/${file}`);
            expect(response.status).toBe(200);
            expect(await response.text()).toContain('console.log(1)');
        }
        expect(await (await fetch(`${base}/style.css`)).text()).toBe('body { color: red; }');
        const oldFiles = files.splice(0);
        expect((await fetch(`${base}/${oldFiles.find(file => file.startsWith('es-'))}.map`)).status).toBe(200);

        const rebuilt = nextBuild(watcher);
        await writeFile(input, 'console.log(2);');
        expect(await rebuilt).toEqual([]);
        expect(files).toHaveLength(2);
        for (const file of files) {
            const response = await fetch(`${base}/${file}`);
            expect(response.status).toBe(200);
            expect(await response.text()).toContain('console.log(2)');
        }
        for (const file of oldFiles) expect((await fetch(`${base}/${file}`)).status).toBe(404);
        expect(closedBuilds).toBe(2);
        expect(config.watch.skipWrite).toBe(false);
        await expect(access(outDir)).rejects.toMatchObject({ code: 'ENOENT' });
        await watcher.close();
        expect(server.listening).toBe(false);
    });

    it('uses the right outputs for configurations sharing an input and output directory', async () => {
        const formats = [];
        const configs = ['es', 'cjs'].map(format => ({
            input,
            output: { dir: join(dir, 'out'), format, entryFileNames: `${format}.js` },
            plugins: [
                {
                    name: 'capture-format',
                    generateBundle(options, bundle) {
                        formats.push([options.format, Object.keys(bundle)]);
                    },
                },
            ],
        }));
        configs.push({ input: join(dir, 'missing.js'), watch: false });
        watcher = watch(configs);
        expect(await nextBuild(watcher)).toEqual([]);
        expect(formats).toEqual([
            ['es', ['es.js']],
            ['cjs', ['cjs.js']],
        ]);
        formats.length = 0;
        const rebuilt = nextBuild(watcher);
        await writeFile(input, 'console.log(2);');
        expect(await rebuilt).toEqual([]);
        expect(formats).toEqual([
            ['es', ['es.js']],
            ['cjs', ['cjs.js']],
        ]);
        await expect(access(join(dir, 'out'))).rejects.toMatchObject({ code: 'ENOENT' });
    });

    it('waits for every output before closing a failed build and recovers on the next change', async () => {
        let fail = true;
        let otherOutputDone = false;
        let closedBuilds = 0;
        watcher = watch({
            input,
            output: [{ format: 'es' }, { format: 'cjs' }],
            plugins: [
                {
                    name: 'fail-one-output',
                    async generateBundle(options) {
                        if (options.format === 'es' && fail) throw new Error('output failed');
                        if (options.format === 'cjs') {
                            await new Promise(resolve => setTimeout(resolve, 20));
                            otherOutputDone = true;
                        }
                    },
                    closeBundle() {
                        expect(otherOutputDone).toBe(true);
                        closedBuilds++;
                    },
                },
            ],
        });
        const errors = await nextBuild(watcher);
        expect(errors).toHaveLength(1);
        expect(errors[0].message).toContain('output failed');
        expect(closedBuilds).toBe(1);
        fail = false;
        otherOutputDone = false;
        const rebuilt = nextBuild(watcher);
        await writeFile(input, 'console.log(2);');
        expect(await rebuilt).toEqual([]);
        expect(closedBuilds).toBe(2);
    });

    it('recovers from an input error without requiring consumer cleanup', async () => {
        await writeFile(input, 'export default (');
        let generated = 0;
        watcher = watch({
            input,
            output: { format: 'es' },
            plugins: [
                {
                    name: 'capture-build',
                    generateBundle: () => {
                        generated++;
                    },
                },
            ],
        });
        expect(await nextBuild(watcher)).toHaveLength(1);
        // Error watch files are registered asynchronously by Rollup's Chokidar watcher.
        await new Promise(resolve => setTimeout(resolve, 100));
        const rebuilt = nextBuild(watcher);
        await writeFile(input, 'console.log(2);');
        expect(await rebuilt).toEqual([]);
        expect(generated).toBe(1);
    });

    it('finishes output hooks before tearing down a watcher closed during generation', async () => {
        let release;
        const blocked = new Promise(resolve => {
            release = resolve;
        });
        let entered;
        const generating = new Promise(resolve => {
            entered = resolve;
        });
        const hooks = [];
        watcher = watch({
            input,
            output: { format: 'es' },
            plugins: [
                {
                    name: 'delayed-output',
                    async generateBundle() {
                        entered();
                        await blocked;
                        hooks.push('generateBundle');
                    },
                    closeBundle() {
                        hooks.push('closeBundle');
                    },
                    closeWatcher() {
                        hooks.push('closeWatcher');
                    },
                },
            ],
        });
        await generating;
        const closing = watcher.close();
        release();
        await closing;
        expect(hooks).toEqual(['generateBundle', 'closeBundle', 'closeWatcher']);
    });

    it('can close immediately, including through a chained event subscription', async () => {
        const hooks = [];
        watcher = watch({
            input,
            output: { format: 'es' },
            plugins: [
                {
                    name: 'capture-cleanup',
                    generateBundle() {
                        hooks.push('generateBundle');
                    },
                    closeBundle() {
                        hooks.push('closeBundle');
                    },
                    closeWatcher() {
                        hooks.push('closeWatcher');
                    },
                },
            ],
        });
        const firstClose = watcher.on('event', () => {}).close();
        expect(watcher.close()).toBe(firstClose);
        await firstClose;
        expect(hooks).toEqual(['closeBundle', 'closeWatcher']);
    });

    it('waits for an input build before closing', async () => {
        let release;
        const blocked = new Promise(resolve => {
            release = resolve;
        });
        let entered;
        const building = new Promise(resolve => {
            entered = resolve;
        });
        const hooks = [];
        watcher = watch({
            input,
            plugins: [
                {
                    name: 'delayed-load',
                    async load() {
                        entered();
                        await blocked;
                        return 'console.log(1);';
                    },
                    generateBundle() {
                        hooks.push('generateBundle');
                    },
                    closeBundle() {
                        hooks.push('closeBundle');
                    },
                    closeWatcher() {
                        hooks.push('closeWatcher');
                    },
                },
            ],
        });
        await building;
        const closing = watcher.close();
        release();
        await closing;
        expect(hooks).toEqual(['closeBundle', 'closeWatcher']);
    });
});
