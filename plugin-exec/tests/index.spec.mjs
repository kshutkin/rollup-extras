import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { rollup } from 'rollup';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import exec from '../src/index.js';

function virtual(modules) {
    return {
        name: 'virtual-input',
        resolveId(id) {
            if (modules[id]) return id;
        },
        load(id) {
            if (modules[id]) return modules[id];
        },
    };
}

describe('@rollup-extras/plugin-exec', () => {
    let tmpDir;

    beforeEach(async () => {
        tmpDir = await mkdtemp(join(tmpdir(), 'exec-test-'));
    });

    afterEach(async () => {
        await rm(tmpDir, { recursive: true, force: true });
    });

    it('callback is called after bundle.write()', async () => {
        const callback = vi.fn();
        const bundle = await rollup({
            input: 'entry',
            plugins: [virtual({ entry: 'export default 1' }), exec(callback)],
        });
        await bundle.write({ format: 'es', dir: tmpDir });
        expect(callback).toHaveBeenCalledTimes(1);
        await bundle.close();
    });

    it('callback receives context with logger property', async () => {
        let receivedLogger;
        const callback = vi.fn(function () {
            receivedLogger = this.logger;
        });
        const bundle = await rollup({
            input: 'entry',
            plugins: [virtual({ entry: 'export default 1' }), exec(callback)],
        });
        await bundle.write({ format: 'es', dir: tmpDir });
        expect(callback).toHaveBeenCalledTimes(1);
        expect(receivedLogger).toBeDefined();
        expect(typeof receivedLogger).toBe('function');
        await bundle.close();
    });

    it('works when no callback is provided (no error)', async () => {
        const bundle = await rollup({
            input: 'entry',
            plugins: [virtual({ entry: 'export default 1' }), exec(undefined)],
        });
        await expect(bundle.write({ format: 'es', dir: tmpDir })).resolves.not.toThrow();
        await bundle.close();
    });

    it('supports custom plugin name option', async () => {
        const callback = vi.fn();
        const pluginInstance = exec({ pluginName: 'my-custom-exec', exec: callback });
        expect(pluginInstance.name).toBe('my-custom-exec');

        const bundle = await rollup({
            input: 'entry',
            plugins: [virtual({ entry: 'export default 1' }), pluginInstance],
        });
        await bundle.write({ format: 'es', dir: tmpDir });
        expect(callback).toHaveBeenCalledTimes(1);
        await bundle.close();
    });

    it('callback is only called once even with multiple outputs', async () => {
        const callback = vi.fn();
        const bundle = await rollup({
            input: 'entry',
            plugins: [virtual({ entry: 'export default 1' }), exec(callback)],
        });
        const dir1 = join(tmpDir, 'out1');
        const dir2 = join(tmpDir, 'out2');
        await bundle.write({ format: 'es', dir: dir1 });
        await bundle.write({ format: 'cjs', dir: dir2 });
        expect(callback).toHaveBeenCalledTimes(1);
        await bundle.close();
    });

    it('default plugin name is @rollup-extras/plugin-exec', () => {
        const callback = vi.fn();
        expect(exec(callback).name).toBe('@rollup-extras/plugin-exec');
    });

    it('options object with only exec: callback is called, name is default', async () => {
        const callback = vi.fn();
        const pluginInstance = exec({ exec: callback });
        expect(pluginInstance.name).toBe('@rollup-extras/plugin-exec');

        const bundle = await rollup({
            input: 'entry',
            plugins: [virtual({ entry: 'export default 1' }), pluginInstance],
        });
        await bundle.write({ format: 'es', dir: tmpDir });
        expect(callback).toHaveBeenCalledTimes(1);
        await bundle.close();
    });

    it('options object with only pluginName: does not throw, name matches', async () => {
        const pluginInstance = exec({ pluginName: 'foo' });
        expect(pluginInstance.name).toBe('foo');

        const bundle = await rollup({
            input: 'entry',
            plugins: [virtual({ entry: 'export default 1' }), pluginInstance],
        });
        await expect(bundle.write({ format: 'es', dir: tmpDir })).resolves.not.toThrow();
        await bundle.close();
    });

    it('empty object: does not throw, name is default', async () => {
        const pluginInstance = exec({});
        expect(pluginInstance.name).toBe('@rollup-extras/plugin-exec');

        const bundle = await rollup({
            input: 'entry',
            plugins: [virtual({ entry: 'export default 1' }), pluginInstance],
        });
        await expect(bundle.write({ format: 'es', dir: tmpDir })).resolves.not.toThrow();
        await bundle.close();
    });

    it('generate() does NOT trigger callback', async () => {
        const callback = vi.fn();
        const bundle = await rollup({
            input: 'entry',
            plugins: [virtual({ entry: 'export default 1' }), exec(callback)],
        });
        await bundle.generate({ format: 'es' });
        expect(callback).not.toHaveBeenCalled();
        await bundle.close();
    });

    it('context has PluginContext properties inside callback', async () => {
        let hasWarn = false;
        let hasEmitFile = false;
        const callback = vi.fn(function () {
            hasWarn = typeof this.warn === 'function';
            hasEmitFile = typeof this.emitFile === 'function';
        });
        const bundle = await rollup({
            input: 'entry',
            plugins: [virtual({ entry: 'export default 1' }), exec(callback)],
        });
        await bundle.write({ format: 'es', dir: tmpDir });
        expect(callback).toHaveBeenCalledTimes(1);
        expect(hasWarn).toBe(true);
        expect(hasEmitFile).toBe(true);
        await bundle.close();
    });
});
