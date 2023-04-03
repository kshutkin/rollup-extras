import { createServer } from 'http';
import { createServer as createHttpsServer } from 'https';

import 'koa';
import koaLogger from 'koa-logger';
import serveStatic from 'koa-static';

import { createLogger, LogLevel } from '@niceties/logger';
import plugin from '../src';

let listenArgs: any[], errorCb: (error: unknown) => void;

jest.mock('http', () => ({
    createServer: jest.fn(() => ({
        listen(...args: any[]) { listenArgs = args.slice(); args.pop()(this); },
        on(_event: string, cb: (error: unknown) => void) { errorCb = cb; },
        address() {
            return {
                address: '::',
                port: 8080,
                family: 'IPv6'
            };
        },
        close(cb: () => void) { cb(); }
    }))
}));
jest.mock('https', () => ({
    createServer: jest.fn(() => ({
        listen(...args: any[]) { listenArgs = args.slice(); args.pop()(this); },
        on(_event: string, cb: (error: unknown) => void) { errorCb = cb; },
        address() {
            return {
                address: '::',
                port: 8080,
                family: 'IPv6'
            };
        },
        close(cb: () => void) { cb(); }
    }))
}));
jest.mock('koa', () => class {
    callback() { /**/ }
    use() { /**/ }
});
jest.mock('koa-logger');
jest.mock('koa-static');

let loggerFinish: jest.Mock;

jest.mock('@niceties/logger', () => ({
    createLogger: jest.fn(() => Object.assign((jest.fn()), {
        finish: (loggerFinish = jest.fn())
    }))
}));

