export type SingleTargetDesc = {
    src: string,
    exclude?: string | string[],
    dest?: string;
};

export type MultipleTargetsDesc = string | string[] | SingleTargetDesc | SingleTargetDesc[];

export type NonTargetOptions = {
    targets?: MultipleTargetsDesc,
    pluginName?: string,
    copyOnce?: boolean,
    watch?: boolean,
    verbose?: boolean,
    flattern?: boolean,
    exactFileNames?: boolean,
    outputPlugin?: boolean,
    emitFiles?: boolean
};

export type CopyPluginOptions = NonTargetOptions | MultipleTargetsDesc;
