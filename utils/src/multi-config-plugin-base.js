/**
 * @import { NormalizedOutputOptions, OutputBundle, Plugin, PluginContext } from 'rollup'
 */

/**
 * @typedef {(this: PluginContext, options: NormalizedOutputOptions, bundle: OutputBundle) => void | Promise<void>} ExecuteFn
 */

/**
 * @typedef {(this: PluginContext, options: NormalizedOutputOptions, bundle: OutputBundle, remainingConfigsCount: number, remainingOutputsCount: number) => void | Promise<void>} OnFinalHook
 */

/**
 * @param {boolean} useWriteBundle
 * @param {string} pluginName
 * @param {ExecuteFn} execute
 * @param {OnFinalHook} [onFinalHook]
 * @returns {Plugin & { api: { addInstance(): Plugin } }}
 */
export function multiConfigPluginBase(useWriteBundle, pluginName, execute, onFinalHook) {
    const finalHook = useWriteBundle ? 'writeBundle' : 'generateBundle';

    let remainingOutputsCount = 0,
        configsCount = 0;

    const configs = new Set();

    const instance = /** @type {Plugin & { api: { addInstance(): Plugin } }} */ ({
        name: pluginName,

        renderStart,

        [finalHook]: writeBundle,

        api: { addInstance },
    });

    return instance;

    function addInstance() {
        const configId = ++configsCount;
        configs.add(configId);

        return /** @type {Plugin} */ ({
            name: `${pluginName}#${configId}`,

            renderStart: () => {
                configs.delete(configId);
                return renderStart();
            },

            [finalHook]: writeBundle,
        });
    }

    function renderStart() {
        ++remainingOutputsCount;
    }

    /** @this {PluginContext} */
    async function writeBundle(/** @type {NormalizedOutputOptions} */ options, /** @type {OutputBundle} */ bundle) {
        --remainingOutputsCount;
        if (onFinalHook) {
            await onFinalHook.call(this, options, bundle, configs.size, remainingOutputsCount);
        }
        if (configs.size === 0 && remainingOutputsCount === 0) {
            // do work
            try {
                await execute.call(this, options, bundle);
            } finally {
                // reset configs
                for (let i = configsCount; i > 0; --i) {
                    configs.add(i);
                }
            }
        }
    }
}
