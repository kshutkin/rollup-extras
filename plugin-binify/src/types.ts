import { OutputAsset, OutputChunk } from 'rollup';

export type BinifyPluginOptions = {
    pluginName?: string,
    verbose?: boolean,
    shebang?: string,
    executableFlag?: number | string | false,
    filter?: (item: OutputAsset | OutputChunk) => boolean
};
