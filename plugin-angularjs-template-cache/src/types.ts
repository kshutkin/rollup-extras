export type AngularTemplatesCachePluginOptionsFull = {
    templates?: string | string[], // defaults to ./**/*.html
    watch?: boolean, // true by default
    rootDir?: string, // default to '.', relative to this directory will be resolved template url
    transformTemplateUri?: (uri: string) => string,
    processHtml?: (html: string) => string, // function to process html templates
    pluginName?: string, // defaults to '@rollup-extras/plugin-angularjs-template-cache'
    angularModule?: string, // 'templates' by default
    standalone?: boolean, // true by default, true if we plugin needs to create module and false to just retrieve it
    module?: string, // 'templates' by default
    importAngular?: boolean, // wheather to import angular or use global
    autoImport?: boolean, // false by default, automatically import generated module (useful for standalone module referenced by name)
    verbose?: boolean | 'list-filenames', // false by default
    useImports?: boolean // false by default
}

export type AngularTemplatesCachePluginOptions = AngularTemplatesCachePluginOptionsFull | string | string[];
