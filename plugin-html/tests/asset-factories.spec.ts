import { LogLevel, createLogger } from '@niceties/logger';
import { simpleES5Script, simpleES5FallbackScript, simpleModuleScript, combineAssetFactories } from '../src/asset-factories';

let logger: jest.Mock;

jest.mock('@niceties/logger', () => ({
    createLogger: jest.fn(() => Object.assign(logger = jest.fn()))
}));

describe('@rollup-extras/plugin-html/asset-factories', () => {

    beforeEach(() => {
        (createLogger as jest.Mock<ReturnType<typeof createLogger>, Parameters<typeof createLogger>>).mockClear();
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
        const factory = simpleES5Script(0 as never);

        const result1 = factory('test.js');
        const result2 = factory('test.css');

        expect(result1).toEqual(undefined);
        expect(result2).toEqual(undefined);

        expect(logger).toHaveBeenCalledWith('0 is not valid, using noopPredicate', LogLevel.warn);
    });

    it('combineAssetFactories', () => {
        const factory = combineAssetFactories(
            simpleES5FallbackScript('.js'),
            simpleModuleScript('.mjs')
        );

        const result1 = (factory as any)('test.js');
        const result2 = (factory as any)('test.mjs');

        expect(result1).toEqual('<script src="test.js" type="text/javascript" nomodule></script>');
        expect(result2).toEqual('<script src="test.mjs" type="module"></script>');
    });
});
