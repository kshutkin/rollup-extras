import { multiConfigPluginBase as plugin } from '../src';

describe('@rollup-extras/util/mutli-config-plugin-base', () => {

    it('smoke', () => {
        expect(plugin).toBeDefined();
    });

    it('single instance, generateBundle', async () => {
        const execute = jest.fn();
        const pluginInstance = plugin(false, 'test', execute);
        await (pluginInstance as any).renderStart();
        await (pluginInstance as any).generateBundle(1, 2);
        expect(execute).toBeCalledTimes(1);
        expect(execute).toBeCalledWith(1, 2);
    });

    it('additional instance, generateBundle', async () => {
        const execute = jest.fn();
        const pluginInstance = plugin(false, 'test', execute);
        const additionalInstance = (pluginInstance as any).api.addInstance();
        await (pluginInstance as any).renderStart();
        await (additionalInstance as any).renderStart();
        await (pluginInstance as any).generateBundle();
        await (additionalInstance as any).generateBundle(1, 2);
        expect(execute).toBeCalledTimes(1);
        expect(execute).toBeCalledWith(1, 2);
    });

    it('single instance, writeBundle', async () => {
        const execute = jest.fn();
        const pluginInstance = plugin(true, 'test', execute);
        await (pluginInstance as any).renderStart();
        await (pluginInstance as any).writeBundle(1, 2);
        expect(execute).toBeCalledTimes(1);
        expect(execute).toBeCalledWith(1, 2);
    });

    it('additional instance, writeBundle', async () => {
        const execute = jest.fn();
        const pluginInstance = plugin(true, 'test', execute);
        const additionalInstance = (pluginInstance as any).api.addInstance();
        await (pluginInstance as any).renderStart();
        await (additionalInstance as any).renderStart();
        await (pluginInstance as any).writeBundle();
        await (additionalInstance as any).writeBundle(1, 2);
        expect(execute).toBeCalledTimes(1);
        expect(execute).toBeCalledWith(1, 2);
    });

    it('exception (apssed to rollup)', async () => {
        const execute = jest.fn(() => { throw new Error('test'); });
        const pluginInstance = plugin(true, 'test', execute);
        await (pluginInstance as any).renderStart();
        let exception;
        try {
            await (pluginInstance as any).writeBundle(1, 2);
        } catch(e) {
            exception = e;
        }
        expect(exception).toBeDefined();
        expect(execute).toBeCalledWith(1, 2);
    });

    it('recovery after exception', async () => {
        const execute = jest.fn(() => { throw new Error('test'); });
        const pluginInstance = plugin(true, 'test', execute);
        await (pluginInstance as any).renderStart();
        try {
            await (pluginInstance as any).writeBundle(1, 2);
        } catch(e) {
            // suppress
        }
        await (pluginInstance as any).renderStart();
        try {
            await (pluginInstance as any).writeBundle(1, 2);
        } catch(e) {
            // suppress
        }
        expect(execute).toBeCalledWith(1, 2);
        expect(execute).toBeCalledTimes(2);
    });
});

