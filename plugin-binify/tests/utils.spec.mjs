import { describe, expect, it } from 'vitest';

import { count } from '../src/utils';

describe('@rollup-extras/plugin-binify/utils', () => {
    it('should return 0 for empty line', () => {
        expect(count('', '1')).toBe(0);
    });

    it('should count 1 occurrence', () => {
        expect(count('1', '1')).toBe(1);
    });

    it('should count 2 occurrences', () => {
        expect(count('11', '1')).toBe(2);
    });

    it('should count across new lines', () => {
        expect(count('1\n1', '1')).toBe(2);
    });

    it('should return 0 for empty search string', () => {
        expect(count('11', '')).toBe(0);
    });

    it('should return 0 when search string equals input', () => {
        expect(count('11', '11')).toBe(0);
    });
});
