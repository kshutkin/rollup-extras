import { expect, it, vi } from 'vitest';

import serve from '../src/index.js';
import { createLiveReload } from '../src/livereload.js';

vi.mock('../src/livereload.js', async importOriginal => {
    const original = await importOriginal();
    return {
        ...original,
        createLiveReload: vi.fn(() => {
            const instance = original.createLiveReload();
            return { ...instance, broadcast: vi.fn(instance.broadcast) };
        }),
    };
});

it.each([false, true])('serves both concurrent outputs and reloads once per rebuild (linked: %s)', async linked => {
    let server;
    let onListen;
    const listening = new Promise(resolve => {
        onListen = value => {
            server = value;
            resolve();
            return true;
        };
    });
    const plugin = serve({ port: 0, dirs: [], inMemory: true, liveReload: true, useLogger: false, onListen });
    const instances = [plugin, linked ? plugin.api.addInstance() : plugin];
    const context = { meta: { watchMode: true } };
    const files = ['module.js', 'classic.js'];
    plugin.outputOptions.call(context);
    try {
        for (let value = 1; value <= 3; value++) {
            const inputOptions = {};
            // Drive the output lifecycle directly: this regression does not depend on filesystem notifications.
            for (const instance of instances) instance.renderStart.call(context, {}, inputOptions);
            await Promise.all(
                instances.map((instance, index) => {
                    const fileName = files[index];
                    return instance.generateBundle.call(
                        context,
                        {},
                        {
                            [fileName]: { type: 'chunk', fileName, code: `console.log(${value});` },
                        }
                    );
                })
            );
            await listening;
            const { broadcast } = vi.mocked(createLiveReload).mock.results.at(-1).value;
            expect(broadcast).toHaveBeenCalledTimes(value - 1);
            if (value > 1) expect(broadcast).toHaveBeenLastCalledWith('reload');
            for (const file of files) {
                const response = await fetch(`http://127.0.0.1:${server.address().port}/${file}`);
                expect(response.status).toBe(200);
                expect(await response.text()).toContain(`console.log(${value})`);
            }
        }
    } finally {
        await plugin.closeWatcher();
    }
});
