export type AngularTemplatesCachePluginOptionsFull ={
    templates?: string, // defaults to ./**/*.html
    exclude?: string, // defaults to empty string
    pluginName?: string, // defaults to '@rollup-extras/plugin-angularjs-template-cache'
    angularModule?: string, // 'templates' by default
    module?: string, // 'templates' by default
    watch?: boolean, // true by default
    verbose?: boolean | 'list-filenames' // false by default
}

export type AngularTemplatesCachePluginOptions = AngularTemplatesCachePluginOptionsFull | string;
