/**
 * @import { InternalModuleFormat } from 'rollup'
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
