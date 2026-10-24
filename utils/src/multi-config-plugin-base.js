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
 * @param {(this: PluginContext) => void | Promise<void>} [onAbort]
 * @returns {Plugin & { api: { addInstance(): Plugin } }}
 */
export function multiConfigPluginBase(useWriteBundle, pluginName, execute, onFinalHook, onAbort) {
    const finalHook = useWriteBundle ? 'writeBundle' : 'generateBundle';

    let remainingOutputsCount = 0,
        processingOutputsCount = 0,
        configsCount = 0,
        failed = false;

    const configs = new Set();
    const rendering = new WeakSet();

    const instance = /** @type {Plugin & { api: { addInstance(): Plugin } }} */ ({
        name: pluginName,

        renderStart,
        renderError,

        [finalHook]: writeBundle,

        api: { addInstance },
    });

    return instance;

    function addInstance() {
        const configId = ++configsCount;
        configs.add(configId);

        return /** @type {Plugin} */ ({
            name: `${pluginName}#${configId}`,

            /** @this {PluginContext} */
            renderStart() {
                configs.delete(configId);
                return renderStart.call(this);
            },

            renderError,

            [finalHook]: writeBundle,
        });
    }

    /** @this {PluginContext} */
    function renderStart() {
        rendering.add(this);
        ++remainingOutputsCount;
    }

    /** @this {PluginContext} */
    async function renderError() {
        // An earlier sequential renderStart hook may have failed before ours ran.
        if (!rendering.delete(this)) return;
        --remainingOutputsCount;
        failed = true;
        await complete.call(this);
    }

    /** @this {PluginContext} */
    async function writeBundle(/** @type {NormalizedOutputOptions} */ options, /** @type {OutputBundle} */ bundle) {
        rendering.delete(this);
        --remainingOutputsCount;
        ++processingOutputsCount;
        try {
            if (onFinalHook) {
                await onFinalHook.call(this, options, bundle, configs.size, remainingOutputsCount);
            }
        } catch (error) {
            failed = true;
            throw error;
        } finally {
            --processingOutputsCount;
            await complete.call(this, options, bundle);
        }
    }

    /**
     * @this {PluginContext}
     * @param {NormalizedOutputOptions} [options]
     * @param {OutputBundle} [bundle]
     */
    async function complete(options, bundle) {
        // Entering the final hook does not mean its asynchronous output processing has finished.
        if (remainingOutputsCount !== 0 || processingOutputsCount !== 0 || (!failed && configs.size !== 0)) return;
        try {
            if (failed) {
                await onAbort?.call(this);
            } else {
                await execute.call(this, /** @type {NormalizedOutputOptions} */ (options), /** @type {OutputBundle} */ (bundle));
            }
        } finally {
            failed = false;
            for (let i = configsCount; i > 0; --i) {
                configs.add(i);
            }
        }
    }
}
