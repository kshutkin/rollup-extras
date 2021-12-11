// import fs from 'fs/promises';
import { NormalizedOutputOptions, OutputBundle, OutputChunk, PluginContext, PluginHooks } from 'rollup';
import { HtmlPluginOptions } from './types';
// import { createLogger, LogLevel } from '@niceties/logger';

const defaultTemplateFactory = (links: string[], scripts: string[]) => `<html>
    <head>
        ${links.join('\n')}
    </head>
    <body>
        ${scripts.join('\n')}
    </body>
</html>`;

type AssetType = 'css' | 'es' | 'iife' | 'umd';

export default function(options: HtmlPluginOptions = {}) {

    const { pluginName, template } = normalizeOptions(options);

    const templateFactory = template ? () => '' : defaultTemplateFactory;

    let remainingOutputsCount = 0;
    let configsCount = 0;
    const configs = new Set<number>();

    const assets: {[key in AssetType]: string[]} = {
        'css': [],
        'es': [],
        'iife': [],
        'umd': []
    };

    return {
        name: pluginName,

        renderStart,

        generateBundle,

        addOutput
    } as never as Partial<PluginHooks> & { addOutput: void, name: string };

    function addOutput() {
        const configId = ++configsCount;
        configs.add(configId);

        return {
            name: `${pluginName}#${configId}`,

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
            const links = assets.css.map(getLinkElement),
                conditionalLoading = !!((assets.iife.length || assets.umd.length) && assets.es.length),
                scripts = (assets.iife.length ? assets.iife : assets.umd)
                    .map((fn) => getNonModuleScriptElement(fn, conditionalLoading))
                    .concat(assets.es.map(getModuleScriptElement));

            this.emitFile({
                type: 'asset',
                fileName: 'index.html',
                source: templateFactory(links, scripts)
            });
        }
    }

    function getAssets(options: NormalizedOutputOptions, bundle: OutputBundle) {
        for (const fileName of Object.keys(bundle)) {
            if (fileName.endsWith('.css')) {
                assets.css.push(fileName);
                continue;
            }
            if (bundle[fileName].type == 'chunk') {
                const chunk = bundle[fileName] as OutputChunk;
                if (chunk.isEntry) {
                    if (options.format === 'es' || options.format === 'iife' || options.format === 'umd') {
                        assets[options.format].push(fileName);
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
    template?: string,
}

function normalizeOptions(userOptions: HtmlPluginOptions): NormilizedOptions {
    const options = {
        pluginName: userOptions.pluginName ?? '@rollup-extras/plugin-html',
        template: userOptions.template,
    };

    return options;
}