describe('@rollup-extras/plugin-serve', () => {


    beforeEach(() => {
        (createLogger as jest.Mock<ReturnType<typeof createLogger>, Parameters<typeof createLogger>>).mockClear();
        (createServer as jest.Mock<ReturnType<typeof createServer>, Parameters<typeof createServer>>).mockClear();
        (koaLogger as jest.Mock<ReturnType<typeof koaLogger>, Parameters<typeof koaLogger>>).mockClear();
    });

    it('smoke', () => {
        expect(plugin).toBeDefined();
    });

    it('pluginName (default)', () => {
        const pluginInstance = plugin();
        expect((pluginInstance as any).name).toEqual('@rollup-extras/plugin-serve');
        expect(createLogger).toBeCalledWith('@rollup-extras/plugin-serve');
    });

    it('pluginName (changed)', () => {
        const pluginInstance = plugin({ pluginName: 'test' });
        expect((pluginInstance as any).name).toEqual('test');
        expect(createLogger).toBeCalledWith('test');
    });

    it('useWriteBundle: true', () => {
        const pluginInstance = plugin({ useWriteBundle: true });
        expect((pluginInstance as any).writeBundle).toBeDefined();
    });

    it('happy path', async () => {
        const pluginInstance = plugin();
        await (pluginInstance as any).outputOptions.call({ meta: { watchMode: true } });
        await (pluginInstance as any).renderStart({ dir: 'dist' });
        await (pluginInstance as any).writeBundle();

        expect(createServer).toBeCalledTimes(1);
        expect(createHttpsServer).not.toBeCalled();
        expect(koaLogger).toBeCalled();
        expect(serveStatic).toBeCalledWith('dist', undefined);
        expect(loggerFinish).toBeCalledWith('listening on http://[::]:8080', LogLevel.info);
    });

    it('happy path (two configs)', async () => {
        const pluginInstance = plugin();
        const additionalInstance = (pluginInstance as any).api.addInstance();
        await (pluginInstance as any).outputOptions.call({ meta: { watchMode: true } });
        await (pluginInstance as any).renderStart({ dir: 'dist' });
        await (additionalInstance as any).renderStart({ dir: 'dist' });
        await (pluginInstance as any).writeBundle();
        await (additionalInstance as any).writeBundle();

        expect(createServer).toBeCalledTimes(1);
        expect(createHttpsServer).not.toBeCalled();
        expect(koaLogger).toBeCalled();
        expect(serveStatic).toBeCalledWith('dist', undefined);
        expect(loggerFinish).toBeCalledWith('listening on http://[::]:8080', LogLevel.info);
    });

    it('useKoaLogger: false', async () => {
        const pluginInstance = plugin({ useKoaLogger: false });
        await (pluginInstance as any).outputOptions.call({ meta: { watchMode: true } });
        await (pluginInstance as any).renderStart({ dir: 'dist' });
        await (pluginInstance as any).writeBundle();

        expect(createServer).toBeCalledTimes(1);
        expect(createHttpsServer).not.toBeCalled();
        expect(koaLogger).not.toBeCalled();
        expect(serveStatic).toBeCalledWith('dist', undefined);
        expect(loggerFinish).toBeCalledWith('listening on http://[::]:8080', LogLevel.info);
    });

    it('customizeKoa', async () => {
        const customizeKoa = jest.fn();
        const pluginInstance = plugin({
            customizeKoa
        });
        await (pluginInstance as any).renderStart({ dir: 'dist' });
        await (pluginInstance as any).writeBundle();

        expect(customizeKoa).toBeCalledTimes(1);
    });

    it('https', async () => {
        const pluginInstance = plugin({
            https: {
                cert: '',
                key: ''
            }
        });
        await (pluginInstance as any).renderStart({ dir: 'dist' });
        await (pluginInstance as any).writeBundle();

        expect(createHttpsServer).toBeCalledTimes(1);
        expect(loggerFinish).toBeCalledWith('listening on https://[::]:8080', LogLevel.info);
    });

    it('host', async () => {
        const pluginInstance = plugin({
            host: 'localhost'
        });
        await (pluginInstance as any).renderStart({ dir: 'dist' });
        await (pluginInstance as any).writeBundle();

        expect(createServer).toBeCalledTimes(1);
        expect(listenArgs).toEqual([8080, 'localhost', expect.any(Function)]);
    });

    it('port', async () => {
        const pluginInstance = plugin({
            port: 1234
        });
        await (pluginInstance as any).renderStart({ dir: 'dist' });
        await (pluginInstance as any).writeBundle();

        expect(createServer).toBeCalledTimes(1);
        expect(listenArgs).toEqual([1234, expect.any(Function)]);
    });

    it('error (EADDRINUSE)', async () => {
        const pluginInstance = plugin();
        await (pluginInstance as any).renderStart({ dir: 'dist' });
        await (pluginInstance as any).writeBundle();
        errorCb({ code: 'EADDRINUSE' });

        expect(loggerFinish).toBeCalledWith('address in use, please try another port', LogLevel.error);
    });

    it('error (not EADDRINUSE)', async () => {
        const pluginInstance = plugin();
        await (pluginInstance as any).renderStart({ dir: 'dist' });
        await (pluginInstance as any).writeBundle();

        expect(() => errorCb({})).toThrow();
    });

    it('onListen => falthy', async () => {
        const onListen = jest.fn();
        const pluginInstance = plugin({
            onListen
        });
        await (pluginInstance as any).renderStart({ dir: 'dist' });
        await (pluginInstance as any).writeBundle();

        expect(onListen).toHaveBeenCalledTimes(1);
        expect(onListen).toHaveBeenCalledWith(expect.objectContaining({
            address: expect.any(Function),
            close: expect.any(Function),
            listen: expect.any(Function),
            on: expect.any(Function)
        }));
        expect(loggerFinish).toBeCalledWith('listening on http://[::]:8080', LogLevel.info);
    });

    it('onListen => truthy', async () => {
        const onListen: () => true = jest.fn(() => true);
        const pluginInstance = plugin({
            onListen
        });
        await (pluginInstance as any).renderStart({ dir: 'dist' });
        await (pluginInstance as any).writeBundle();

        expect(onListen).toHaveBeenCalledTimes(1);
        expect(onListen).toHaveBeenCalledWith(expect.objectContaining({
            address: expect.any(Function),
            close: expect.any(Function),
            listen: expect.any(Function),
            on: expect.any(Function)
        }));
        expect(loggerFinish).not.toBeCalled();
    });

    it('address() => string', async () => {
        (createServer as jest.Mock<ReturnType<typeof createServer>, Parameters<typeof createServer>>).mockImplementationOnce(() => ({
            listen(...args: any[]) { listenArgs = args.slice(); args.pop()(this); },
            on(_event: string, cb: (error: unknown) => void) { errorCb = cb; },
            address() {
                return 'some address';
            },
            close(cb: () => void) { cb(); }
        }) as ReturnType<typeof createServer>);
        
        const pluginInstance = plugin();
        await (pluginInstance as any).renderStart({ dir: 'dist' });
        await (pluginInstance as any).writeBundle();

        expect(loggerFinish).toBeCalledWith('listening on some address', LogLevel.info);
    });

    it('non IPv6 address', async () => {
        (createServer as jest.Mock<ReturnType<typeof createServer>, Parameters<typeof createServer>>).mockImplementationOnce(() => ({
            listen(...args: any[]) { listenArgs = args.slice(); args.pop()(this); },
            on(_event: string, cb: (error: unknown) => void) { errorCb = cb; },
            address() {
                return {
                    address: '127.0.0.1',
                    port: 8080,
                    family: 'IPv4'
                };
            },
            close(cb: () => void) { cb(); }
        }) as ReturnType<typeof createServer>);
        
        const pluginInstance = plugin();
        await (pluginInstance as any).renderStart({ dir: 'dist' });
        await (pluginInstance as any).writeBundle();

        expect(loggerFinish).toBeCalledWith('listening on http://127.0.0.1:8080', LogLevel.info);
    });

});
