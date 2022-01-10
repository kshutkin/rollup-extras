import fs from 'fs/promises';
import oldStyleFs from 'fs';
import path from 'path';
import { InternalModuleFormat, NormalizedInputOptions, NormalizedOutputOptions, OutputAsset, OutputBundle, OutputChunk, PluginContext, PluginHooks } from 'rollup';
import { AssetDescriptor, AssetPredicate, Assets, AssetType, HtmlPluginOptions, SimpleAssetDescriptor } from './types';
import { createLogger, LogLevel } from '@niceties/logger';
import { getOptionsObject } from '@rollup-extras/utils/options';
import logger from '@rollup-extras/utils/logger';
import { multiConfigPluginBase } from '@rollup-extras/utils/mutli-config-plugin-base';

const defaultTemplate = '<!DOCTYPE html><html><head></head><body></body></html>';
const headClosingElement = '</head>';
const bodyClosingElement = '</body>';
const cssExtention = '.css';

type Logger = ReturnType<typeof createLogger>;

const defaults = {
    pluginName: '@rollup-extras/plugin-html',
    outputFile: 'index.html',
    watch: true,
    useWriteBundle: false,
    emitFile: 'auto',
    injectIntoHead: (fileName: string) => fileName.endsWith(cssExtention),
    ignore: toAssetPredicate(false) as AssetPredicate,
    templateFactory: ((template: string, assets: Assets, defaultTemplateFactory: (template: string, assets: Assets) => string) => defaultTemplateFactory(template, assets))
};

const factories = { logger, injectIntoHead: predicateFactory as () => AssetPredicate, ignore: predicateFactory as () => AssetPredicate };

