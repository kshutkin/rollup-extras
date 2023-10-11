

export type ExternalsPluginOptions = {
    pluginName?: string,
    verbose?: boolean,
    external?: (id: string, external: boolean, importer?: string) => boolean
} | ((id: string, external: boolean, importer?: string) => boolean);