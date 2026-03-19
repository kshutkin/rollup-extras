import { describe, expect, it } from 'vitest';

import { count } from '../src/utils';

describe('@rollup-extras/plugin-binify/utils', () => {
    it('smoke', () => {
        expect(count).toBeDefined();
    });

    it('empty line', () => {
        expect(count('', '1')).toBe(0);
    });

    it('1 occurrence', () => {
        expect(count('1', '1')).toBe(1);
    });

    it('2 occurrences', () => {
        expect(count('11', '1')).toBe(2);
    });

    it('with new line', () => {
        expect(count('1\n1', '1')).toBe(2);
    });

    it('with invalid string', () => {
        expect(count('11', '')).toBe(0);
    });

    it('with invalid string 2', () => {
        expect(count('11', '11')).toBe(0);
    });
});
