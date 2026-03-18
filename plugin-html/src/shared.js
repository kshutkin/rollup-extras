/**
 * @import { AssetPredicate, PredicateSource } from './types.js'
 */

/**
 * @param {string} fileName
 * @returns {string}
 */
export function getLinkElement(fileName) {
    return `<link rel="stylesheet" href="${fileName}" type="text/css">`;
}

/**
 * @param {string} fileName
 * @param {boolean} conditionalLoading
 * @returns {string}
 */
export function getNonModuleScriptElement(fileName, conditionalLoading) {
    return `<script src="${fileName}" type="text/javascript"${conditionalLoading ? ' nomodule' : ''}></script>`;
}

/**
 * @param {string} fileName
 * @returns {string}
 */
export function getModuleScriptElement(fileName) {
    return `<script src="${fileName}" type="module"></script>`;
}

/**
 * @param {PredicateSource} sourceOption
 * @returns {AssetPredicate | undefined}
 */
export function toAssetPredicate(sourceOption) {
    if (typeof sourceOption === 'boolean') {
        return () => sourceOption;
    } else if (typeof sourceOption === 'function') {
        return sourceOption;
    } else if (sourceOption instanceof RegExp) {
        return (/** @type {string} */ fileName) => sourceOption.test(fileName);
    } else if (typeof sourceOption === 'string') {
        return (/** @type {string} */ fileName) => fileName.endsWith(sourceOption);
    }
    return undefined;
}
