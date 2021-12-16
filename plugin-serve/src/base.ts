import { NormalizedOutputOptions, OutputBundle, PluginContext, PluginHooks } from 'rollup';
import { BaseMulticonfigPluginOptions } from './types';

type ExecuteFn = (this: PluginContext, options: NormalizedOutputOptions, bundle: OutputBundle) => void;

export default function(options: BaseMulticonfigPluginOptions, defaultPluginName: string, defaultUseWriteBundle: boolean, execute: ExecuteFn): [Partial<PluginHooks>, NormalizedOptions] {

    const normalizedOptions = normalizeOptions(options, defaultPluginName, defaultUseWriteBundle);
    
    const finalHook = normalizedOptions.useWriteBundle ? 'writeBundle' : 'generateBundle';
    const { pluginName } = normalizedOptions;

    let remainingOutputsCount = 0, configsCount = 0;

    const configs = new Set<number>();

    const instance = {
        name: pluginName,

        renderStart,

        [finalHook]: writeBundle,

        api: { addInstance }
    } as Partial<PluginHooks>;

    return [instance, normalizedOptions];

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

    function writeBundle(this: PluginContext, options: NormalizedOutputOptions, bundle: OutputBundle) {
        --remainingOutputsCount;
        if (configs.size === 0 && remainingOutputsCount === 0) {
            // do work
            execute.call(this, options, bundle);

            // reset configs
            for (let i = configsCount; i > 0; --i) {
                configs.add(i);
            }
        }
    }
}

type NormalizedOptions = {
    pluginName: string,
    useWriteBundle: boolean
}

function normalizeOptions(userOptions: BaseMulticonfigPluginOptions, defaultPluginName: string, defaultUseWriteBundle: boolean): NormalizedOptions {
    const options = {
        pluginName: userOptions.pluginName ?? defaultPluginName,
        useWriteBundle: userOptions.useWriteBundle ?? defaultUseWriteBundle,
    };

    return options;
}
