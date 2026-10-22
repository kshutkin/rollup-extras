import { watch as rollupWatch } from 'rollup';

/**
 * @import { OutputOptions, RollupBuild, RollupWatcher, RollupWatchOptions } from 'rollup'
 */

/**
 * Watch and generate Rollup output in memory, closing each build result automatically.
 * Configure `serve({ inMemory: true })` in the supplied Rollup configuration.
 * @param {RollupWatchOptions | RollupWatchOptions[]} config
 * @returns {RollupWatcher}
 */
export default function watch(config) {
    /** @type {OutputOptions[]} */
    let outputs = [];
    let closing = false;
    /** @type {(() => void) | undefined} */
    let finishBuild;
    let pending = Promise.resolve();
    /** @type {Promise<void> | undefined} */
    let closed;
    /** @type {(() => void) | undefined} */
    let ready;
    const initialized = new Promise(resolve => {
        ready = () => resolve(undefined);
    });
    const configs = Array.isArray(config) ? config : [config];
    const watcher = rollupWatch(
        configs.map(options => ({
            ...options,
            watch: options.watch === false ? false : { ...options.watch, skipWrite: true },
            plugins: [
                options.plugins,
                {
                    name: '@rollup-extras/plugin-serve/watch',
                    buildStart() {
                        outputs = Array.isArray(options.output) ? options.output : [options.output || {}];
                    },
                },
            ],
        }))
    );
    watcher.on('event', async event => {
        if (event.code === 'BUNDLE_START') {
            pending = new Promise(resolve => {
                finishBuild = resolve;
            });
            ready?.();
        } else if (event.code === 'BUNDLE_END') {
            try {
                await generate(event.result, outputs);
            } finally {
                finishBuild?.();
            }
        } else if (event.code === 'ERROR') {
            try {
                await event.result?.close();
            } finally {
                finishBuild?.();
            }
        }
    });

    function close() {
        closing = true;
        closed ||= (async () => {
            // Rollup installs close asynchronously. Finish the current build before teardown.
            await initialized;
            await pending;
            await watcher.close();
        })();
        return closed;
    }
    // Keep Rollup's chainable event API while retaining control of close during initialization.
    const managed = new Proxy(watcher, {
        get(target, key) {
            if (key === 'close') return close;
            const value = Reflect.get(target, key);
            if (typeof value !== 'function') return value;
            /** @param {...unknown} args */
            function call(...args) {
                const result = value.apply(target, args);
                return result === target ? managed : result;
            }
            return call;
        },
    });
    return managed;

    /**
     * @param {RollupBuild} result
     * @param {OutputOptions[]} outputOptions
     */
    async function generate(result, outputOptions) {
        try {
            if (!closing) {
                // Wait for every output even if one fails, so closeBundle cannot race output hooks.
                const generated = await Promise.allSettled(outputOptions.map(output => result.generate(output)));
                for (const output of generated) {
                    if (output.status === 'rejected') throw output.reason;
                }
            }
        } finally {
            await result.close();
        }
    }
}
