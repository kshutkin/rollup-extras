

export type ExternalsPluginOptions = {
    pluginName?: string,
    verbose?: boolean,
    external?: (id: string, external: boolean) => boolean
};