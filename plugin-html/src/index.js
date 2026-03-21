import { readFileSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, relative } from 'node:path';

/**
 * @import { InternalModuleFormat, NormalizedInputOptions, NormalizedOutputOptions, OutputAsset, OutputBundle, OutputChunk, Plugin, PluginContext, PluginHooks } from 'rollup'
 */

/**
 * @typedef {boolean | AssetPredicate | RegExp | string} PredicateSource
 */

/**
 * @typedef {'asset' | InternalModuleFormat} AssetType
 */

/**
 * @typedef {{ [key in AssetType]?: AssetDescriptor[] }} Assets
 */

/**
 * @typedef {(fileName: string) => boolean} AssetPredicate
 */

/**
 * @typedef {{ html: string | ((assets: Assets, context?: unknown) => string | unknown), head: boolean, type: 'asset' | InternalModuleFormat }} AssetDescriptor
 */

/**
 * @typedef {{ html: string, head: boolean, type: 'asset' | InternalModuleFormat }} SimpleAssetDescriptor
 */

/**
 * @typedef {(fileName: string, content: string | Uint8Array, type: 'asset' | InternalModuleFormat) => AssetDescriptor | string | undefined | Promise<AssetDescriptor | string | undefined>} AssetFactory
 */

/**
 * @typedef {(initialTemplate: string, assets: Assets) => string} DefaultTemplateFactory
 */

/**
 * @typedef {(initialTemplate: string, assets: Assets, defaultTemplateFactory: DefaultTemplateFactory) => string | Uint8Array | Promise<string | Uint8Array>} TemplateFactory
 */

/**
 * @typedef {{ pluginName?: string, outputFile?: string, template?: string, watch?: boolean, emitFile?: boolean | 'auto', verbose?: boolean, useWriteBundle?: boolean, useEmittedTemplate?: boolean, conditionalLoading?: boolean, injectIntoHead?: PredicateSource, ignore?: PredicateSource, assetsFactory?: AssetFactory, templateFactory?: TemplateFactory }} HtmlPluginOptions
 */

import { createLogger, LogLevel } from '@niceties/logger';
import logger from '@rollup-extras/utils/logger';
import { multiConfigPluginBase } from '@rollup-extras/utils/multi-config-plugin-base';
import { getOptionsObject } from '@rollup-extras/utils/options';

import { getLinkElement, getModuleScriptElement, getNonModuleScriptElement, toAssetPredicate } from './shared.js';

const defaultTemplate = '<!DOCTYPE html><html><head></head><body></body></html>';
const headClosingElement = '</head>';
const bodyClosingElement = '</body>';
const cssExtention = '.css';

/** @typedef {ReturnType<typeof createLogger>} Logger */

const defaults = {
    pluginName: '@rollup-extras/plugin-html',
    outputFile: 'index.html',
    watch: true,
    useWriteBundle: false,
    emitFile: 'auto',
    injectIntoHead: /** @type {AssetPredicate} */ ((/** @type {string} */ fileName) => fileName.endsWith(cssExtention)),
    ignore: /** @type {AssetPredicate} */ (toAssetPredicate(false)),
    templateFactory: /** @type {TemplateFactory} */ (
        (/** @type {string} */ template, /** @type {Assets} */ assets, /** @type {DefaultTemplateFactory} */ defaultTemplateFactory) =>
            defaultTemplateFactory(template, assets)
    ),
};

const factories = {
    logger,
    injectIntoHead: /** @type {(options: Partial<HtmlPluginOptions>, field: string) => AssetPredicate} */ (predicateFactory),
    ignore: /** @type {(options: Partial<HtmlPluginOptions>, field: string) => AssetPredicate} */ (predicateFactory),
};

/**
 * @param {HtmlPluginOptions} [options]
 * @returns {Plugin & { api: { addInstance(): Plugin } }}
 */
