import { NormalizedOutputOptions, OutputBundle, PluginContext, PluginHooks } from 'rollup';

type ExecuteFn = (this: PluginContext, options: NormalizedOutputOptions, bundle: OutputBundle) => void;
type OnFinalHook = (this: PluginContext, options: NormalizedOutputOptions, bundle: OutputBundle, remainingConfigsCount: number, remainingOutputsCount: number) => void | Promise<void>;

export function multiConfigPluginBase(useWriteBundle: boolean, pluginName: string, execute: ExecuteFn, onFinalHook?: OnFinalHook): Partial<PluginHooks> & { api: { addInstance(): void } } {

    const finalHook = useWriteBundle ? 'writeBundle' : 'generateBundle';

    let remainingOutputsCount = 0, configsCount = 0;

    const configs = new Set<number>();

    const instance = {
        name: pluginName,

        renderStart,

        [finalHook]: writeBundle,

        api: { addInstance }
    };

    return instance;

    function addInstance() {
        const configId = ++configsCount;
        configs.add(configId);

        const instance = {
            name: `${pluginName}#${configId}`,

            renderStart: () => {
                configs.delete(configId);
                return renderStart();
            },

            [finalHook]: writeBundle
        } as Partial<PluginHooks>;
    
        return instance;
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
