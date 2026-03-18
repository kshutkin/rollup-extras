import { describe, expect, it } from 'vitest';

import { getOptionsObject } from '../src/index.js';
import loggerFactory from '../src/logger.js';

describe('@rollup-extras/util/logger', () => {
    it('smoke', () => {
        expect(loggerFactory).toBeDefined();
    });

    it('logger factory', () => {
        const { logger } = getOptionsObject(
            {},
            {},
            {
                logger: loggerFactory,
            }
        );
        expect(logger).toEqual(expect.any(Function));
    });
});
