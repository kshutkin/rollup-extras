export type SingleTargetDesc = {
    src: string | string[],
    exclude?: string | string[],
    dest?: string;
};

export type MultipleTargetsDesc = string | string[] | SingleTargetDesc | SingleTargetDesc[];

export type NonTargetOptions = {
    targets?: MultipleTargetsDesc,
    pluginName?: string,
    copyOnce?: boolean,
    watch?: boolean,
    verbose?: boolean | 'list-filenames',
    flatten?: boolean,
    exactFileNames?: boolean,
    outputPlugin?: boolean,
    emitFiles?: boolean | 'copy-symlinks' | 'link-only'
};

export type CopyPluginOptions = NonTargetOptions | MultipleTargetsDesc;
