import { createLogger } from '@niceties/logger';
import plugin from '../src';

let loggerFinish: jest.Mock, logger: jest.Mock;

jest.mock('@niceties/logger', () => ({
    createLogger: jest.fn(() => Object.assign((logger = jest.fn()), {
        finish: (loggerFinish = jest.fn())
    }))
}));

describe('@rollup-extras/plugin-exec', () => {

    it('smoke', () => {
        expect(plugin).toBeDefined();
    });

    it('pluginName (default)', () => {
        const pluginInstance = plugin(() => undefined);
        expect((pluginInstance as any).name).toEqual('@rollup-extras/plugin-exec');
        expect(createLogger).toHaveBeenCalledWith('@rollup-extras/plugin-exec');
    });

    it('pluginName (changed)', () => {
        const pluginInstance = plugin({ pluginName: 'test' });
        expect((pluginInstance as any).name).toEqual('test');
        expect(createLogger).toHaveBeenCalledWith('test');
    });

    it('exec', async () => {
        const exec = jest.fn();
        const pluginInstance = plugin(exec);
        await (pluginInstance as any).renderStart({ dir: 'dist' });
        await (pluginInstance as any).writeBundle();
        expect(exec).toHaveBeenCalled();
    });

    it('exec empty', async () => {
        const pluginInstance = plugin(undefined as any);
        await (pluginInstance as any).renderStart({ dir: 'dist' });
        expect(() => {
            (pluginInstance as any).writeBundle();
        }).not.toThrow();
    });

    it('exec context', async () => {
        const exec = jest.fn(function() {
            this.emitFile({});
            this.logger('test');
        });
        const emitFile = jest.fn();
        const pluginInstance = plugin(exec);
        await (pluginInstance as any).renderStart({ dir: 'dist' });
        await (pluginInstance as any).writeBundle.apply({
            emitFile
        });
        expect(logger).toHaveBeenCalled();
        expect(emitFile).toHaveBeenCalled();
    });
});
