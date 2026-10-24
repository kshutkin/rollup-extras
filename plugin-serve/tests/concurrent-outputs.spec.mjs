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

it.each([false, true])('recovers serving after a sibling render fails (linked: %s)', async linked => {
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
    const contexts = [{ meta: { watchMode: true } }, { meta: { watchMode: true } }];
    const inputOptions = {};
    const starts = vi.mocked(createLiveReload).mock.calls.length;
    plugin.outputOptions.call(contexts[0]);
    try {
        for (const [index, instance] of instances.entries()) instance.renderStart.call(contexts[index], {}, inputOptions);
        await plugin.generateBundle.call(contexts[0], {}, { 'old.js': { type: 'chunk', fileName: 'old.js', code: 'console.log(1);' } });
        await instances[1].renderError.call(contexts[1], new Error('render failed'));
        expect(createLiveReload).toHaveBeenCalledTimes(starts);

        for (const [index, instance] of instances.entries()) instance.renderStart.call(contexts[index], {}, inputOptions);
        await Promise.all(
            instances.map((instance, index) =>
                instance.generateBundle.call(
                    contexts[index],
                    {},
                    {
                        [`new-${index}.js`]: { type: 'chunk', fileName: `new-${index}.js`, code: 'console.log(2);' },
                    }
                )
            )
        );
        await listening;
        const base = `http://127.0.0.1:${server.address().port}`;
        expect((await fetch(`${base}/old.js`)).status).toBe(404);
        for (const index of [0, 1]) {
            const response = await fetch(`${base}/new-${index}.js`);
            expect(response.status).toBe(200);
            expect(await response.text()).toContain('console.log(2)');
        }
        expect(vi.mocked(createLiveReload).mock.results.at(-1).value.broadcast).not.toHaveBeenCalled();
    } finally {
        await plugin.closeWatcher();
    }
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
