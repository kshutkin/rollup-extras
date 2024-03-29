import { InternalModuleFormat } from 'rollup';

export type PredicateSource = boolean | AssetPredicate | RegExp | string;
export type AssetType = 'asset' | InternalModuleFormat;
export type Assets = {[key in AssetType]?: AssetDescriptor[]};
export type AssetPredicate = (fileName: string) => boolean;
export type AssetDescriptor = {
    html: string | ((assets: Assets, context?: unknown) => string | unknown),
    head: boolean,
    type: 'asset' | InternalModuleFormat
};
export type SimpleAssetDescriptor = {
    html: string,
    head: boolean,
    type: 'asset' | InternalModuleFormat
};
export type AssetFactory = (fileName: string, content: string | Uint8Array, type: 'asset' | InternalModuleFormat) => AssetDescriptor | string | undefined | Promise<AssetDescriptor | string | undefined>;
export type DefaultTemplateFactory = (initialTemplate: string, assets: Assets) => string;
export type TemplateFactory = (initialTemplate: string, assets: Assets, defaultTemplateFactory: DefaultTemplateFactory) => string | Uint8Array | Promise<string | Uint8Array>;

export type HtmlPluginOptions = {
    pluginName?: string;
    outputFile?: string;
    template?: string;
    watch?: boolean;
    emitFile?: boolean | 'auto';
    verbose?: boolean;
    useWriteBundle?: boolean;
    useEmittedTemplate?: boolean;
    conditionalLoading?: boolean;
    injectIntoHead?: PredicateSource; // placing asset into head
    ignore?: PredicateSource; // filter some of files
    assetsFactory?: AssetFactory; // add some assets from emitted chunks / assets in custom way
    templateFactory?: TemplateFactory;
};

export type Extends<T1, T2> = T1 extends T2 ? true : false;

export type Expect<T extends true> = T;
