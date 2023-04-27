import { LogLevel, Logger, createLogger } from '@niceties/logger';
import { getNonModuleScriptElement, getModuleScriptElement, toAssetPredicate } from './shared';
import type { AssetFactory, Expect, Extends, PredicateSource } from './types';
import type { InternalModuleFormat } from 'rollup';

const noopPredicate = () => false;
let logger: Logger | undefined;

export function simpleES5Script(predicateSource: PredicateSource) {
    const predicate = getPredicate(predicateSource);
    return (fileName: string) => {
        if (predicate(fileName)) {
            return getNonModuleScriptElement(fileName, false);
        }
    };
}

export function simpleES5FallbackScript(predicateSource: PredicateSource) {
    const predicate = getPredicate(predicateSource);
    return (fileName: string) => {
        if (predicate(fileName)) {
            return getNonModuleScriptElement(fileName, true);
        }
    };
}

export function simpleModuleScript(predicateSource: PredicateSource) {
    const predicate = getPredicate(predicateSource);
    return (fileName: string) => {
        if (predicate(fileName)) {
            return getModuleScriptElement(fileName);
        }
    };
}

export function combineAssetFactories(...factories: AssetFactory[]) {
    return (fileName: string, content: string | Uint8Array, type: 'asset' | InternalModuleFormat) => {
        for (const factory of factories) {
            const result = factory(fileName, content, type);
            if (result) {
                return result;
            }
        }
    };
}

function getPredicate(predicateSource: PredicateSource) {
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

/* eslint-disable @typescript-eslint/no-unused-vars */
type Check1 = Expect<Extends<ReturnType<typeof simpleES5Script>, AssetFactory>>;
type Check2 = Expect<Extends<ReturnType<typeof simpleES5FallbackScript>, AssetFactory>>;
type Check3 = Expect<Extends<ReturnType<typeof simpleModuleScript>, AssetFactory>>;
type Check4 = Expect<Extends<ReturnType<typeof combineAssetFactories>, AssetFactory>>;