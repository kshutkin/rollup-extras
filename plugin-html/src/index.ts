import fs from 'fs/promises';
import path from 'path';
import { NormalizedOutputOptions, OutputAsset, OutputBundle, OutputChunk, PluginContext, PluginHooks } from 'rollup';
import { AssetDescriptor, AssetFactory, AssetPredicate, Assets, HtmlPluginOptions, SimpleAssetDescriptor } from './types';
import { createLogger, LogLevel } from '@niceties/logger';

const defaultTemplate = '<!DOCTYPE html><html><head></head><body></body></html>';
const headClosingElement = '</head>';
const bodyClosingElement = '</body>';

// Plan
// + 1. file name
// + 2. template string option
// + 3. template file name option
// + 4. working with assets
// 5. watch
// 6. templateFactory option
// 7. other options: verbose, outputPlugin, watch, emitFiles
// 7.1. logger
// 8. hook??? (not initial implementation)

export default function(options: HtmlPluginOptions = {}) {

    const { pluginName, outputFile, template, injectIntoHead, ignore, assetsFactory } = normalizeOptions(options);

    const templateFactory = defaultTemplateFactory;

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

    return {
        name: pluginName,

        // buildStart(this: PluginContext) {
        //     this.addWatchFile('src/index.html');
        // },

        renderStart: (options: NormalizedOutputOptions) => {
            initialDir = options.dir || '';
            return renderStart(options);
        },

        generateBundle,

        api: { addInstance }
    } as never as Partial<PluginHooks> & { addOutput: void };

    function addInstance() {
        const configId = ++configsCount;
        configs.add(configId);

        return {
            name: `${pluginName}#${configId}`,

            // buildStart(this: PluginContext) {
            //     this.addWatchFile('src/index.html');
            // },

            renderStart: (options: NormalizedOutputOptions) => {
                configs.delete(configId);
                return renderStart(options);
            },

            generateBundle
        }
    }

    function renderStart(_options: NormalizedOutputOptions) {
        ++remainingOutputsCount;
    }

    async function generateBundle(this: PluginContext, options: NormalizedOutputOptions, bundle: OutputBundle) {
        --remainingOutputsCount;
        getAssets(options, bundle);
        if (configs.size === 0 && remainingOutputsCount === 0) {

            let templateString = defaultTemplate;

            if (template) {
                if (template.indexOf(headClosingElement) >= 0 && template.indexOf(bodyClosingElement)) {
                    templateString = template;
                } else {
                    try {
                        templateString = await fs.readFile(template, { encoding: 'utf8' });
                    } catch(e) {
                        // TODO revisit logger approach here
                        if ((e as NodeJS.ErrnoException)?.code === 'ENOENT') {
                            // TODO revisit logger approach here
                            createLogger(pluginName)('template nor a file or string', LogLevel.warn, e as Error);
                        } else {
                            // TODO revisit logger approach here
                            createLogger(pluginName)('error reading template', LogLevel.warn, e as Error);
                        }
                    }
                }                
            }

            const dir = options.dir || '',
                allAssets: SimpleAssetDescriptor[] = (assets.asset as AssetDescriptor[])
                    .concat(((assets.iife as AssetDescriptor[]).length ? assets.iife : assets.umd) as AssetDescriptor[])
                    .concat(assets.es as AssetDescriptor[])
                    .map((asset: AssetDescriptor) => {
                        if (typeof asset.html === 'function') {
                            asset.html = asset.html(assets);
                        }
                        return asset as SimpleAssetDescriptor;
                    }),
                fileNameInInitialDir = path.join(initialDir, outputFile),
                fileName = path.relative(dir, fileNameInInitialDir),
                source = templateFactory(templateString, allAssets);

            if (fileName.startsWith('..')) {
                try {
                    await fs.writeFile(fileNameInInitialDir, source);
                } catch(e) {
                    // TODO revisit logger approach here
                    createLogger(pluginName)('error creating html file', LogLevel.warn, e as Error);
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
    injectIntoHead: AssetPredicate,
    ignore: AssetPredicate,
    assetsFactory?: AssetFactory,
}

function normalizeOptions(userOptions: HtmlPluginOptions): NormilizedOptions {
    const options: NormilizedOptions = {
        pluginName: userOptions.pluginName ?? '@rollup-extras/plugin-html',
        template: userOptions.template,
        outputFile: userOptions.outputFile ?? 'index.html',
        injectIntoHead: () => false,
        ignore: () => false,
        assetsFactory: userOptions.assetsFactory
    };

    if (userOptions.injectIntoHead != null) {
        const predicate = toAssetPredicate(userOptions.injectIntoHead);
        if (predicate) {
            options.injectIntoHead = predicate;
        } else {
            // TODO warn
        }
    }

    if (userOptions.ignore != null) {
        const predicate = toAssetPredicate(userOptions.ignore);
        if (predicate) {
            options.ignore = predicate;
        } else {
            // TODO warn
        }
    }

    return options;
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

function defaultTemplateFactory(template: string, assets: SimpleAssetDescriptor[]): string {
    const headElements = assets.filter(asset => asset.head).map(asset => asset.html);
    const bodyElements = assets.filter(asset => !asset.head).map(asset => asset.html);
    const headIndex = template.toLowerCase().indexOf(headClosingElement);
    template = `${template.substring(0, headIndex)}${headElements.join('')}${template.substring(headIndex)}`;
    const bodyIndex = template.toLowerCase().indexOf(bodyClosingElement);
    return `${template.substring(0, bodyIndex)}${bodyElements.join('')}${template.substring(bodyIndex)}`;
}
