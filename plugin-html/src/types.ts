export type HtmlPluginOptions = {
    pluginName?: string;
    outputFile?: string;
    template?: string;
    injectIntoHead?: RegExp; // placing js into head
    ignoreCss?: RegExp; // filter some of css files (do not add links to them)
    assetsFactory?: (fileName: string) => { html: string, head: boolean } | string | undefined; // add some js assets from emitted assets + preloads
};