export default function(options: HtmlPluginOptions = {}) {

    const { pluginName, outputFile, template, watch, emitFile, conditionalLoading, logger, useWriteBundle, logLevel,
            useEmittedTemplate, injectIntoHead, ignore, assetsFactory, templateFactory } = getOptionsObject(options, {
            ...defaults,
            useEmittedTemplate: !('template' in options),
            logLevel: options.verbose ? LogLevel.info : LogLevel.verbose
        }, factories),
        hasCustomTemplateFactory = 'templateFactory' in options;

    let templateString: string | Promise<string> = defaultTemplate, hasTemplateFile = false;

    if (template) {
        if (isUsableByDefaultTemplateFactory(template)) {
            templateString = template;
        } else {
            if (watch) {
                try {
                    // using sync fs call because we need to return plugin object immidiately
                    useNewTemplate(oldStyleFs.readFileSync(template, { encoding: 'utf8' }));

                    hasTemplateFile = true;
                } catch(e) {
                    handleTemplateReadError(e);
                }
            } else {
                templateString = new Promise(resolve => {
                    fs.readFile(template, { encoding: 'utf8' })
                        .then((newTemplateString) => {
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

    let initialDir = '', fileNameInInitialDir: string, 
        assets: Assets = freshAssets();

    const processedFiles = new Set();

    const instance = multiConfigPluginBase(useWriteBundle, pluginName, generateBundle, updateAssets);

    const baseRenderStart = (instance as Required<typeof instance>).renderStart;
    const baseAddInstance = (instance as Required<typeof instance>).api.addInstance;

    instance.renderStart = function (this: PluginContext, outputOptions: NormalizedOutputOptions, inputOptions: NormalizedInputOptions) {
        logger('started collecting information', LogLevel.verbose);
        initialDir = outputOptions.dir || '';
        fileNameInInitialDir = path.join(initialDir, outputFile);
        return baseRenderStart.call(this, outputOptions, inputOptions);
    };

    instance.api.addInstance = () => {
        const instance = baseAddInstance();

        if (hasTemplateFile && watch) {
            (instance as never as PluginHooks).buildStart = buildStart;
        }
    
        return instance;
    };

    if (hasTemplateFile && watch) {
        instance.buildStart = async function(this: PluginContext) {
            try {
                useNewTemplate(await fs.readFile(template as string, { encoding: 'utf8' }));
            } catch(e) {
                handleTemplateReadError(e);
            }
            await buildStart.apply(this);
        };
    }

    return instance;

    async function updateAssets(this: PluginContext, options: NormalizedOutputOptions, bundle: OutputBundle, remainingConfigsCount: number, remainingOutputsCount: number) {
        await getAssets(options, bundle);
        const statistics = Object.keys(assets)
            .map(key => ({ key, count: (assets[key as AssetType] as AssetDescriptor[]).length }))
            .filter(item => item.count)
            .map(({ key, count }) => `${key}: ${count}`)
            .join(', ');
        logger(`assets collected: [${statistics}], remaining: ${remainingOutputsCount} outputs, ${remainingConfigsCount} configs`, LogLevel.verbose);
        const dir = options.dir || '', fileName = path.relative(dir, fileNameInInitialDir);
        if (fileName in bundle) {
            if (useEmittedTemplate) {
                logger(`using exiting emitted ${fileName} as an input for out templateFactory`, LogLevel.verbose);
                const source = bundle[fileName].type === 'asset' ? (bundle[fileName] as OutputAsset).source.toString() : (bundle[fileName] as OutputChunk).code;
                useNewTemplate(source);
            } else {
                logger(`removing exiting emitted ${fileName}`, LogLevel.verbose);
            }
            if (remainingConfigsCount === 0 && emitFile && !useWriteBundle) {
                delete bundle[fileName];
            }
        }
    }

    function freshAssets(): Assets {
        return {
            asset: [],
            es: [],
            iife: [],
            umd: []
        };
    }

    function useNewTemplate(newTemplateString: string) {
        if (!isUsableByDefaultTemplateFactory(newTemplateString) && !hasCustomTemplateFactory) {
            warnAboutUsingDefaultTemplate();
        } else {
            templateString = newTemplateString;
        }
    }

    function handleTemplateReadError(e: unknown) {
        if ((e as NodeJS.ErrnoException)?.code === 'ENOENT') {
            logger('template nor a file or string', LogLevel.warn, e);
        } else {
            logger('error reading template', LogLevel.warn, e);
        }
    }

    function warnAboutUsingDefaultTemplate() {
        logger('template is unusable by default template factory, using default one', LogLevel.warn);
    }

    async function buildStart(this: PluginContext) {
        this.addWatchFile(template as string);
    }

    async function generateBundle(this: PluginContext, options: NormalizedOutputOptions) {
        logger.start('generating html', logLevel);
        try {
            const dir = options.dir || '', fileName = path.relative(dir, fileNameInInitialDir);
            const depromisifiedTemplateString = await templateString,
                source = await templateFactory(depromisifiedTemplateString, assets, defaultTemplateFactory);

            if (!emitFile || fileName.startsWith('..') || useWriteBundle) {
                if (emitFile && emitFile !== 'auto') {
                    logger('cannot emitFile because it is outside of current output.dir, using writeFile instead', LogLevel.verbose);
                }
                await fs.mkdir(path.dirname(fileNameInInitialDir), { recursive: true });
                await fs.writeFile(fileNameInInitialDir, source);
            } else {
                this.emitFile({
                    type: 'asset',
                    fileName,
                    source
                });
            }
            // reset assets and configs for next iteration
            assets = freshAssets();
            processedFiles.clear();
            logger.finish('html file generated');
        } catch(e) {
            logger.finish('html generation failed', LogLevel.error, e);
        }
    }

    async function getAssets(options: NormalizedOutputOptions, bundle: OutputBundle) {
        const dir = options.dir || '';
        for (const fileName of Object.keys(bundle)) {
            const relativeToRootAssetPath = path.join(dir, fileName);
            if (ignore(relativeToRootAssetPath) || processedFiles.has(relativeToRootAssetPath)) {
                continue;
            }
            processedFiles.add(relativeToRootAssetPath);
            if (bundle[fileName].type == 'asset') {
                if (await useAssetFactory(fileName, relativeToRootAssetPath, (bundle[fileName] as OutputAsset).source, 'asset')) {
                    continue;
                }
                if (fileName.endsWith(cssExtention)) {
                    const assetPath = path.relative(initialDir, relativeToRootAssetPath);
                    (assets.asset as AssetDescriptor[]).push({
                        html: getLinkElement(assetPath),
                        head: injectIntoHead(relativeToRootAssetPath),
                        type: 'asset'
                    });
                    continue;
                }
            } else if (bundle[fileName].type == 'chunk') {
                const chunk = bundle[fileName] as OutputChunk;
                if (chunk.isEntry) {
                    if (await useAssetFactory(fileName, relativeToRootAssetPath, chunk.code, options.format)) {
                        continue;
                    }
                    if (options.format === 'es' || options.format === 'iife' || options.format === 'umd') {
                        const assetPath = path.relative(initialDir, relativeToRootAssetPath);
                        (assets[options.format] as AssetDescriptor[]).push({
                            html: (assets: Assets) => {
                                let useConditionalLoading = conditionalLoading;
                                useConditionalLoading ??= !!(((assets.iife  as AssetDescriptor[]).length 
                                    || (assets.umd as AssetDescriptor[]).length) 
                                    && (assets.es as AssetDescriptor[]).length);
                                return (options.format === 'iife' || options.format === 'umd') ? getNonModuleScriptElement(assetPath, useConditionalLoading as boolean) : getModuleScriptElement(assetPath);
                            },
                            head: injectIntoHead(relativeToRootAssetPath),
                            type: 'asset'
                        });
                    }
                }
            }
        }
    }

    async function useAssetFactory(fileName: string, relativeToRootAssetPath: string, source: string | Uint8Array, format: 'asset' | InternalModuleFormat) {
        if (assetsFactory) {
            try {
                let asset = await assetsFactory(fileName, source, format);
                if (asset) {
                    if (typeof asset === 'string') {
                        asset = {
                            html: asset,
                            head: injectIntoHead(relativeToRootAssetPath),
                            type: format
                        };
                    }
                    if (!assets[asset.type]) {
                        assets[asset.type] = [];
                    }
                    (assets[asset.type] as AssetDescriptor[]).push(asset);
                    return true;
                }
            } catch (e) {
                logger('exception in assetFactory', LogLevel.warn, e);
            }
        }
        return false;
    }
}

function isUsableByDefaultTemplateFactory(template: string) {
    return template.indexOf(headClosingElement) >= 0 && template.indexOf(bodyClosingElement) >= 0;
}

function getLinkElement(fileName: string) {
    return `<link rel="stylesheet" href="${fileName}" type="text/css">`;
}

function getNonModuleScriptElement(fileName: string, conditionalLoading: boolean) {
    return `<script src="${fileName}" type="text/javascript"${conditionalLoading ? ' nomodule' : ''}></script>`;
}

function getModuleScriptElement(fileName: string) {
    return `<script src="${fileName}" type="module"></script>`;
}

function predicateFactory(options: {injectIntoHead?: boolean | AssetPredicate | RegExp, ignore?: boolean | AssetPredicate | RegExp} & { logger?: Logger }, field: 'injectIntoHead' | 'ignore'): AssetPredicate {
    if (options[field] != null) {
        const predicate = toAssetPredicate(options[field] as boolean | AssetPredicate | RegExp);
        if (predicate) {
            return predicate;
        } else {
            options.logger && options.logger(`${field} option ignored because it is not a function, RegExp or boolean`, LogLevel.warn);
        }
    }
    return defaults[field];
}

function toAssetPredicate(sourceOption: boolean | AssetPredicate | RegExp): AssetPredicate | undefined {
    if (typeof sourceOption === 'boolean') {
        return () => sourceOption as boolean;
    } else if (typeof sourceOption === 'function') {
        return sourceOption as AssetPredicate;
    } else if (sourceOption instanceof RegExp) {
        return (fileName: string) => (sourceOption as RegExp).test(fileName);
    }
    return undefined;
}

function defaultTemplateFactory(template: string, assets: Assets): string {
    const assetsAsArray: SimpleAssetDescriptor[] = (assets.asset as AssetDescriptor[])
        .concat(((assets.iife as AssetDescriptor[]).length ? assets.iife : assets.umd) as AssetDescriptor[])
        .concat(assets.es as AssetDescriptor[])
        .map((asset: AssetDescriptor) => {
            if (typeof asset.html === 'function') {
                asset.html = asset.html(assets) as string;
            }
            return asset as SimpleAssetDescriptor;
        });
    const headElements = assetsAsArray.filter(asset => asset.head).map(asset => asset.html);
    const bodyElements = assetsAsArray.filter(asset => !asset.head).map(asset => asset.html);
    const headIndex = template.toLowerCase().indexOf(headClosingElement);
    template = `${template.substring(0, headIndex)}${headElements.join('')}${template.substring(headIndex)}`;
    const bodyIndex = template.toLowerCase().indexOf(bodyClosingElement);
    return `${template.substring(0, bodyIndex)}${bodyElements.join('')}${template.substring(bodyIndex)}`;
}
