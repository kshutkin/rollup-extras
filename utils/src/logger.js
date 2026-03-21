import { createLogger } from '@niceties/logger';

/**
 * @param {{ pluginName?: string }} options
 * @returns {ReturnType<typeof createLogger>}
 */
export default function (options) {
    return createLogger(options.pluginName);
}
