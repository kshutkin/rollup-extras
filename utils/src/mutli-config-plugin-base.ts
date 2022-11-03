import { NormalizedOutputOptions, OutputBundle, Plugin, PluginContext } from 'rollup';

type ExecuteFn = (this: PluginContext, options: NormalizedOutputOptions, bundle: OutputBundle) => void | Promise<void>;
type OnFinalHook = (this: PluginContext, options: NormalizedOutputOptions, bundle: OutputBundle, remainingConfigsCount: number, remainingOutputsCount: number) => void | Promise<void>;

export function multiConfigPluginBase(useWriteBundle: boolean, pluginName: string, execute: ExecuteFn, onFinalHook?: OnFinalHook): Plugin & { api: { addInstance(): Plugin } } {

    const finalHook = useWriteBundle ? 'writeBundle' : 'generateBundle';

    let remainingOutputsCount = 0, configsCount = 0;

    const configs = new Set<number>();

    const instance = {
        name: pluginName,

        renderStart,

        [finalHook]: writeBundle,

        api: { addInstance }
    } as Plugin as Plugin & { api: { addInstance(): Plugin } };

    return instance;

    function addInstance() {
        const configId = ++configsCount;
        configs.add(configId);

        return {
            name: `${pluginName}#${configId}`,

            renderStart: () => {
                configs.delete(configId);
                return renderStart();
            },

            [finalHook]: writeBundle
        } as Plugin;
    }

    function renderStart() {
        ++remainingOutputsCount;
    }

    async function writeBundle(this: PluginContext, options: NormalizedOutputOptions, bundle: OutputBundle) {
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
