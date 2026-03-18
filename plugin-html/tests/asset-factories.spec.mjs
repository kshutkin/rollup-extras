import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createLogger, LogLevel } from '@niceties/logger';

import { combineAssetFactories, simpleES5FallbackScript, simpleES5Script, simpleModuleScript } from '../src/asset-factories';

let logger;

vi.mock('@niceties/logger', () => ({
    LogLevel: { verbose: 0, info: 1, warn: 2, error: 3 },
    createLogger: vi.fn(() => Object.assign((logger = vi.fn()))),
}));

describe('@rollup-extras/plugin-html/asset-factories', () => {
    beforeEach(() => {
        vi.mocked(createLogger).mockClear();
    });

    it('smoke', () => {
        expect(simpleES5Script).toBeDefined();
        expect(simpleES5FallbackScript).toBeDefined();
        expect(simpleModuleScript).toBeDefined();
        expect(combineAssetFactories).toBeDefined();
    });

    it('simpleES5Script', () => {
        const factory = simpleES5Script('.js');

        const result1 = factory('test.js');
        const result2 = factory('test.css');

        expect(result1).toEqual('<script src="test.js" type="text/javascript"></script>');
        expect(result2).toEqual(undefined);
    });

    it('simpleES5FallbackScript', () => {
        const factory = simpleES5FallbackScript('.js');

        const result1 = factory('test.js');
        const result2 = factory('test.css');

        expect(result1).toEqual('<script src="test.js" type="text/javascript" nomodule></script>');
        expect(result2).toEqual(undefined);
    });

    it('simpleModuleScript', () => {
        const factory = simpleModuleScript('.js');

        const result1 = factory('test.js');
        const result2 = factory('test.css');

        expect(result1).toEqual('<script src="test.js" type="module"></script>');
        expect(result2).toEqual(undefined);
    });

    it('invalid predicate', () => {
        const factory = simpleES5Script(0);

        const result1 = factory('test.js');
        const result2 = factory('test.css');

        expect(result1).toEqual(undefined);
        expect(result2).toEqual(undefined);

        expect(logger).toHaveBeenCalledWith('0 is not valid, using noopPredicate', LogLevel.warn);
    });

    it('combineAssetFactories', () => {
        const factory = combineAssetFactories(simpleES5FallbackScript('.js'), simpleModuleScript('.mjs'));

        const result1 = factory('test.js');
        const result2 = factory('test.mjs');

        expect(result1).toEqual('<script src="test.js" type="text/javascript" nomodule></script>');
        expect(result2).toEqual('<script src="test.mjs" type="module"></script>');
    });
});
