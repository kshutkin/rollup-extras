/**
 * @import { InternalModuleFormat } from 'rollup'
 */

/**
 * @typedef {boolean | AssetPredicate | RegExp | string} PredicateSource
 */

/**
 * @typedef {(fileName: string) => boolean} AssetPredicate
 */

/**
 * @typedef {{ html: string | ((assets: any, context?: unknown) => string | unknown), head: boolean, type: 'asset' | InternalModuleFormat }} AssetDescriptor
 */

/**
 * @typedef {(fileName: string, content: string | Uint8Array, type: 'asset' | InternalModuleFormat) => AssetDescriptor | string | undefined | Promise<AssetDescriptor | string | undefined>} AssetFactory
 */

import { createLogger, LogLevel } from '@niceties/logger';

import { getModuleScriptElement, getNonModuleScriptElement, toAssetPredicate } from './shared.js';

const noopPredicate = () => false;
/** @type {ReturnType<typeof createLogger> | undefined} */
let logger;

/**
 * @param {PredicateSource} predicateSource
 * @returns {AssetFactory}
 */
export function simpleES5Script(predicateSource) {
    const predicate = getPredicate(predicateSource);
    return fileName => {
        if (predicate(fileName)) {
            return getNonModuleScriptElement(fileName, false);
        }
    };
}

/**
 * @param {PredicateSource} predicateSource
 * @returns {AssetFactory}
 */
export function simpleES5FallbackScript(predicateSource) {
    const predicate = getPredicate(predicateSource);
    return fileName => {
        if (predicate(fileName)) {
            return getNonModuleScriptElement(fileName, true);
        }
    };
}

/**
 * @param {PredicateSource} predicateSource
 * @returns {AssetFactory}
 */
export function simpleModuleScript(predicateSource) {
    const predicate = getPredicate(predicateSource);
    return fileName => {
        if (predicate(fileName)) {
            return getModuleScriptElement(fileName);
        }
    };
}

/**
 * @param {...AssetFactory} factories
 * @returns {AssetFactory}
 */
export function combineAssetFactories(...factories) {
    return (fileName, content, type) => {
        for (const factory of factories) {
            const result = factory(fileName, content, type);
            if (result) {
                return result;
            }
        }
    };
}

/**
 * @param {PredicateSource} predicateSource
 */
function getPredicate(predicateSource) {
    let predicate = toAssetPredicate(predicateSource);
    if (!predicate) {
        const logger = getLogger();
        logger(`${predicateSource} is not valid, using noopPredicate`, LogLevel.warn);
        predicate = noopPredicate;
    }
    return predicate;
}

function getLogger() {
    if (!logger) {
        logger = createLogger('@rollup-extras/plugin-html/asset-factories');
    }
    return logger;
}
