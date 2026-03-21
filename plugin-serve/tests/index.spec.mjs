import { createServer } from 'node:http';
import { createServer as createHttpsServer } from 'node:https';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import 'koa';

import koaLogger from 'koa-logger';
import serveStatic from 'koa-static';

import { createLogger, LogLevel } from '@niceties/logger';

import plugin from '../src';

let listenArgs, errorCb;

vi.mock('http', () => ({
    createServer: vi.fn(() => ({
        listen(...args) {
            listenArgs = args.slice();
            args.pop()(this);
        },
        on(_event, cb) {
            errorCb = cb;
        },
        address() {
            return {
                address: '::',
                port: 8080,
                family: 'IPv6',
            };
        },
        close(cb) {
            cb();
        },
    })),
}));
vi.mock('https', () => ({
    createServer: vi.fn(() => ({
        listen(...args) {
            listenArgs = args.slice();
            args.pop()(this);
        },
        on(_event, cb) {
            errorCb = cb;
        },
        address() {
            return {
                address: '::',
                port: 8080,
                family: 'IPv6',
            };
        },
        close(cb) {
            cb();
        },
    })),
}));
vi.mock('koa', () => ({
    default: class {
        callback() {
            /**/
        }
        use() {
            /**/
        }
    },
}));
vi.mock('koa-logger');
vi.mock('koa-static');

let loggerFinish;

vi.mock('@niceties/logger', () => ({
    LogLevel: { verbose: 0, info: 1, warn: 2, error: 3 },
    createLogger: vi.fn(() => {
        loggerFinish = vi.fn();
        return Object.assign(vi.fn(), {
            finish: loggerFinish,
        });
    }),
}));

