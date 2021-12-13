import fs from 'fs/promises';
import oldStyleFs from 'fs';
import path from 'path';
import { NormalizedOutputOptions, OutputAsset, OutputBundle, OutputChunk, PluginContext, PluginHooks } from 'rollup';
import { AssetDescriptor, AssetFactory, AssetPredicate, Assets, HtmlPluginOptions, SimpleAssetDescriptor, TemplateFactory } from './types';
import { createLogger, LogLevel } from '@niceties/logger';

const defaultTemplate = '<!DOCTYPE html><html><head></head><body></body></html>';
const headClosingElement = '</head>';
const bodyClosingElement = '</body>';

// Plan
// + 1. file name
// + 2. template string option
// + 3. template file name option
// + 4. working with assets
// + 5. watch + option
// + 6. templateFactory option
// + 7. logger
/*
    [start] collecting inputs
    [update] collecting assets (ramaining count)
    [update] generating html
    [msg] cannot emit file using writeFile
    [finish] finished
*/
// ???async factories???
// 8. other options: verbose, emitFiles, conditionalLoading
// 9. hook??? (not initial implementation)

export default function(options: HtmlPluginOptions = {}) {

    const { pluginName, outputFile, template, watch, logger, injectIntoHead, ignore, assetsFactory, templateFactory } = normalizeOptions(options);

    let templateString: string | Promise<string> = defaultTemplate, hasTemplateFile = false;

    if (template) {
        if (template.indexOf(headClosingElement) >= 0 && template.indexOf(bodyClosingElement)) {
            templateString = template;
        } else {
            if (watch) {
                try {
                    // using sync fs call because we need to return plugin object immidiately
                    templateString = oldStyleFs.readFileSync(template, { encoding: 'utf8' });

                    hasTemplateFile = true;
                } catch(e) {
                    handleTemplateReadError(e);
                }
            } else {
                templateString = new Promise(resolve => {
                    fs.readFile(template, { encoding: 'utf8' })
                        .then(resolve)
                        .catch(handleTemplateReadError);
                });
            }
        }
    }

    let remainingOutputsCount = 0;
    let configsCount = 0;
    const configs = new Set<number>();
    let initialDir = '';

    const assets: Assets = {
        asset: [],
        es: [],
        iife: [],
        umd: []
    };

    const instance = {
        name: pluginName,

        renderStart: (options: NormalizedOutputOptions) => {
            initialDir = options.dir || '';
            return renderStart();
        },

        generateBundle,

        api: { addInstance }
    } as Partial<PluginHooks>;

    if (hasTemplateFile && watch) {
        instance.buildStart = async function() {
            try {
                templateString = await fs.readFile(template as string, { encoding: 'utf8' });
    
                hasTemplateFile = true;
            } catch(e) {
                handleTemplateReadError(e);
            }
            await buildStart.apply(this);
        }
    }

    return instance;

    function handleTemplateReadError(e: unknown) {
        if ((e as NodeJS.ErrnoException)?.code === 'ENOENT') {
            logger('template nor a file or string', LogLevel.warn, e as Error);
        } else {
            logger('error reading template', LogLevel.warn, e as Error);
        }
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

            generateBundle
        } as Partial<PluginHooks>;

        if (hasTemplateFile && watch) {
            instance.buildStart = buildStart;
        }
    
        return instance;
    }

    async function buildStart(this: PluginContext) {
        this.addWatchFile('src/index.html');
    }

    function renderStart() {
        ++remainingOutputsCount;
    }

    async function generateBundle(this: PluginContext, options: NormalizedOutputOptions, bundle: OutputBundle) {
        --remainingOutputsCount;
        getAssets(options, bundle);
        if (configs.size === 0 && remainingOutputsCount === 0) {
            const dir = options.dir || '',
                fileNameInInitialDir = path.join(initialDir, outputFile),
                fileName = path.relative(dir, fileNameInInitialDir),
                depromisifiedTemplateString = await Promise.resolve(templateString),
                source = templateFactory(depromisifiedTemplateString, assets, defaultTemplateFactory);

            if (fileName.startsWith('..')) {
                try {
                    await fs.writeFile(fileNameInInitialDir, source);
                } catch(e) {
                    logger('error creating html file', LogLevel.warn, e as Error);
                }
            } else {
                this.emitFile({
                    type: 'asset',
                    fileName,
                    source
                });
            }
        }
    }

    function getAssets(options: NormalizedOutputOptions, bundle: OutputBundle) {
        const dir = options.dir || '';
        for (const fileName of Object.keys(bundle)) {
            const relativeToRootAssetPath = path.join(dir, fileName);
            if (ignore(relativeToRootAssetPath)) {
                continue;
            }
            if (bundle[fileName].type == 'asset') {
                if (assetsFactory) {
                    let asset = assetsFactory(fileName, (bundle[fileName] as OutputAsset).source, 'asset');
                    if (asset) {
                        if (typeof asset === 'string') {
                            asset = {
                                html: asset,
                                head: injectIntoHead(relativeToRootAssetPath),
                                type: 'asset'
                            };
                        }
                        if (!assets[asset.type]) {
                            assets[asset.type] = [];
                        }
                        (assets[asset.type] as AssetDescriptor[]).push(asset);
                        continue;
                    }
                }
                if (fileName.endsWith('.css')) {
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
                    if (assetsFactory) {
                        let asset = assetsFactory(fileName, chunk.code, options.format);
                        if (asset) {
                            if (typeof asset === 'string') {
                                asset = {
                                    html: asset,
                                    head: injectIntoHead(relativeToRootAssetPath),
                                    type: options.format
                                };
                            }
                            if (!assets[asset.type]) {
                                assets[asset.type] = [];
                            }
                            (assets[asset.type] as AssetDescriptor[]).push(asset);
                            continue;
                        }
                    }
                    if (options.format === 'es' || options.format === 'iife' || options.format === 'umd') {
                        const assetPath = path.relative(initialDir, relativeToRootAssetPath);
                        (assets[options.format] as AssetDescriptor[]).push({
                            html: (assets: Assets) => {
                                const conditionalLoading = !!(((assets.iife  as AssetDescriptor[]).length 
                                    || (assets.umd as AssetDescriptor[]).length) 
                                    && (assets.es as AssetDescriptor[]).length);
                                return (options.format === 'iife' || options.format === 'umd') ? getNonModuleScriptElement(assetPath, conditionalLoading) : getModuleScriptElement(assetPath);
                            },
                            head: injectIntoHead(relativeToRootAssetPath),
                            type: 'asset'
                        });
                    }
                }
            }
        }
    }
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
    watch?: boolean,
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
            injectIntoHead: () => false,
            ignore: () => false,
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
