import { describe, expect, it } from 'vitest';

import { getOptionsObject } from '../src/index.js';
import loggerFactory from '../src/logger.js';

describe('@rollup-extras/util/logger', () => {
    it('should be defined', () => {
        expect(loggerFactory).toBeDefined();
    });

    it('should create logger via factory', () => {
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
