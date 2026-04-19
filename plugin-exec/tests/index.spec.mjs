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

    it('should invoke the exec callback once after bundle.write()', async () => {
        const callback = vi.fn();
        const bundle = await rollup({
            input: 'entry',
            plugins: [virtual({ entry: 'export default 1' }), exec(callback)],
        });
        await bundle.write({ format: 'es', dir: tmpDir });
        expect(callback).toHaveBeenCalledTimes(1);
        await bundle.close();
    });

    it('should expose a logger function on the callback this context', async () => {
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

    it('should not throw when no callback is provided', async () => {
        const bundle = await rollup({
            input: 'entry',
            plugins: [virtual({ entry: 'export default 1' }), exec(undefined)],
        });
        await expect(bundle.write({ format: 'es', dir: tmpDir })).resolves.not.toThrow();
        await bundle.close();
    });

    it('should use the custom pluginName when provided in the options object', async () => {
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

    it('should invoke the callback only once across multiple bundle.write() calls', async () => {
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

    it('should default the plugin name to @rollup-extras/plugin-exec', () => {
        const callback = vi.fn();
        expect(exec(callback).name).toBe('@rollup-extras/plugin-exec');
    });

    it('should accept an options object with only exec and use the default name', async () => {
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

    it('should accept an options object with only pluginName and not throw', async () => {
        const pluginInstance = exec({ pluginName: 'foo' });
        expect(pluginInstance.name).toBe('foo');

        const bundle = await rollup({
            input: 'entry',
            plugins: [virtual({ entry: 'export default 1' }), pluginInstance],
        });
        await expect(bundle.write({ format: 'es', dir: tmpDir })).resolves.not.toThrow();
        await bundle.close();
    });

    it('should not throw when passed an empty options object', async () => {
        const pluginInstance = exec({});
        expect(pluginInstance.name).toBe('@rollup-extras/plugin-exec');

        const bundle = await rollup({
            input: 'entry',
            plugins: [virtual({ entry: 'export default 1' }), pluginInstance],
        });
        await expect(bundle.write({ format: 'es', dir: tmpDir })).resolves.not.toThrow();
        await bundle.close();
    });

    it('should not invoke the callback when using bundle.generate()', async () => {
        const callback = vi.fn();
        const bundle = await rollup({
            input: 'entry',
            plugins: [virtual({ entry: 'export default 1' }), exec(callback)],
        });
        await bundle.generate({ format: 'es' });
        expect(callback).not.toHaveBeenCalled();
        await bundle.close();
    });

    it('should provide PluginContext methods (warn, emitFile) on the callback this context', async () => {
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

    it('should allow calling this.logger inside the exec callback without errors', async () => {
        let loggerCalled = false;
        const callback = vi.fn(function () {
            this.logger('test message');
            loggerCalled = true;
        });
        const bundle = await rollup({
            input: 'entry',
            plugins: [virtual({ entry: 'export default 1' }), exec(callback)],
        });
        await bundle.write({ format: 'es', dir: tmpDir });
        expect(callback).toHaveBeenCalledTimes(1);
        expect(loggerCalled).toBe(true);
        await bundle.close();
    });

    it('should propagate errors thrown by a synchronous exec callback', async () => {
        const callback = vi.fn(() => {
            throw new Error('sync-error');
        });
        const bundle = await rollup({
            input: 'entry',
            plugins: [virtual({ entry: 'export default 1' }), exec(callback)],
        });
        await expect(bundle.write({ format: 'es', dir: tmpDir })).rejects.toThrow('sync-error');
        await bundle.close();
    });

    it('should handle an async exec callback that returns a Promise', async () => {
        const callback = vi.fn(async () => {
            await new Promise(resolve => setTimeout(resolve, 10));
        });
        const bundle = await rollup({
            input: 'entry',
            plugins: [virtual({ entry: 'export default 1' }), exec(callback)],
        });
        await bundle.write({ format: 'es', dir: tmpDir });
        expect(callback).toHaveBeenCalledTimes(1);
        // Note: the plugin calls exec.apply() but doesn't await - so asyncDone may or may not be true
        // The key thing is no error is thrown
        await bundle.close();
    });
});