export default function (options = {}) {
    const {
            pluginName,
            outputFile,
            template,
            watch,
            emitFile,
            conditionalLoading,
            logger,
            useWriteBundle,
            logLevel,
            useEmittedTemplate,
            injectIntoHead,
            ignore,
            assetsFactory,
            templateFactory,
        } = getOptionsObject(
            options,
            {
                ...defaults,
                useEmittedTemplate: !('template' in options),
                logLevel: options.verbose ? LogLevel.info : LogLevel.verbose,
            },
            factories
        ),
        hasCustomTemplateFactory = 'templateFactory' in options;

    /** @type {string | Promise<string>} */
    let templateString = defaultTemplate;
    let hasTemplateFile = false;

    if (template) {
        if (isUsableByDefaultTemplateFactory(template)) {
            templateString = template;
        } else {
            if (watch) {
                try {
                    // using sync fs call because we need to return plugin object immediately
                    useNewTemplate(readFileSync(template, { encoding: 'utf8' }));
                    hasTemplateFile = true;
                } catch (e) {
                    handleTemplateReadError(e);
                }
            } else {
                templateString = new Promise(resolve => {
                    readFile(template, { encoding: 'utf8' })
                        .then(newTemplateString => {
                            if (!isUsableByDefaultTemplateFactory(newTemplateString) && !hasCustomTemplateFactory) {
                                warnAboutUsingDefaultTemplate();
                                resolve(defaultTemplate);
                            } else {
                                resolve(newTemplateString);
                            }
                        })
                        .catch(handleTemplateReadError);
                });
            }
        }
    }

    let initialDir = '',
        /** @type {string} */ fileNameInInitialDir,
        /** @type {Assets} */ assets = freshAssets();

    /** @type {Set<string>} */
    const processedFiles = new Set();

    const instance = multiConfigPluginBase(useWriteBundle, pluginName, generateBundle, updateAssets);

    const baseRenderStart = /** @type {Required<typeof instance>} */ (instance).renderStart;
    const baseAddInstance = /** @type {() => Plugin} */ (instance.api.addInstance);

    /** @this {PluginContext} */
    instance.renderStart = function (
        /** @type {NormalizedOutputOptions} */ outputOptions,
        /** @type {NormalizedInputOptions} */ inputOptions
    ) {
        logger('started collecting information', LogLevel.verbose);
        initialDir = outputOptions.dir ?? '';
        fileNameInInitialDir = join(initialDir, outputFile);
        return /** @type {(this: PluginContext, outputOptions: NormalizedOutputOptions, inputOptions: NormalizedInputOptions) => void | Promise<void>} */ (
            baseRenderStart
        ).call(this, outputOptions, inputOptions);
    };

    instance.api.addInstance = () => {
        const instance = baseAddInstance();

        if (hasTemplateFile && watch) {
            /** @type {PluginHooks} */ (/** @type {unknown} */ (instance)).buildStart = buildStart;
        }

        return instance;
    };

    if (hasTemplateFile && watch) {
        /** @this {PluginContext} */
        instance.buildStart = async function () {
            try {
                useNewTemplate(await readFile(/** @type {string} */ (template), { encoding: 'utf8' }));
            } catch (e) {
                handleTemplateReadError(e);
            }
            await buildStart.apply(this);
        };
    }

    return instance;

    /** @this {PluginContext} */
    async function updateAssets(
        /** @type {NormalizedOutputOptions} */ options,
        /** @type {OutputBundle} */ bundle,
        /** @type {number} */ remainingConfigsCount,
        /** @type {number} */ remainingOutputsCount
    ) {
        await getAssets(options, bundle);
        const statistics = Object.keys(assets)
            .map(key => ({ key, count: /** @type {AssetDescriptor[]} */ (assets[/** @type {AssetType} */ (key)]).length }))
            .filter(item => item.count)
            .map(({ key, count }) => `${key}: ${count}`)
            .join(', ');
        logger(
            `assets collected: [${statistics}], remaining: ${remainingOutputsCount} outputs, ${remainingConfigsCount} configs`,
            LogLevel.verbose
        );
        const dir = options.dir ?? '',
            fileName = relative(dir, fileNameInInitialDir);
        if (fileName in bundle) {
            if (useEmittedTemplate) {
                logger(`using existing emitted ${fileName} as an input for our templateFactory`, LogLevel.verbose);
                const source =
                    /** @type {OutputAsset | OutputChunk} */ (bundle[fileName]).type === 'asset'
                        ? /** @type {OutputAsset} */ (bundle[fileName]).source.toString()
                        : /** @type {OutputChunk} */ (bundle[fileName]).code;
                useNewTemplate(source);
            } else {
                logger(`removing existing emitted ${fileName}`, LogLevel.verbose);
            }
            if (remainingConfigsCount === 0 && emitFile && !useWriteBundle) {
                delete bundle[fileName];
            }
        }
    }

    /**
     * @returns {Assets}
     */
    function freshAssets() {
        return {
            asset: [],
            es: [],
            iife: [],
            umd: [],
        };
    }

    /**
     * @param {string} newTemplateString
     */
    function useNewTemplate(newTemplateString) {
        if (!isUsableByDefaultTemplateFactory(newTemplateString) && !hasCustomTemplateFactory) {
            warnAboutUsingDefaultTemplate();
        } else {
            templateString = newTemplateString;
        }
    }

    /**
     * @param {unknown} e
     */
    function handleTemplateReadError(e) {
        if (/** @type {NodeJS.ErrnoException} */ (e)?.code === 'ENOENT') {
            logger('template is neither a file nor a string', LogLevel.warn, e);
        } else {
            logger('error reading template', LogLevel.warn, e);
        }
    }

    function warnAboutUsingDefaultTemplate() {
        logger('template is unusable by default template factory, using default one', LogLevel.warn);
    }

    /** @this {PluginContext} */
    async function buildStart() {
        this.addWatchFile(/** @type {string} */ (template));
    }

    /** @this {PluginContext} */
    async function generateBundle(/** @type {NormalizedOutputOptions} */ options) {
        logger.start('generating html', logLevel);
        try {
            const dir = options.dir ?? '',
                fileName = relative(dir, fileNameInInitialDir);
            const depromisifiedTemplateString = await templateString,
                source = await templateFactory(depromisifiedTemplateString, assets, defaultTemplateFactory);

            if (!emitFile || fileName.startsWith('..') || useWriteBundle) {
                if (emitFile && emitFile !== 'auto') {
                    logger('cannot emitFile because it is outside of current output.dir, using writeFile instead', LogLevel.verbose);
                }
                await mkdir(dirname(fileNameInInitialDir), { recursive: true });
                await writeFile(fileNameInInitialDir, source);
            } else {
                this.emitFile({
                    type: 'asset',
                    fileName,
                    source,
                });
            }
            // reset assets and configs for the next iteration
            assets = freshAssets();
            processedFiles.clear();
            logger.finish('html file generated');
        } catch (e) {
            logger.finish('html generation failed', LogLevel.error, e);
        }
    }

    /**
     * @param {NormalizedOutputOptions} options
     * @param {OutputBundle} bundle
     */
    async function getAssets(options, bundle) {
        const dir = options.dir ?? '';
        for (const fileName of Object.keys(bundle)) {
            const relativeToRootAssetPath = join(dir, fileName);
            const assetPath = relative(initialDir, relativeToRootAssetPath);
            if (ignore(relativeToRootAssetPath) || processedFiles.has(relativeToRootAssetPath)) {
                continue;
            }
            processedFiles.add(relativeToRootAssetPath);
            if (/** @type {OutputAsset | OutputChunk} */ (bundle[fileName]).type === 'asset') {
                if (
                    await useAssetFactory(assetPath, relativeToRootAssetPath, /** @type {OutputAsset} */ (bundle[fileName]).source, 'asset')
                ) {
                    continue;
                }
                if (fileName.endsWith(cssExtention)) {
                    /** @type {AssetDescriptor[]} */ (assets.asset).push({
                        html: getLinkElement(assetPath),
                        head: injectIntoHead(relativeToRootAssetPath),
                        type: 'asset',
                    });
                }
            } else if (/** @type {OutputAsset | OutputChunk} */ (bundle[fileName]).type === 'chunk') {
                const chunk = /** @type {OutputChunk} */ (bundle[fileName]);
                if (chunk.isEntry) {
                    if (await useAssetFactory(assetPath, relativeToRootAssetPath, chunk.code, options.format)) {
                        continue;
                    }
                    if (options.format === 'es' || options.format === 'iife' || options.format === 'umd') {
                        /** @type {AssetDescriptor[]} */ (assets[options.format]).push({
                            html: (/** @type {Assets} */ assets) => {
                                let useConditionalLoading = conditionalLoading;
                                useConditionalLoading ??= !!((assets.iife?.length || assets.umd?.length) && assets.es?.length);
                                return options.format === 'iife' || options.format === 'umd'
                                    ? getNonModuleScriptElement(assetPath, !!useConditionalLoading)
                                    : getModuleScriptElement(assetPath);
                            },
                            head: injectIntoHead(relativeToRootAssetPath),
                            type: 'asset',
                        });
                    }
                }
            }
        }
    }

    /**
     * @param {string} fileName
     * @param {string} relativeToRootAssetPath
     * @param {string | Uint8Array} source
     * @param {'asset' | InternalModuleFormat} format
     * @returns {Promise<boolean>}
     */
    async function useAssetFactory(fileName, relativeToRootAssetPath, source, format) {
        if (assetsFactory) {
            try {
                let asset = await assetsFactory(fileName, source, format);
                if (asset) {
                    if (typeof asset === 'string') {
                        asset = {
                            html: asset,
                            head: injectIntoHead(relativeToRootAssetPath),
                            type: format,
                        };
                    }
                    if (!assets[asset.type]) {
                        assets[asset.type] = [];
                    }
                    /** @type {AssetDescriptor[]} */ (assets[asset.type]).push(asset);
                    return true;
                }
            } catch (e) {
                logger('exception in assetFactory', LogLevel.warn, e);
            }
        }
        return false;
    }
}

