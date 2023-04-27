import type { AssetPredicate, PredicateSource } from './types';

export function getLinkElement(fileName: string) {
    return `<link rel="stylesheet" href="${fileName}" type="text/css">`;
}

export function getNonModuleScriptElement(fileName: string, conditionalLoading: boolean) {
    return `<script src="${fileName}" type="text/javascript"${conditionalLoading ? ' nomodule' : ''}></script>`;
}

export function getModuleScriptElement(fileName: string) {
    return `<script src="${fileName}" type="module"></script>`;
}

export function toAssetPredicate(sourceOption: PredicateSource): AssetPredicate | undefined {
    if (typeof sourceOption === 'boolean') {
        return () => sourceOption;
    } else if (typeof sourceOption === 'function') {
        return sourceOption;
    } else if (sourceOption instanceof RegExp) {
        return (fileName: string) => sourceOption.test(fileName);
    } else if (typeof sourceOption === 'string') {
        return (fileName: string) => fileName.endsWith(sourceOption);
    }
    return undefined;
}