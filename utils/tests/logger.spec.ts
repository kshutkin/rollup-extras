import { getOptionsObject } from '../src';
import loggerFactory from '../src/logger';

describe('@rollup-extras/util/logger', () => {

    it('smoke', () => {
        expect(loggerFactory).toBeDefined();
    });

    it('logger factory', () => {
        const { logger } = getOptionsObject({} as { pluginName: string }, {}, {
            logger: loggerFactory
        });
        expect(logger).toEqual(expect.any(Function));
    });

});