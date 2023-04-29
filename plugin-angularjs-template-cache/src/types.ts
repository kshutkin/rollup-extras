export type AngularTemplatesCachePluginOptionsFull = {
    templates?: string | string[], // defaults to ./**/*.html
    exclude?: string, // defaults to empty string
    rootDir?: string, // default to '.', relative to this directory will be resolved template url
    processHtml?: (html: string) => string, // function to process html templates
    pluginName?: string, // defaults to '@rollup-extras/plugin-angularjs-template-cache'
    transformTemplateUri?: (uri: string) => string,
    angularModule?: string, // 'templates' by default
    module?: string, // 'templates' by default
    watch?: boolean, // true by default
    verbose?: boolean | 'list-filenames', // false by default
    useImports?: boolean // false by default
}

export type AngularTemplatesCachePluginOptions = AngularTemplatesCachePluginOptionsFull | string | string[];
