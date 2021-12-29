import fs from 'fs/promises';
import oldStyleFs from 'fs';
import path from 'path';
import { InternalModuleFormat, NormalizedOutputOptions, OutputAsset, OutputBundle, OutputChunk, PluginContext, PluginHooks } from 'rollup';
import { AssetDescriptor, AssetFactory, AssetPredicate, Assets, AssetType, HtmlPluginOptions, SimpleAssetDescriptor, TemplateFactory } from './types';
import { createLogger, LogLevel } from '@niceties/logger';

const defaultTemplate = '<!DOCTYPE html><html><head></head><body></body></html>';
const headClosingElement = '</head>';
const bodyClosingElement = '</body>';
const cssExtention = '.css';

export default function(options: HtmlPluginOptions = {}) {

    const { pluginName, outputFile, template, watch, emitFile, conditionalLoading, logger, useWriteBundle, logLevel,
            useEmittedTemplate, injectIntoHead, ignore, assetsFactory, templateFactory } = normalizeOptions(options),
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

    let remainingOutputsCount = 0, configsCount = 0, initialDir = '', fileNameInInitialDir: string, 
        assets: Assets = freshAssets();

    const configs = new Set<number>(), finalHook = useWriteBundle ? 'writeBundle' : 'generateBundle',
        processedFiles = new Set();

    const instance = {
        name: pluginName,

        renderStart: (options: NormalizedOutputOptions) => {
            logger('started collecting information', LogLevel.verbose);
            initialDir = options.dir || '';
            fileNameInInitialDir = path.join(initialDir, outputFile);
            return renderStart();
        },

        [finalHook]: generateBundle,

        api: { addInstance }
    } as Partial<PluginHooks>;

    if (hasTemplateFile && watch) {
        instance.buildStart = async function() {
            try {
                useNewTemplate(await fs.readFile(template as string, { encoding: 'utf8' }));
            } catch(e) {
                handleTemplateReadError(e);
            }
            await buildStart.apply(this);
        };
    }

    return instance;

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

    function addInstance() {
        const configId = ++configsCount;
        configs.add(configId);

        const instance = {
            name: `${pluginName}#${configId}`,

            renderStart: () => {
                configs.delete(configId);
                return renderStart();
            },

            [finalHook]: generateBundle
        } as Partial<PluginHooks>;

        if (hasTemplateFile && watch) {
            instance.buildStart = buildStart;
        }
    
        return instance;
    }

    async function buildStart(this: PluginContext) {
        this.addWatchFile(template as string);
    }

    function renderStart() {
        ++remainingOutputsCount;
    }

    async function generateBundle(this: PluginContext, options: NormalizedOutputOptions, bundle: OutputBundle) {
        --remainingOutputsCount;
        await getAssets(options, bundle);
        const statistics = Object.keys(assets)
            .map(key => ({ key, count: (assets[key as AssetType] as AssetDescriptor[]).length }))
            .filter(item => item.count)
            .map(({ key, count }) => `${key}: ${count}`)
            .join(', ');
        logger(`assets collected: [${statistics}], remaining: ${remainingOutputsCount} outputs, ${configs.size} configs`, LogLevel.verbose);

        const dir = options.dir || '', fileName = path.relative(dir, fileNameInInitialDir);
        if (fileName in bundle) {
            if (useEmittedTemplate) {
                logger(`using exiting emitted ${fileName} as an input for out templateFactory`, LogLevel.verbose);
                const source = bundle[fileName].type === 'asset' ? (bundle[fileName] as OutputAsset).source.toString() : (bundle[fileName] as OutputChunk).code;
                useNewTemplate(source);
            } else {
                logger(`removing exiting emitted ${fileName}`, LogLevel.verbose);
            }
            if (configs.size === 0 && emitFile && !useWriteBundle) {
                delete bundle[fileName];
            }
        }

        if (configs.size === 0 && remainingOutputsCount === 0) {
            logger.start('generating html', logLevel);
            try {
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
                for (let i = configsCount; i > 0; --i) {
                    configs.add(i);
                }
                processedFiles.clear();
                logger.finish('html file generated');
            } catch(e) {
                logger.finish('html generation failed', LogLevel.error, e);
            }            
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

type NormilizedOptions = {
    pluginName: string,
    outputFile: string,
    template?: string,
    watch: boolean,
    useWriteBundle: boolean;
    logLevel: number,
    emitFile?: boolean | 'auto',
    conditionalLoading?: boolean,
    useEmittedTemplate: boolean,
    injectIntoHead: AssetPredicate,
    ignore: AssetPredicate,
    assetsFactory?: AssetFactory,
    templateFactory: TemplateFactory,
    logger: ReturnType<typeof createLogger>
}

function normalizeOptions(userOptions: HtmlPluginOptions): NormilizedOptions {
    const options = {
            pluginName: userOptions.pluginName ?? '@rollup-extras/plugin-html',
            template: userOptions.template,
            outputFile: userOptions.outputFile ?? 'index.html',
            watch: userOptions.watch ?? true,
            useWriteBundle: userOptions.useWriteBundle ?? false,
            useEmittedTemplate: userOptions.useEmittedTemplate ?? !('template' in userOptions),
            emitFile: userOptions.emitFile ?? 'auto',
            logLevel: userOptions.verbose ? LogLevel.info : LogLevel.verbose,
            conditionalLoading: userOptions.conditionalLoading,
            injectIntoHead: (fileName: string) => fileName.endsWith(cssExtention),
            ignore: toAssetPredicate(false),
            assetsFactory: userOptions.assetsFactory,
            templateFactory: userOptions.templateFactory
                ?? ((template, assets, defaultTemplateFactory) => defaultTemplateFactory(template, assets)),
        },
        logger = (options as never as NormilizedOptions).logger = createLogger(options.pluginName),
        optionIgnoredText = 'option ignored because it is not a function, RegExp or boolean';

    if (userOptions.injectIntoHead != null) {
        const predicate = toAssetPredicate(userOptions.injectIntoHead);
        if (predicate) {
            (options as never as NormilizedOptions).injectIntoHead = predicate;
        } else {
            logger(`injectIntoHead ${optionIgnoredText}`, LogLevel.warn);
        }
    }

    if (userOptions.ignore != null) {
        const predicate = toAssetPredicate(userOptions.ignore);
        if (predicate) {
            (options as never as NormilizedOptions).ignore = predicate;
        } else {
            logger(`ignore ${optionIgnoredText}`, LogLevel.warn);
        }
    }

    return (options as never as NormilizedOptions);
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
