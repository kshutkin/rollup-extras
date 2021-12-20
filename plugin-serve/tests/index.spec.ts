import { createLogger } from '@niceties/logger';
import { PluginContext } from 'rollup';
import plugin from '../src';

let loggerStart: jest.Mock, loggerFinish: jest.Mock, logger: jest.Mock;

jest.mock('@niceties/logger', () => ({
    createLogger: jest.fn(() => Object.assign((logger =jest.fn()), {
        start: (loggerStart = jest.fn()),
        finish: (loggerFinish = jest.fn())
    }))
}));

describe('@rollup-extras/plugin-html', () => {

    let rollupContextMock: Partial<PluginContext>;

    beforeEach(() => {
        (createLogger as jest.Mock<ReturnType<typeof createLogger>, Parameters<typeof createLogger>>).mockClear();
        rollupContextMock = {
            emitFile: jest.fn(),
            addWatchFile: jest.fn()
        };
    });

    it('smoke', () => {
        expect(plugin).toBeDefined();
        // temp
        expect(logger).toBeDefined();
        expect(loggerStart).toBeDefined();
        expect(loggerFinish).toBeDefined();
        expect(rollupContextMock).toBeDefined();
    });

    it('pluginName (default)', () => {
        const pluginInstance = plugin();
        expect((pluginInstance as {name: string}).name).toEqual('@rollup-extras/plugin-serve');
        expect(createLogger).toBeCalledWith('@rollup-extras/plugin-serve');
    });

    it('pluginName (changed)', () => {
        const pluginInstance = plugin({ pluginName: 'test' });
        expect((pluginInstance as {name: string}).name).toEqual('test');
        expect(createLogger).toBeCalledWith('test');
    });

});
