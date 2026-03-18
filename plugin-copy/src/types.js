/**
 * @typedef {{ src: string | string[], exclude?: string | string[], dest?: string }} SingleTargetDesc
 */

/**
 * @typedef {string | string[] | SingleTargetDesc | SingleTargetDesc[]} MultipleTargetsDesc
 */

/**
 * @typedef {{ targets?: MultipleTargetsDesc, pluginName?: string, copyOnce?: boolean, watch?: boolean, verbose?: boolean | 'list-filenames', flatten?: boolean, exactFileNames?: boolean, outputPlugin?: boolean, emitFiles?: boolean, emitOriginalFileName?: 'absolute' | 'relative' | ((fileName: string) => string) }} NonTargetOptions
 */

/**
 * @typedef {NonTargetOptions | MultipleTargetsDesc} CopyPluginOptions
 */
