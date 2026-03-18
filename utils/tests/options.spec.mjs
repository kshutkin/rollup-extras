import { describe, expect, it } from 'vitest';

import { getOptions, getOptionsObject } from '../src/options.ts';

describe('@rollup-extras/util/mutli-config-plugin-base', () => {
    it('smoke', () => {
        expect(getOptions).toBeDefined();
        expect(getOptionsObject).toBeDefined();
    });

    describe('getOptionsObject', () => {
        it('all args', () => {
            const { test, test2, test3 } = getOptionsObject({ test: 1 }, { test2: 2 }, { test3: () => 3 });
            expect(test).toBe(1);
            expect(test2).toBe(2);
            expect(test3).toBe(3);
        });

        it('override defaults', () => {
            const { test } = getOptionsObject({ test: 1 }, { test: 2 }, { test2: () => 3 });
            expect(test).toBe(1);
        });

        it('override using factory', () => {
            const { test } = getOptionsObject({ test: 1 }, { test: 2 }, { test: () => 3 });
            expect(test).toBe(3);
        });

        it('2 args', () => {
            const { test, test2, test3 } = getOptionsObject({ test: 1 }, { test2: 2 });
            expect(test).toBe(1);
            expect(test2).toBe(2);
            expect(test3).toBe(undefined);
        });

        it('1 arg', () => {
            const { test, test3 } = getOptionsObject({ test: 1 });
            expect(test).toBe(1);
            expect(test3).toBe(undefined);
        });
    });

    describe('getOptions with string as first argument', () => {
        it('all args', () => {
            const { test, test2, test3 } = getOptions('2', { test: 1 }, 'test2', { test3: () => 3 });
            expect(test).toBe(1);
            expect(test2).toEqual(['2']);
            expect(test3).toBe(3);
        });
        it('3 args', () => {
            const { test, test2 } = getOptions('2', { test: 1 }, 'test2');
            expect(test).toBe(1);
            expect(test2).toEqual(['2']);
        });
        it('3 args without defaults', () => {
            const { test2 } = getOptions('2', {}, 'test2');
            expect(test2).toEqual(['2']);
        });
    });

    describe('getOptions with [string] as first argument', () => {
        it('all args', () => {
            const { test, test2, test3 } = getOptions(['2'], { test: 1 }, 'test2', { test3: () => 3 });
            expect(test).toBe(1);
            expect(test2).toEqual(['2']);
            expect(test3).toBe(3);
        });
        it('3 args', () => {
            const { test, test2 } = getOptions(['2'], { test: 1 }, 'test2');
            expect(test).toBe(1);
            expect(test2).toEqual(['2']);
        });
        it('3 args without defaults', () => {
            const { test2 } = getOptions(['2'], {}, 'test2');
            expect(test2).toEqual(['2']);
        });
    });

    describe('getOptions with object with string property as first argument', () => {
        it('all args', () => {
            const { test, test2, test3 } = getOptions({ test2: '2' }, { test: 1 }, 'test2', { test3: () => 3 });
            expect(test).toBe(1);
            expect(test2).toEqual(['2']);
            expect(test3).toBe(3);
        });
        it('3 args', () => {
            const { test, test2 } = getOptions({ test2: '2' }, { test: 1 }, 'test2');
            expect(test).toBe(1);
            expect(test2).toEqual(['2']);
        });
        it('3 args without defaults', () => {
            const { test2 } = getOptions({ test2: '2' }, {}, 'test2');
            expect(test2).toEqual(['2']);
        });
    });

    describe('getOptions with object with string[] property as first argument', () => {
        it('all args', () => {
            const { test, test2, test3 } = getOptions({ test2: ['2'] }, { test: 1 }, 'test2', { test3: () => 3 });
            expect(test).toBe(1);
            expect(test2).toEqual(['2']);
            expect(test3).toBe(3);
        });
        it('3 args', () => {
            const { test, test2 } = getOptions({ test2: ['2'] }, { test: 1 }, 'test2');
            expect(test).toBe(1);
            expect(test2).toEqual(['2']);
        });
        it('3 args without defaults', () => {
            const { test2 } = getOptions({ test2: ['2'] }, {}, 'test2');
            expect(test2).toEqual(['2']);
        });
    });

    describe('getOptions with object with undefined property as first argument', () => {
        it('all args', () => {
            const { test, test2, test3, test4 } = getOptions({ test4: 4 }, { test: 1 }, 'test2', { test3: () => 3 });
            expect(test).toBe(1);
            expect(test2).toEqual(undefined);
            expect(test3).toBe(3);
            expect(test4).toBe(4);
        });
        it('3 args', () => {
            const { test, test2, test4 } = getOptions({ test4: 4 }, { test: 1 }, 'test2');
            expect(test).toBe(1);
            expect(test2).toEqual(undefined);
            expect(test4).toEqual(4);
        });
        it('plugin-clean failed case', () => {
            const { outputPlugin } = getOptions(
                {
                    targets: 'dist2',
                    outputPlugin: false,
                },
                {
                    pluginName: '@rollup-extras/plugin-clean',
                    deleteOnce: true,
                    verbose: false,
                    outputPlugin: true,
                },
                'targets'
            );
            expect(outputPlugin).toEqual(false);
        });
        it('3 args without defaults', () => {
            const { test2, test4 } = getOptions({ test4: 4 }, {}, 'test2');
            expect(test2).toEqual(undefined);
            expect(test4).toEqual(4);
        });
    });

    describe('getOptions with undefined as first argument', () => {
        it('all args', () => {
            const { test, test2, test3 } = getOptions(undefined, { test: 1 }, 'test2', { test3: () => 3 });
            expect(test).toBe(1);
            expect(test2).toEqual(undefined);
            expect(test3).toBe(3);
        });
        it('3 args', () => {
            const { test, test2 } = getOptions(undefined, { test: 1 }, 'test2');
            expect(test).toBe(1);
            expect(test2).toEqual(undefined);
        });
        it('3 args without defaults', () => {
            const { test2 } = getOptions(undefined, {}, 'test2');
            expect(test2).toEqual(undefined);
        });
    });
});
