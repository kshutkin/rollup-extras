import fs from 'fs/promises';
import path from 'path';
import { NormalizedOutputOptions, OutputBundle, OutputChunk, PluginContext, PluginHooks } from 'rollup';
import { HtmlPluginOptions } from './types';
import { createLogger, LogLevel } from '@niceties/logger';

const defaultTemplate = '<!DOCTYPE html><html><head></head><body></body></html>';
const headClosingElement = '</head>';
const bodyClosingElement = '</body>';

type AssetType = 'css' | 'es' | 'iife' | 'umd';

// Plan
// + 1. file name
// + 2. template string option
// + 3. template file name option
// 4. working with assets
// 5. watch
// 6. templateFactory option
// 7. other options: verbose, outputPlugin, watch, emitFiles
// 7.1. logger
// 8. hook??? (not initial implementation)

export default function(options: HtmlPluginOptions = {}) {

    const { pluginName, outputFile, template } = normalizeOptions(options);

    const templateFactory = defaultTemplateFactory;

    let remainingOutputsCount = 0;
    let configsCount = 0;
    const configs = new Set<number>();
    let initialDir = '';

    const assets: {[key in AssetType]: string[]} = {
        'css': [],
        'es': [],
        'iife': [],
        'umd': []
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

        addInstance
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
                relativePath = (fileName: string) => path.relative(initialDir, fileName),
                links = assets.css
                    .map(relativePath)
                    .map(getLinkElement),
                conditionalLoading = !!((assets.iife.length || assets.umd.length) && assets.es.length),
                scripts = (assets.iife.length ? assets.iife : assets.umd)
                    .map(relativePath)
                    .map((fn) => getNonModuleScriptElement(fn, conditionalLoading))
                    .concat(
                        assets.es
                            .map(relativePath)
                            .map(getModuleScriptElement)
                    ),
                fileNameInInitialDir = path.join(initialDir, outputFile),
                fileName = path.relative(dir, fileNameInInitialDir),
                source = templateFactory(templateString, links, scripts);

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
            if (fileName.endsWith('.css')) {
                assets.css.push(path.join(dir, fileName));
                continue;
            }
            if (bundle[fileName].type == 'chunk') {
                const chunk = bundle[fileName] as OutputChunk;
                if (chunk.isEntry) {
                    if (options.format === 'es' || options.format === 'iife' || options.format === 'umd') {
                        assets[options.format].push(path.join(dir, fileName));
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
}

function normalizeOptions(userOptions: HtmlPluginOptions): NormilizedOptions {
    const options = {
        pluginName: userOptions.pluginName ?? '@rollup-extras/plugin-html',
        template: userOptions.template,
        outputFile: userOptions.outputFile ?? 'index.html',
    };

    return options;
}

function defaultTemplateFactory(template: string, links: string[], scripts: string[]): string {
    const headIndex = template.toLowerCase().indexOf(headClosingElement);
    template = `${template.substring(0, headIndex)}${links.join('')}${template.substring(headIndex)}`;
    const bodyIndex = template.toLowerCase().indexOf(bodyClosingElement);
    return `${template.substring(0, bodyIndex)}${scripts.join('')}${template.substring(bodyIndex)}`;
}
