/**
 * @import { Logger } from '@niceties/logger'
 * @import { PluginContext } from 'rollup'
 */

/**
 * @typedef {(this: PluginContext & { logger: Logger }) => void} CallbackFunction
 */

/**
 * @typedef {{ pluginName?: string, exec?: CallbackFunction }} ExecPluginOptionsObject
 */

/**
 * @typedef {ExecPluginOptionsObject | CallbackFunction} ExecPluginOptions
 */