/**
 * @param {string} template
 * @returns {boolean}
 */
function isUsableByDefaultTemplateFactory(template) {
    return template.indexOf(headClosingElement) >= 0 && template.indexOf(bodyClosingElement) >= 0;
}

/**
 * @param {{ injectIntoHead?: PredicateSource, ignore?: PredicateSource, logger?: Logger }} options
 * @param {'injectIntoHead' | 'ignore'} field
 * @returns {AssetPredicate}
 */
function predicateFactory(options, field) {
    if (options[field] != null) {
        const predicate = toAssetPredicate(/** @type {PredicateSource} */ (options[field]));
        if (predicate) {
            return predicate;
        } else {
            options.logger?.(`${field} option ignored because it is not a function, RegExp, string or boolean`, LogLevel.warn);
        }
    }
    return defaults[field];
}

/**
 * @param {string} template
 * @param {Assets} assets
 * @returns {string}
 */
function defaultTemplateFactory(template, assets) {
    /** @type {SimpleAssetDescriptor[]} */
    const assetsAsArray = /** @type {AssetDescriptor[]} */ (assets.asset)
        .concat(/** @type {AssetDescriptor[]} */ (/** @type {AssetDescriptor[]} */ (assets.iife).length ? assets.iife : assets.umd))
        .concat(/** @type {AssetDescriptor[]} */ (assets.es))
        .map((/** @type {AssetDescriptor} */ asset) => {
            if (typeof asset.html === 'function') {
                asset.html = /** @type {string} */ (asset.html(assets));
            }
            return /** @type {SimpleAssetDescriptor} */ (asset);
        });
    const headElements = assetsAsArray.filter(asset => asset.head).map(asset => asset.html);
    const bodyElements = assetsAsArray.filter(asset => !asset.head).map(asset => asset.html);
    const headIndex = template.toLowerCase().indexOf(headClosingElement);
    template = `${template.substring(0, headIndex)}${headElements.join('')}${template.substring(headIndex)}`;
    const bodyIndex = template.toLowerCase().indexOf(bodyClosingElement);
    return `${template.substring(0, bodyIndex)}${bodyElements.join('')}${template.substring(bodyIndex)}`;
}
