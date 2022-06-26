import { OutputAsset, OutputChunk } from 'rollup';

export type BinifyPluginOptions = {
    pluginName?: string,
    verbose?: boolean,
    shebang?: string,
    executableFlag?: number | boolean,
    filter?: (item: OutputAsset | OutputChunk) => boolean
};