describe('@rollup-extras/plugin-serve', () => {
    beforeEach(() => {
        vi.mocked(createLogger).mockClear();
        vi.mocked(createServer).mockClear();
        vi.mocked(koaLogger).mockClear();
    });

    it('should be defined', () => {
        expect(plugin).toBeDefined();
    });

    it('should use default plugin name', () => {
        const pluginInstance = plugin();
        expect(pluginInstance.name).toEqual('@rollup-extras/plugin-serve');
        expect(createLogger).toHaveBeenCalledWith('@rollup-extras/plugin-serve');
    });

    it('should use changed plugin name', () => {
        const pluginInstance = plugin({ pluginName: 'test' });
        expect(pluginInstance.name).toEqual('test');
        expect(createLogger).toHaveBeenCalledWith('test');
    });

    it('should define writeBundle when useWriteBundle is true', () => {
        const pluginInstance = plugin({ useWriteBundle: true });
        expect(pluginInstance.writeBundle).toBeDefined();
    });

    it('should start server and serve static files', async () => {
        const pluginInstance = plugin();
        await pluginInstance.outputOptions.call({ meta: { watchMode: true } });
        await pluginInstance.renderStart({ dir: 'dist' });
        await pluginInstance.writeBundle();

        expect(createServer).toBeCalledTimes(1);
        expect(createHttpsServer).not.toBeCalled();
        expect(koaLogger).toBeCalled();
        expect(serveStatic).toHaveBeenCalledWith('dist', undefined);
        expect(loggerFinish).toHaveBeenCalledWith('listening on http://localhost:8080', LogLevel.info);
    });

    it('should start server once for two configs', async () => {
        const pluginInstance = plugin();
        const additionalInstance = pluginInstance.api.addInstance();
        await pluginInstance.outputOptions.call({ meta: { watchMode: true } });
        await pluginInstance.renderStart({ dir: 'dist' });
        await additionalInstance.renderStart({ dir: 'dist' });
        await pluginInstance.writeBundle();
        await additionalInstance.writeBundle();

        expect(createServer).toBeCalledTimes(1);
        expect(createHttpsServer).not.toBeCalled();
        expect(koaLogger).toBeCalled();
        expect(serveStatic).toHaveBeenCalledWith('dist', undefined);
        expect(loggerFinish).toHaveBeenCalledWith('listening on http://localhost:8080', LogLevel.info);
    });

    it('should not use koa logger when disabled', async () => {
        const pluginInstance = plugin({ useKoaLogger: false });
        await pluginInstance.outputOptions.call({ meta: { watchMode: true } });
        await pluginInstance.renderStart({ dir: 'dist' });
        await pluginInstance.writeBundle();

        expect(createServer).toBeCalledTimes(1);
        expect(createHttpsServer).not.toBeCalled();
        expect(koaLogger).not.toBeCalled();
        expect(serveStatic).toHaveBeenCalledWith('dist', undefined);
        expect(loggerFinish).toHaveBeenCalledWith('listening on http://localhost:8080', LogLevel.info);
    });

    it('should call customizeKoa callback', async () => {
        const customizeKoa = vi.fn();
        const pluginInstance = plugin({
            customizeKoa,
        });
        await pluginInstance.renderStart({ dir: 'dist' });
        await pluginInstance.writeBundle();

        expect(customizeKoa).toBeCalledTimes(1);
    });

    it('should create HTTPS server when https options provided', async () => {
        const pluginInstance = plugin({
            https: {
                cert: '',
                key: '',
            },
        });
        await pluginInstance.renderStart({ dir: 'dist' });
        await pluginInstance.writeBundle();

        expect(createHttpsServer).toBeCalledTimes(1);
        expect(loggerFinish).toHaveBeenCalledWith('listening on https://localhost:8080', LogLevel.info);
    });

    it('should pass host to listen', async () => {
        const pluginInstance = plugin({
            host: 'localhost',
        });
        await pluginInstance.renderStart({ dir: 'dist' });
        await pluginInstance.writeBundle();

        expect(createServer).toBeCalledTimes(1);
        expect(listenArgs).toEqual([8080, 'localhost', expect.any(Function)]);
    });

    it('should pass port to listen', async () => {
        const pluginInstance = plugin({
            port: 1234,
        });
        await pluginInstance.renderStart({ dir: 'dist' });
        await pluginInstance.writeBundle();

        expect(createServer).toBeCalledTimes(1);
        expect(listenArgs).toEqual([1234, expect.any(Function)]);
    });

    it('should log error on EADDRINUSE', async () => {
        const pluginInstance = plugin();
        await pluginInstance.renderStart({ dir: 'dist' });
        await pluginInstance.writeBundle();
        errorCb({ code: 'EADDRINUSE' });

        expect(loggerFinish).toHaveBeenCalledWith('address in use, please try another port', LogLevel.error);
    });

    it('should throw on non-EADDRINUSE error', async () => {
        const pluginInstance = plugin();
        await pluginInstance.renderStart({ dir: 'dist' });
        await pluginInstance.writeBundle();

        expect(() => errorCb({})).toThrow();
    });

    it('should log address when onListen returns falsy', async () => {
        const onListen = vi.fn();
        const pluginInstance = plugin({
            onListen,
        });
        await pluginInstance.renderStart({ dir: 'dist' });
        await pluginInstance.writeBundle();

        expect(onListen).toHaveBeenCalledTimes(1);
        expect(onListen).toHaveBeenCalledWith(
            expect.objectContaining({
                address: expect.any(Function),
                close: expect.any(Function),
                listen: expect.any(Function),
                on: expect.any(Function),
            })
        );
        expect(loggerFinish).toHaveBeenCalledWith('listening on http://localhost:8080', LogLevel.info);
    });

    it('should not log address when onListen returns truthy', async () => {
        const onListen = vi.fn(() => true);
        const pluginInstance = plugin({
            onListen,
        });
        await pluginInstance.renderStart({ dir: 'dist' });
        await pluginInstance.writeBundle();

        expect(onListen).toHaveBeenCalledTimes(1);
        expect(onListen).toHaveBeenCalledWith(
            expect.objectContaining({
                address: expect.any(Function),
                close: expect.any(Function),
                listen: expect.any(Function),
                on: expect.any(Function),
            })
        );
        expect(loggerFinish).not.toBeCalled();
    });

    it('should handle string address from server', async () => {
        vi.mocked(createServer).mockImplementationOnce(() => ({
            listen(...args) {
                listenArgs = args.slice();
                args.pop()(this);
            },
            on(_event, cb) {
                errorCb = cb;
            },
            address() {
                return 'some address';
            },
            close(cb) {
                cb();
            },
        }));

        const pluginInstance = plugin();
        await pluginInstance.renderStart({ dir: 'dist' });
        await pluginInstance.writeBundle();

        expect(loggerFinish).toHaveBeenCalledWith('listening on some address', LogLevel.info);
    });

    it('should handle non-IPv6 address', async () => {
        vi.mocked(createServer).mockImplementationOnce(() => ({
            listen(...args) {
                listenArgs = args.slice();
                args.pop()(this);
            },
            on(_event, cb) {
                errorCb = cb;
            },
            address() {
                return {
                    address: '127.0.0.1',
                    port: 8080,
                    family: 'IPv4',
                };
            },
            close(cb) {
                cb();
            },
        }));

        const pluginInstance = plugin();
        await pluginInstance.renderStart({ dir: 'dist' });
        await pluginInstance.writeBundle();

        expect(loggerFinish).toHaveBeenCalledWith('listening on http://127.0.0.1:8080', LogLevel.info);
    });
});
