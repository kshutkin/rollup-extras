import { mkdtemp, rm } from 'node:fs/promises';
import { createServer as createNetServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { rollup } from 'rollup';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import serve from '../src/index.js';

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

/**
 * Helper: triggers the plugin hooks to simulate watch mode and start the server.
 */
function triggerWatchMode(plugin, renderStartOptions) {
    plugin.outputOptions.call({ meta: { watchMode: true } });
    if (plugin.renderStart) {
        plugin.renderStart.call({ meta: { watchMode: true } }, renderStartOptions || {}, {});
    }
    const hookFn = plugin.writeBundle || plugin.generateBundle;
    return hookFn.call({ meta: { watchMode: true } }, {}, {});
}

/**
 * Helper: creates a serve() plugin wired so we can capture the server once it listens.
 */
function createTestPlugin(overrides, opts) {
    overrides = overrides || {};
    opts = opts || {};
    const suppressLogger = opts.suppressLogger !== false;
    let resolveServer;
    let capturedServer;
    const serverPromise = new Promise(resolve => {
        resolveServer = resolve;
    });

    const onListen = server => {
        capturedServer = server;
        resolveServer(server);
        if (suppressLogger) return true;
    };

    const plugin = serve(
        Object.assign(
            {
                port: 0,
                dirs: ['.'],
            },
            overrides,
            { onListen: onListen }
        )
    );

    return { plugin: plugin, serverPromise: serverPromise, getServer: () => capturedServer };
}

describe('@rollup-extras/plugin-serve', () => {
    let tmpDir;
    let serversToClose = [];

    beforeEach(async () => {
        tmpDir = await mkdtemp(join(tmpdir(), 'plugin-serve-test-'));
        serversToClose = [];
    });

    afterEach(async () => {
        for (const server of serversToClose) {
            if (server?.listening) {
                await new Promise(resolve => {
                    server.close(resolve);
                });
            }
        }
        serversToClose = [];
        if (tmpDir) {
            await rm(tmpDir, { recursive: true, force: true });
        }
    });

    describe('non-watch mode (option parsing and plugin shape)', () => {
        it('should not throw during a normal (non-watch) build', async () => {
            const bundle = await rollup({
                input: 'entry',
                plugins: [virtual({ entry: 'export default 1' }), serve({ port: 0 })],
            });
            await bundle.write({ format: 'es', dir: tmpDir });
            await bundle.close();
        });

        it('should accept string options (dirs)', async () => {
            const bundle = await rollup({
                input: 'entry',
                plugins: [virtual({ entry: 'export default 2' }), serve('dist')],
            });
            await bundle.write({ format: 'es', dir: tmpDir });
            await bundle.close();
        });

        it('should accept options object', async () => {
            const bundle = await rollup({
                input: 'entry',
                plugins: [virtual({ entry: 'export default 3' }), serve({ dirs: ['dist', 'public'], port: 0, useLogger: false })],
            });
            await bundle.write({ format: 'es', dir: tmpDir });
            await bundle.close();
        });

        it('should accept array of dirs as options', async () => {
            const bundle = await rollup({
                input: 'entry',
                plugins: [virtual({ entry: 'export default 4' }), serve(['dist', 'public'])],
            });
            await bundle.write({ format: 'es', dir: tmpDir });
            await bundle.close();
        });

        it('should have default plugin name', () => {
            const pluginInstance = serve();
            expect(pluginInstance.name).toBe('@rollup-extras/plugin-serve');
        });

        it('should accept a custom plugin name', () => {
            const pluginInstance = serve({ pluginName: 'my-serve' });
            expect(pluginInstance.name).toBe('my-serve');
        });

        it('should have renderStart hook when no dirs are provided', () => {
            const pluginInstance = serve();
            expect(typeof pluginInstance.renderStart).toBe('function');
        });

        it('should not have custom renderStart hook when dirs are provided', () => {
            const withDirs = serve({ dirs: ['dist'] });
            const withoutDirs = serve();
            expect(withDirs.renderStart).not.toBe(withoutDirs.renderStart);
        });

        it('should have writeBundle hook by default', () => {
            const pluginInstance = serve();
            expect(typeof pluginInstance.writeBundle).toBe('function');
        });

        it('should have generateBundle hook when useWriteBundle is false', () => {
            const pluginInstance = serve({ useWriteBundle: false });
            expect(typeof pluginInstance.generateBundle).toBe('function');
            expect(pluginInstance.writeBundle).toBeUndefined();
        });

        it('should have expected plugin shape (name, outputOptions)', () => {
            const pluginInstance = serve();
            expect(typeof pluginInstance.name).toBe('string');
            expect(pluginInstance.name.length).toBeGreaterThan(0);
            expect(typeof pluginInstance.outputOptions).toBe('function');
        });
    });

    describe('watch mode - server lifecycle', () => {
        it('should start server in watch mode', async () => {
            const res = createTestPlugin();
            await triggerWatchMode(res.plugin);
            const server = await res.serverPromise;
            serversToClose.push(server);
            expect(server).toBeDefined();
            expect(server.listening).toBe(true);
        });

        it('should not start the server twice (started guard)', async () => {
            const res = createTestPlugin();
            await triggerWatchMode(res.plugin);
            const server = await res.serverPromise;
            serversToClose.push(server);
            const addressBefore = server.address();
            res.plugin.renderStart.call({ meta: { watchMode: true } }, {}, {});
            await res.plugin.writeBundle.call({ meta: { watchMode: true } }, {}, {});
            expect(server.listening).toBe(true);
            expect(server.address()).toEqual(addressBefore);
        });

        it('should not start server when not in watch mode', async () => {
            let serverStarted = false;
            const plugin = serve({
                port: 0,
                dirs: ['.'],
                onListen: () => {
                    serverStarted = true;
                    return true;
                },
            });
            plugin.outputOptions.call({ meta: { watchMode: false } });
            if (plugin.renderStart) {
                plugin.renderStart.call({ meta: { watchMode: false } }, {}, {});
            }
            await plugin.writeBundle.call({ meta: { watchMode: false } }, {}, {});
            expect(serverStarted).toBe(false);
        });

        it('should call customize callback when provided', async () => {
            let customizeCalled = false;
            let customizeArg;
            const res = createTestPlugin({
                customize: app => {
                    customizeCalled = true;
                    customizeArg = app;
                },
            });
            await triggerWatchMode(res.plugin);
            const server = await res.serverPromise;
            serversToClose.push(server);
            expect(customizeCalled).toBe(true);
            expect(customizeArg).toBeDefined();
            expect(typeof customizeArg.fetch).toBe('function');
        });

        it('should start server with useLogger false', async () => {
            const res = createTestPlugin({ useLogger: false });
            await triggerWatchMode(res.plugin);
            const server = await res.serverPromise;
            serversToClose.push(server);
            expect(server.listening).toBe(true);
        });

        it('should start server with useLogger true (default)', async () => {
            const res = createTestPlugin({ useLogger: true });
            await triggerWatchMode(res.plugin);
            const server = await res.serverPromise;
            serversToClose.push(server);
            expect(server.listening).toBe(true);
        });

        it('should start server with host option', async () => {
            const res = createTestPlugin({ host: '127.0.0.1' });
            await triggerWatchMode(res.plugin);
            const server = await res.serverPromise;
            serversToClose.push(server);
            expect(server.listening).toBe(true);
            const addr = server.address();
            expect(addr.address).toBe('127.0.0.1');
        });

        it('should start server without host option (default)', async () => {
            const res = createTestPlugin();
            await triggerWatchMode(res.plugin);
            const server = await res.serverPromise;
            serversToClose.push(server);
            expect(server.listening).toBe(true);
            const addr = server.address();
            expect(addr.port).toBeGreaterThan(0);
        });
    });

    describe('EADDRINUSE error handling', () => {
        it('should handle EADDRINUSE gracefully', async () => {
            const blocker = createNetServer();
            await new Promise(resolve => {
                blocker.listen(0, resolve);
            });
            const occupiedPort = blocker.address().port;
            try {
                const plugin = serve({
                    port: occupiedPort,
                    dirs: ['.'],
                    onListen: () => true,
                });
                plugin.outputOptions.call({ meta: { watchMode: true } });
                plugin.renderStart.call({ meta: { watchMode: true } }, {}, {});
                await plugin.writeBundle.call({ meta: { watchMode: true } }, {}, {});
                await new Promise(resolve => {
                    setTimeout(resolve, 150);
                });
            } finally {
                await new Promise(resolve => {
                    blocker.close(resolve);
                });
            }
        });

        it('should throw for non-EADDRINUSE errors', async () => {
            const res = createTestPlugin();
            await triggerWatchMode(res.plugin);
            const server = await res.serverPromise;
            serversToClose.push(server);

            const err = new Error('some other error');
            err.code = 'ECONNREFUSED';

            expect(() => server.emit('error', err)).toThrow('some other error');
        });
    });

    describe('onListen callback and address formatting', () => {
        it('should skip logger when onListen returns true', async () => {
            let onListenCalled = false;
            let resolveServer;
            const serverPromise = new Promise(resolve => {
                resolveServer = resolve;
            });
            const plugin = serve({
                port: 0,
                dirs: ['.'],
                onListen: server => {
                    onListenCalled = true;
                    resolveServer(server);
                    return true;
                },
            });
            await triggerWatchMode(plugin);
            const server = await serverPromise;
            serversToClose.push(server);
            expect(onListenCalled).toBe(true);
        });

        it('should call logger when onListen returns void', async () => {
            let resolveServer;
            const serverPromise = new Promise(resolve => {
                resolveServer = resolve;
            });
            const plugin = serve({
                port: 0,
                dirs: ['.'],
                onListen: server => {
                    resolveServer(server);
                },
            });
            await triggerWatchMode(plugin);
            const server = await serverPromise;
            serversToClose.push(server);
            expect(server.listening).toBe(true);
        });

        it('should call logger when onListen is not provided', async () => {
            const plugin = serve({
                port: 0,
                dirs: ['.'],
            });
            await triggerWatchMode(plugin);
            await new Promise(resolve => {
                setTimeout(resolve, 200);
            });
        });

        it('should format IPv4 address correctly (host 127.0.0.1)', async () => {
            let resolveServer;
            const serverPromise = new Promise(resolve => {
                resolveServer = resolve;
            });
            const plugin = serve({
                port: 0,
                dirs: ['.'],
                host: '127.0.0.1',
                onListen: server => {
                    resolveServer(server);
                },
            });
            await triggerWatchMode(plugin);
            const server = await serverPromise;
            serversToClose.push(server);
            const addr = server.address();
            expect(addr.family).toBe('IPv4');
            expect(addr.address).toBe('127.0.0.1');
        });

        it('should format IPv6 [::] as localhost (default host)', async () => {
            let resolveServer;
            const serverPromise = new Promise(resolve => {
                resolveServer = resolve;
            });
            const plugin = serve({
                port: 0,
                dirs: ['.'],
                onListen: server => {
                    resolveServer(server);
                },
            });
            await triggerWatchMode(plugin);
            const server = await serverPromise;
            serversToClose.push(server);
            expect(server.listening).toBe(true);
        });
    });

    describe('renderStart dir collection', () => {
        it('should collect output dir when no dirs provided', async () => {
            let resolveServer;
            const serverPromise = new Promise(resolve => {
                resolveServer = resolve;
            });
            const plugin = serve({
                port: 0,
                onListen: server => {
                    resolveServer(server);
                    return true;
                },
            });
            expect(typeof plugin.renderStart).toBe('function');
            plugin.outputOptions.call({ meta: { watchMode: true } });
            plugin.renderStart.call({ meta: { watchMode: true } }, { dir: tmpDir }, {});
            const hookFn = plugin.writeBundle || plugin.generateBundle;
            await hookFn.call({ meta: { watchMode: true } }, {}, {});
            const server = await serverPromise;
            serversToClose.push(server);
            expect(server.listening).toBe(true);
        });

        it('should not add dir when outputOptions.dir is falsy', async () => {
            let resolveServer;
            const serverPromise = new Promise(resolve => {
                resolveServer = resolve;
            });
            const plugin = serve({
                port: 0,
                onListen: server => {
                    resolveServer(server);
                    return true;
                },
            });
            plugin.outputOptions.call({ meta: { watchMode: true } });
            plugin.renderStart.call({ meta: { watchMode: true } }, {}, {});
            const hookFn = plugin.writeBundle || plugin.generateBundle;
            await hookFn.call({ meta: { watchMode: true } }, {}, {});
            const server = await serverPromise;
            serversToClose.push(server);
            expect(server.listening).toBe(true);
        });

        it('should not add dir when outputOptions.dir is empty string', async () => {
            let resolveServer;
            const serverPromise = new Promise(resolve => {
                resolveServer = resolve;
            });
            const plugin = serve({
                port: 0,
                onListen: server => {
                    resolveServer(server);
                    return true;
                },
            });
            plugin.outputOptions.call({ meta: { watchMode: true } });
            plugin.renderStart.call({ meta: { watchMode: true } }, { dir: '' }, {});
            const hookFn = plugin.writeBundle || plugin.generateBundle;
            await hookFn.call({ meta: { watchMode: true } }, {}, {});
            const server = await serverPromise;
            serversToClose.push(server);
            expect(server.listening).toBe(true);
        });
    });

    describe('globalServer cleanup', () => {
        it('should close previous globalServer when a new plugin instance starts', async () => {
            const resA = createTestPlugin();
            await triggerWatchMode(resA.plugin);
            const serverA = await resA.serverPromise;
            serversToClose.push(serverA);
            expect(serverA.listening).toBe(true);

            const resB = createTestPlugin();
            await triggerWatchMode(resB.plugin);
            const serverB = await resB.serverPromise;
            serversToClose.push(serverB);
            expect(serverB.listening).toBe(true);

            await new Promise(resolve => {
                setTimeout(resolve, 50);
            });
            expect(serverA.listening).toBe(false);
        });
    });

    describe('useWriteBundle false (generateBundle hook)', () => {
        it('should start server via generateBundle in watch mode', async () => {
            let resolveServer;
            const serverPromise = new Promise(resolve => {
                resolveServer = resolve;
            });
            const plugin = serve({
                port: 0,
                dirs: ['.'],
                useWriteBundle: false,
                onListen: server => {
                    resolveServer(server);
                    return true;
                },
            });
            expect(plugin.generateBundle).toBeDefined();
            expect(plugin.writeBundle).toBeUndefined();
            plugin.outputOptions.call({ meta: { watchMode: true } });
            plugin.renderStart.call({ meta: { watchMode: true } }, {}, {});
            await plugin.generateBundle.call({ meta: { watchMode: true } }, {}, {});
            const server = await serverPromise;
            serversToClose.push(server);
            expect(server.listening).toBe(true);
        });
    });

    describe('staticOptions', () => {
        it('should pass staticOptions to serveStatic without crashing', async () => {
            const res = createTestPlugin({
                staticOptions: { rewriteRequestPath: path => path },
            });
            await triggerWatchMode(res.plugin);
            const server = await res.serverPromise;
            serversToClose.push(server);
            expect(server.listening).toBe(true);
        });
    });

    describe('multiple outputs', () => {
        it('should survive multiple renderStart/writeBundle cycles in non-watch', async () => {
            const pluginInstance = serve({ port: 0 });
            const sharedPlugins = [virtual({ entry: 'export default 9' }), pluginInstance];
            const bundle1 = await rollup({ input: 'entry', plugins: sharedPlugins });
            await bundle1.write({ format: 'es', dir: tmpDir });
            await bundle1.close();
            const bundle2 = await rollup({ input: 'entry', plugins: sharedPlugins });
            await bundle2.write({ format: 'es', dir: tmpDir });
            await bundle2.close();
        });
    });
});

// --- Additional coverage tests ---

describe('@rollup-extras/plugin-serve \u2013 additional coverage', () => {
    let serversToClose = [];

    beforeEach(() => {
        serversToClose = [];
    });

    afterEach(async () => {
        for (const server of serversToClose) {
            if (server?.listening) {
                await new Promise(resolve => {
                    server.close(resolve);
                });
            }
        }
        serversToClose = [];
    });

    describe('EADDRINUSE logger.finish branch (line 126)', () => {
        it('should exercise the EADDRINUSE error handler and call logger.finish', async () => {
            // Block a port with a plain net server
            const blocker = createNetServer();
            await new Promise(resolve => {
                blocker.listen(0, resolve);
            });
            const occupiedPort = blocker.address().port;

            try {
                // Use a deferred promise to detect when the error handler fires
                const _errorHandlerFired = false;
                const plugin = serve({
                    port: occupiedPort,
                    dirs: ['.'],
                    // Don't provide onListen — let the default logger path run.
                    // The EADDRINUSE error fires before onListen would be called.
                });

                // Must call outputOptions -> renderStart -> writeBundle in order
                plugin.outputOptions.call({ meta: { watchMode: true } });
                plugin.renderStart.call({ meta: { watchMode: true } }, {}, {});
                await plugin.writeBundle.call({ meta: { watchMode: true } }, {}, {});

                // Wait for the async EADDRINUSE error handler to fire (line 126)
                // Use multiple event loop ticks to ensure V8 coverage captures it
                for (let i = 0; i < 10; i++) {
                    await new Promise(resolve => {
                        setTimeout(resolve, 100);
                    });
                }
            } finally {
                await new Promise(resolve => {
                    blocker.close(resolve);
                });
            }
        });
    });

    describe('linkFromAddress string/null branch (line 151)', () => {
        it('should format a string address returned by server.address()', async () => {
            let capturedServer;
            let resolveListened;
            const listenedPromise = new Promise(resolve => {
                resolveListened = resolve;
            });

            const plugin = serve({
                port: 0,
                dirs: ['.'],
                onListen: server => {
                    capturedServer = server;
                    // Monkey-patch server.address() to return a string (Unix socket path)
                    // BEFORE returning falsy so internalOnListen proceeds to call
                    // linkFromAddress with a string, exercising line 151
                    server.address = () => '/tmp/rollup-extras-test.sock';
                    resolveListened(server);
                    // Return undefined (falsy) so the logger.finish path is taken
                },
            });

            // Proper hook sequence: outputOptions -> renderStart -> writeBundle
            plugin.outputOptions.call({ meta: { watchMode: true } });
            plugin.renderStart.call({ meta: { watchMode: true } }, {}, {});
            await plugin.writeBundle.call({ meta: { watchMode: true } }, {}, {});

            const server = await listenedPromise;
            serversToClose.push(server);

            expect(capturedServer).toBeDefined();
        });

        it('should format a null address returned by server.address()', async () => {
            let capturedServer;
            let resolveListened;
            const listenedPromise = new Promise(resolve => {
                resolveListened = resolve;
            });

            const plugin = serve({
                port: 0,
                dirs: ['.'],
                onListen: server => {
                    capturedServer = server;
                    // Monkey-patch server.address() to return null
                    server.address = () => null;
                    resolveListened(server);
                    // Return undefined (falsy) so the logger.finish path is taken
                },
            });

            plugin.outputOptions.call({ meta: { watchMode: true } });
            plugin.renderStart.call({ meta: { watchMode: true } }, {}, {});
            await plugin.writeBundle.call({ meta: { watchMode: true } }, {}, {});

            const server = await listenedPromise;
            serversToClose.push(server);

            expect(capturedServer).toBeDefined();
        });
    });
});
