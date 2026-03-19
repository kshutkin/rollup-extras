import fs from 'node:fs/promises';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createLogger, LogLevel } from '@niceties/logger';

import plugin from '../src';

let loggerStart, loggerFinish;

vi.mock('fs/promises');
vi.mock('@niceties/logger', () => ({
    LogLevel: { verbose: 0, info: 1, warn: 2, error: 3 },
    createLogger: vi.fn(() => {
        loggerStart = vi.fn();
        loggerFinish = vi.fn();
        return { start: loggerStart, finish: loggerFinish };
    }),
}));

describe('@rollup-extras/plugin-clean', () => {
    beforeEach(() => {
        vi.mocked(fs.rm).mockClear();
        vi.mocked(createLogger).mockClear();
    });

    it('smoke', () => {
        expect(plugin).toBeDefined();
    });

    it('happy path', async () => {
        const pluginInstance = plugin();
        await pluginInstance.renderStart({ dir: '/dist2' });
        expect(fs.rm).toBeCalledTimes(1);
        expect(fs.rm).toHaveBeenCalledWith('/dist2', { recursive: true });
    });

    it('happy path - two output targets (1)', async () => {
        const pluginInstance = plugin();
        await pluginInstance.renderStart({ dir: '/dist2' });
        await pluginInstance.renderStart({ dir: '/dist2/subdir' });
        expect(fs.rm).toBeCalledTimes(1);
        expect(fs.rm).toHaveBeenCalledWith('/dist2', { recursive: true });
    });

    it('happy path - two output targets (2)', async () => {
        const pluginInstance = plugin();
        await pluginInstance.renderStart({ dir: '/dist2/subdir' });
        await pluginInstance.renderStart({ dir: '/dist2' });
        expect(fs.rm).toBeCalledTimes(2);
        expect(fs.rm).toHaveBeenCalledWith('/dist2/subdir', { recursive: true });
        expect(fs.rm).toHaveBeenCalledWith('/dist2', { recursive: true });
    });

    it('happy path - two output targets (3)', async () => {
        const pluginInstance = plugin();
        await pluginInstance.renderStart({ dir: '/dist2/subdir' });
        await pluginInstance.renderStart({ dir: '/dist2/subdir2' });
        expect(fs.rm).toBeCalledTimes(2);
        expect(fs.rm).toHaveBeenCalledWith('/dist2/subdir', { recursive: true });
        expect(fs.rm).toHaveBeenCalledWith('/dist2/subdir2', { recursive: true });
    });

    it('unhappy path', async () => {
        const pluginInstance = plugin(123);
        await pluginInstance.renderStart({ dir: '/dist2' });
        expect(fs.rm).toBeCalledTimes(1);
    });

    it('with non default directory (string)', async () => {
        const pluginInstance = plugin('/dist2');
        await pluginInstance.renderStart({ dir: '/dist3' });
        expect(fs.rm).toBeCalledTimes(1);
        expect(fs.rm).toHaveBeenCalledWith('/dist2', { recursive: true });
    });

    it('with non default directory (string[])', async () => {
        const pluginInstance = plugin(['/dist2']);
        await pluginInstance.renderStart({ dir: '/dist3' });
        expect(fs.rm).toBeCalledTimes(1);
        expect(fs.rm).toHaveBeenCalledWith('/dist2', { recursive: true });
    });

    it('happy path (with targets string)', async () => {
        const pluginInstance = plugin({ targets: '/dist2' });
        await pluginInstance.renderStart({});
        expect(fs.rm).toBeCalledTimes(1);
        expect(fs.rm).toHaveBeenCalledWith('/dist2', { recursive: true });
    });

    it('happy path (with targets string[])', async () => {
        const pluginInstance = plugin({ targets: ['/dist2'] });
        await pluginInstance.renderStart({});
        expect(fs.rm).toBeCalledTimes(1);
        expect(fs.rm).toHaveBeenCalledWith('/dist2', { recursive: true });
    });

    it('strips ending slash', async () => {
        const pluginInstance = plugin({ targets: '/dist2/' });
        await pluginInstance.renderStart({});
        expect(fs.rm).toBeCalledTimes(1);
        expect(fs.rm).toHaveBeenCalledWith('/dist2', { recursive: true });
    });

    it('deleteOnce by default', async () => {
        const pluginInstance = plugin();
        await pluginInstance.renderStart({ dir: '/dist2' });
        await pluginInstance.renderStart({ dir: '/dist2' });
        expect(fs.rm).toBeCalledTimes(1);
        expect(fs.rm).toHaveBeenCalledWith('/dist2', { recursive: true });
    });

    it('deleteOnce by default + addInstance', async () => {
        const pluginInstance = plugin();
        const pluginInstance2 = pluginInstance.api.addInstance();
        await pluginInstance.renderStart({ dir: '/dist2' });
        await pluginInstance.renderStart({ dir: '/dist2' });
        await pluginInstance2.renderStart({ dir: '/dist2' });
        await pluginInstance2.renderStart({ dir: '/dist2' });
        expect(fs.rm).toBeCalledTimes(1);
        expect(fs.rm).toHaveBeenCalledWith('/dist2', { recursive: true });
    });

    it('deleteOnce by default (check timings)', async () => {
        vi.mocked(fs.rm).mockImplementation(
            () =>
                new Promise(resolve => {
                    setTimeout(resolve, 50);
                })
        );
        const pluginInstance = plugin();
        let rmFinished = false;
        pluginInstance.renderStart({ dir: '/dist2' }).then(() => {
            rmFinished = true;
        });
        await pluginInstance.renderStart({ dir: '/dist2' });
        expect(rmFinished).toBeTruthy();
    });

    it('deleteOnce by default (check timings) + outputPlugin (do not block here)', async () => {
        vi.mocked(fs.rm).mockImplementation(
            () =>
                new Promise(resolve => {
                    setTimeout(resolve, 50);
                })
        );
        const pluginInstance = plugin({ outputPlugin: false, targets: '/dist2' });
        let rmFinished = false;
        pluginInstance.buildStart().then(() => {
            rmFinished = true;
        });
        await pluginInstance.buildStart();
        expect(rmFinished).toBeFalsy();
    });

    it('deleteOnce by default (check timings) + subdir (block here)', async () => {
        vi.mocked(fs.rm).mockImplementation(
            () =>
                new Promise(resolve => {
                    setTimeout(resolve, 50);
                })
        );
        const pluginInstance = plugin();
        let rmFinished = false;
        pluginInstance.renderStart({ dir: '/dist2/subdir' }).then(() => {
            rmFinished = true;
        });
        vi.mocked(fs.rm).mockImplementation(
            () =>
                new Promise(resolve => {
                    setTimeout(resolve, 10);
                })
        );
        await pluginInstance.renderStart({ dir: '/dist2' });
        expect(rmFinished).toBeTruthy();
    });

    it('deleteOnce by default + outputPlugin + addInstance', async () => {
        const pluginInstance = plugin({ outputPlugin: false, targets: '/dist2' });
        const pluginInstance2 = pluginInstance.api.addInstance();
        await pluginInstance.buildStart();
        await pluginInstance.buildStart();
        await pluginInstance2.buildStart();
        await pluginInstance2.buildStart();
        expect(fs.rm).toBeCalledTimes(1);
        expect(fs.rm).toHaveBeenCalledWith('/dist2', { recursive: true });
    });

    it('deleteOnce false', async () => {
        const pluginInstance = plugin({ deleteOnce: false });
        await pluginInstance.renderStart({ dir: '/dist2' });
        await pluginInstance.generateBundle();
        await pluginInstance.renderStart({ dir: '/dist2' });
        expect(fs.rm).toBeCalledTimes(2);
        expect(fs.rm).toHaveBeenCalledWith('/dist2', { recursive: true });
    });

    it('deleteOnce true', async () => {
        const pluginInstance = plugin({ deleteOnce: true });
        await pluginInstance.renderStart({ dir: '/dist2' });
        await pluginInstance.generateBundle();
        await pluginInstance.renderStart({ dir: '/dist2' });
        expect(fs.rm).toBeCalledTimes(1);
        expect(fs.rm).toHaveBeenCalledWith('/dist2', { recursive: true });
    });

    it('deleteOnce true + outputPlugin false + targets string', async () => {
        const pluginInstance = plugin({ deleteOnce: true, outputPlugin: false, targets: '/dist2' });
        await pluginInstance.buildStart();
        await pluginInstance.renderStart();
        await pluginInstance.generateBundle();
        await pluginInstance.buildStart();
        await pluginInstance.renderStart();
        expect(fs.rm).toBeCalledTimes(1);
        expect(fs.rm).toHaveBeenCalledWith('/dist2', { recursive: true });
    });

    it('deleteOnce true + outputPlugin false', async () => {
        const pluginInstance = plugin({ deleteOnce: true, outputPlugin: false, targets: ['/dist2'] });
        await pluginInstance.buildStart();
        await pluginInstance.renderStart();
        await pluginInstance.generateBundle();
        await pluginInstance.buildStart();
        await pluginInstance.renderStart();
        expect(fs.rm).toBeCalledTimes(1);
        expect(fs.rm).toHaveBeenCalledWith('/dist2', { recursive: true });
    });

    it('pluginName', async () => {
        const pluginName = 'test-plugin';
        const pluginInstance = plugin({ pluginName });
        await pluginInstance.renderStart({ dir: '/dist2' });
        expect(createLogger).toHaveBeenCalledWith(pluginName);
    });

    it('non verbose', async () => {
        const pluginInstance = plugin();
        await pluginInstance.renderStart({ dir: '/dist2' });
        expect(loggerStart).toHaveBeenCalledWith("cleaning '/dist2'", LogLevel.verbose);
        expect(loggerFinish).toHaveBeenCalledWith("cleaned '/dist2'");
    });

    it('verbose', async () => {
        const pluginInstance = plugin({ verbose: true });
        await pluginInstance.renderStart({ dir: '/dist2' });
        expect(loggerStart).toHaveBeenCalledWith("cleaning '/dist2'", LogLevel.info);
        expect(loggerFinish).toHaveBeenCalledWith("cleaned '/dist2'");
    });

    it('exception', async () => {
        vi.mocked(fs.rm).mockImplementationOnce(() => {
            throw { stack: '' };
        });
        const pluginInstance = plugin({ verbose: true });
        await pluginInstance.renderStart({ dir: 'dist2' });
        expect(loggerFinish).toHaveBeenCalledWith("failed cleaning 'dist2'", LogLevel.warn, expect.objectContaining({ stack: '' }));
    });

    it('missing directory exception', async () => {
        vi.mocked(fs.rm).mockImplementationOnce(() => {
            throw { code: 'ENOENT', stack: '' };
        });
        const pluginInstance = plugin({ verbose: true });
        await pluginInstance.renderStart({ dir: 'dist2' });
        expect(loggerFinish).toHaveBeenCalledWith(
            "failed cleaning 'dist2'",
            undefined,
            expect.objectContaining({ code: 'ENOENT', stack: '' })
        );
    });

    it('outputPlugin: false', async () => {
        const pluginInstance = plugin({ targets: 'dist2', outputPlugin: false });
        await pluginInstance.buildStart();
        expect(fs.rm).toBeCalledTimes(1);
        expect(fs.rm).toHaveBeenCalledWith('dist2', { recursive: true });
    });

    it('outputPlugin: false + options without dir', async () => {
        const pluginInstance = plugin({ outputPlugin: false });
        await pluginInstance.options({});
        await pluginInstance.buildStart();
        expect(fs.rm).toBeCalledTimes(0);
    });

    it('outputPlugin: false + options without dir 2', async () => {
        const pluginInstance = plugin({ outputPlugin: false });
        await pluginInstance.options({ output: {} });
        await pluginInstance.buildStart();
        expect(fs.rm).toBeCalledTimes(0);
    });

    it('outputPlugin: false + options', async () => {
        const pluginInstance = plugin({ outputPlugin: false });
        await pluginInstance.options({ output: { dir: 'dist2' } });
        await pluginInstance.buildStart();
        expect(fs.rm).toBeCalledTimes(1);
        expect(fs.rm).toHaveBeenCalledWith('dist2', { recursive: true });
    });

    it('outputPlugin: false + options with outputs array', async () => {
        const pluginInstance = plugin({ outputPlugin: false });
        await pluginInstance.options({ output: [{ dir: 'dist2' }] });
        await pluginInstance.buildStart();
        expect(fs.rm).toBeCalledTimes(1);
        expect(fs.rm).toHaveBeenCalledWith('dist2', { recursive: true });
    });
});
