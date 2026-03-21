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

    it('should be defined', () => {
        expect(plugin).toBeDefined();
    });

    it('should clean output directory', async () => {
        const pluginInstance = plugin();
        await pluginInstance.renderStart({ dir: '/dist2' });
        expect(fs.rm).toBeCalledTimes(1);
        expect(fs.rm).toHaveBeenCalledWith('/dist2', { recursive: true });
    });

    it('should clean parent directory only for nested output targets', async () => {
        const pluginInstance = plugin();
        await pluginInstance.renderStart({ dir: '/dist2' });
        await pluginInstance.renderStart({ dir: '/dist2/subdir' });
        expect(fs.rm).toBeCalledTimes(1);
        expect(fs.rm).toHaveBeenCalledWith('/dist2', { recursive: true });
    });

    it('should clean both directories when parent comes second', async () => {
        const pluginInstance = plugin();
        await pluginInstance.renderStart({ dir: '/dist2/subdir' });
        await pluginInstance.renderStart({ dir: '/dist2' });
        expect(fs.rm).toBeCalledTimes(2);
        expect(fs.rm).toHaveBeenCalledWith('/dist2/subdir', { recursive: true });
        expect(fs.rm).toHaveBeenCalledWith('/dist2', { recursive: true });
    });

    it('should clean both sibling directories', async () => {
        const pluginInstance = plugin();
        await pluginInstance.renderStart({ dir: '/dist2/subdir' });
        await pluginInstance.renderStart({ dir: '/dist2/subdir2' });
        expect(fs.rm).toBeCalledTimes(2);
        expect(fs.rm).toHaveBeenCalledWith('/dist2/subdir', { recursive: true });
        expect(fs.rm).toHaveBeenCalledWith('/dist2/subdir2', { recursive: true });
    });

    it('should handle invalid options gracefully', async () => {
        const pluginInstance = plugin(123);
        await pluginInstance.renderStart({ dir: '/dist2' });
        expect(fs.rm).toBeCalledTimes(1);
    });

    it('should clean non-default directory passed as string', async () => {
        const pluginInstance = plugin('/dist2');
        await pluginInstance.renderStart({ dir: '/dist3' });
        expect(fs.rm).toBeCalledTimes(1);
        expect(fs.rm).toHaveBeenCalledWith('/dist2', { recursive: true });
    });

    it('should clean non-default directory passed as string array', async () => {
        const pluginInstance = plugin(['/dist2']);
        await pluginInstance.renderStart({ dir: '/dist3' });
        expect(fs.rm).toBeCalledTimes(1);
        expect(fs.rm).toHaveBeenCalledWith('/dist2', { recursive: true });
    });

    it('should clean target passed as string in options', async () => {
        const pluginInstance = plugin({ targets: '/dist2' });
        await pluginInstance.renderStart({});
        expect(fs.rm).toBeCalledTimes(1);
        expect(fs.rm).toHaveBeenCalledWith('/dist2', { recursive: true });
    });

    it('should clean target passed as string array in options', async () => {
        const pluginInstance = plugin({ targets: ['/dist2'] });
        await pluginInstance.renderStart({});
        expect(fs.rm).toBeCalledTimes(1);
        expect(fs.rm).toHaveBeenCalledWith('/dist2', { recursive: true });
    });

    it('should strip trailing slash from target path', async () => {
        const pluginInstance = plugin({ targets: '/dist2/' });
        await pluginInstance.renderStart({});
        expect(fs.rm).toBeCalledTimes(1);
        expect(fs.rm).toHaveBeenCalledWith('/dist2', { recursive: true });
    });

    it('should delete once by default', async () => {
        const pluginInstance = plugin();
        await pluginInstance.renderStart({ dir: '/dist2' });
        await pluginInstance.renderStart({ dir: '/dist2' });
        expect(fs.rm).toBeCalledTimes(1);
        expect(fs.rm).toHaveBeenCalledWith('/dist2', { recursive: true });
    });

    it('should delete once by default with addInstance', async () => {
        const pluginInstance = plugin();
        const pluginInstance2 = pluginInstance.api.addInstance();
        await pluginInstance.renderStart({ dir: '/dist2' });
        await pluginInstance.renderStart({ dir: '/dist2' });
        await pluginInstance2.renderStart({ dir: '/dist2' });
        await pluginInstance2.renderStart({ dir: '/dist2' });
        expect(fs.rm).toBeCalledTimes(1);
        expect(fs.rm).toHaveBeenCalledWith('/dist2', { recursive: true });
    });

    it('should wait for first delete to finish before returning second', async () => {
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

    it('should not block on buildStart when outputPlugin is false', async () => {
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

    it('should block on subdirectory cleanup when parent is also cleaned', async () => {
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

    it('should delete once with outputPlugin false and addInstance', async () => {
        const pluginInstance = plugin({ outputPlugin: false, targets: '/dist2' });
        const pluginInstance2 = pluginInstance.api.addInstance();
        await pluginInstance.buildStart();
        await pluginInstance.buildStart();
        await pluginInstance2.buildStart();
        await pluginInstance2.buildStart();
        expect(fs.rm).toBeCalledTimes(1);
        expect(fs.rm).toHaveBeenCalledWith('/dist2', { recursive: true });
    });

    it('should delete on each build when deleteOnce is false', async () => {
        const pluginInstance = plugin({ deleteOnce: false });
        await pluginInstance.renderStart({ dir: '/dist2' });
        await pluginInstance.generateBundle();
        await pluginInstance.renderStart({ dir: '/dist2' });
        expect(fs.rm).toBeCalledTimes(2);
        expect(fs.rm).toHaveBeenCalledWith('/dist2', { recursive: true });
    });

    it('should delete only once when deleteOnce is true', async () => {
        const pluginInstance = plugin({ deleteOnce: true });
        await pluginInstance.renderStart({ dir: '/dist2' });
        await pluginInstance.generateBundle();
        await pluginInstance.renderStart({ dir: '/dist2' });
        expect(fs.rm).toBeCalledTimes(1);
        expect(fs.rm).toHaveBeenCalledWith('/dist2', { recursive: true });
    });

    it('should delete once with outputPlugin false and targets as string', async () => {
        const pluginInstance = plugin({ deleteOnce: true, outputPlugin: false, targets: '/dist2' });
        await pluginInstance.buildStart();
        await pluginInstance.renderStart();
        await pluginInstance.generateBundle();
        await pluginInstance.buildStart();
        await pluginInstance.renderStart();
        expect(fs.rm).toBeCalledTimes(1);
        expect(fs.rm).toHaveBeenCalledWith('/dist2', { recursive: true });
    });

    it('should delete once with outputPlugin false and targets as array', async () => {
        const pluginInstance = plugin({ deleteOnce: true, outputPlugin: false, targets: ['/dist2'] });
        await pluginInstance.buildStart();
        await pluginInstance.renderStart();
        await pluginInstance.generateBundle();
        await pluginInstance.buildStart();
        await pluginInstance.renderStart();
        expect(fs.rm).toBeCalledTimes(1);
        expect(fs.rm).toHaveBeenCalledWith('/dist2', { recursive: true });
    });

    it('should use custom plugin name', async () => {
        const pluginName = 'test-plugin';
        const pluginInstance = plugin({ pluginName });
        await pluginInstance.renderStart({ dir: '/dist2' });
        expect(createLogger).toHaveBeenCalledWith(pluginName);
    });

    it('should use verbose log level by default', async () => {
        const pluginInstance = plugin();
        await pluginInstance.renderStart({ dir: '/dist2' });
        expect(loggerStart).toHaveBeenCalledWith("cleaning '/dist2'", LogLevel.verbose);
        expect(loggerFinish).toHaveBeenCalledWith("cleaned '/dist2'");
    });

    it('should use info log level when verbose is true', async () => {
        const pluginInstance = plugin({ verbose: true });
        await pluginInstance.renderStart({ dir: '/dist2' });
        expect(loggerStart).toHaveBeenCalledWith("cleaning '/dist2'", LogLevel.info);
        expect(loggerFinish).toHaveBeenCalledWith("cleaned '/dist2'");
    });

    it('should log warning on exception', async () => {
        vi.mocked(fs.rm).mockImplementationOnce(() => {
            throw { stack: '' };
        });
        const pluginInstance = plugin({ verbose: true });
        await pluginInstance.renderStart({ dir: 'dist2' });
        expect(loggerFinish).toHaveBeenCalledWith("failed cleaning 'dist2'", LogLevel.warn, expect.objectContaining({ stack: '' }));
    });

    it('should log silently on missing directory exception', async () => {
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

    it('should clean on buildStart when outputPlugin is false', async () => {
        const pluginInstance = plugin({ targets: 'dist2', outputPlugin: false });
        await pluginInstance.buildStart();
        expect(fs.rm).toBeCalledTimes(1);
        expect(fs.rm).toHaveBeenCalledWith('dist2', { recursive: true });
    });

    it('should not clean when outputPlugin is false and no dir in options', async () => {
        const pluginInstance = plugin({ outputPlugin: false });
        await pluginInstance.options({});
        await pluginInstance.buildStart();
        expect(fs.rm).toBeCalledTimes(0);
    });

    it('should not clean when outputPlugin is false and empty output options', async () => {
        const pluginInstance = plugin({ outputPlugin: false });
        await pluginInstance.options({ output: {} });
        await pluginInstance.buildStart();
        expect(fs.rm).toBeCalledTimes(0);
    });

    it('should clean dir from options when outputPlugin is false', async () => {
        const pluginInstance = plugin({ outputPlugin: false });
        await pluginInstance.options({ output: { dir: 'dist2' } });
        await pluginInstance.buildStart();
        expect(fs.rm).toBeCalledTimes(1);
        expect(fs.rm).toHaveBeenCalledWith('dist2', { recursive: true });
    });

    it('should clean dir from output array when outputPlugin is false', async () => {
        const pluginInstance = plugin({ outputPlugin: false });
        await pluginInstance.options({ output: [{ dir: 'dist2' }] });
        await pluginInstance.buildStart();
        expect(fs.rm).toBeCalledTimes(1);
        expect(fs.rm).toHaveBeenCalledWith('dist2', { recursive: true });
    });
});
