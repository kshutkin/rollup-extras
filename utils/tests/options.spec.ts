import { getOptions, getOptionsObject } from '../src';

type AssertEqual<T, Expected> =
  T extends Expected
  ? (Expected extends T ? true : never)
  : never;

describe('@rollup-extras/util/mutli-config-plugin-base', () => {

    it('smoke', () => {
        expect(getOptions).toBeDefined();
        expect(getOptionsObject).toBeDefined();
    });

    describe('getOptionsObject', () => {

        it('all args', () => {
            const { test, test2, test3 } = getOptionsObject({
                test: 1
            } as { test: number, test3?: number }, {
                test2: 2
            }, {
                test3: () => 3
            });

            const cond1: AssertEqual<typeof test3, number> = true;
            const cond2: AssertEqual<typeof test3, number> = true;
            const cond3: AssertEqual<typeof test3, number> = true;

            expect(cond1).toBe(true);
            expect(cond2).toBe(true);
            expect(cond3).toBe(true);

            expect(test).toBe(1);
            expect(test2).toBe(2);
            expect(test3).toBe(3);
        });

        it('override defaults', () => {
            const { test } = getOptionsObject({
                test: 1
            } as { test: number, test3?: number }, {
                test: 2
            }, {
                test2: () => 3
            });

            expect(test).toBe(1);
        });

        it('override using factory', () => {
            const { test } = getOptionsObject({
                test: 1
            } as { test: number, test3?: number }, {
                test: 2
            }, {
                test: () => 3
            });

            expect(test).toBe(3);
        });

        it('2 args', () => {
            const { test, test2, test3 } = getOptionsObject({
                test: 1
            } as { test: number, test3?: number }, {
                test2: 2
            });

            const cond1: AssertEqual<typeof test, number> = true;
            const cond2: AssertEqual<typeof test2, number> = true;
            const cond3: AssertEqual<typeof test3, undefined > = true;
            const cond4: AssertEqual<typeof test3, number> = true;

            expect(cond1).toBe(true);
            expect(cond2).toBe(true);
            expect(cond3).toBe(true);
            expect(cond4).toBe(true);

            expect(test).toBe(1);
            expect(test2).toBe(2);
            expect(test3).toBe(undefined);
        });

        it('1 arg', () => {
            const { test, test3 } = getOptionsObject({
                test: 1
            } as { test: number, test3?: number });

            const cond1: AssertEqual<typeof test3, undefined > = true;
            const cond2: AssertEqual<typeof test3, number> = true;

            expect(cond1).toBe(true);
            expect(cond2).toBe(true);

            expect(test).toBe(1);
            expect(test3).toBe(undefined);
        });

    });

    describe('getOptions with string as first argument', () => {

        it('all args', () => {
            const {test, test2, test3} = getOptions('2' as string | Record<string, unknown>, {test: 1}, 'test2', {
                test3: () => 3
            });

            const cond1: AssertEqual<typeof test, number> = true;
            const cond2: AssertEqual<typeof test2, string[]> = true;
            const cond3: AssertEqual<typeof test3, number> = true;

            expect(cond1).toBe(true);
            expect(cond2).toBe(true);
            expect(cond3).toBe(true);

            expect(test).toBe(1);
            expect(test2).toEqual(['2']);
            expect(test3).toBe(3);
        });

        it('3 args', () => {
            const {test, test2} = getOptions('2' as string | Record<string, unknown>, {test: 1}, 'test2');

            const cond1: AssertEqual<typeof test, number> = true;
            const cond2: AssertEqual<typeof test2, string[]> = true;

            expect(cond1).toBe(true);
            expect(cond2).toBe(true);

            expect(test).toBe(1);
            expect(test2).toEqual(['2']);
        });

        it('3 args without defaults', () => {
            const {test2} = getOptions('2' as string | Record<string, unknown>, {}, 'test2');

            const cond1: AssertEqual<typeof test2, string[]> = true;

            expect(cond1).toBe(true);

            expect(test2).toEqual(['2']);
        });

    });

    describe('getOptions with [string] as first argument', () => {

        it('all args', () => {
            const {test, test2, test3} = getOptions(['2'] as string[] | Record<string, unknown>, {test: 1}, 'test2', {
                test3: () => 3
            });

            const cond1: AssertEqual<typeof test, number> = true;
            const cond2: AssertEqual<typeof test2, string[]> = true;
            const cond3: AssertEqual<typeof test3, number> = true;

            expect(cond1).toBe(true);
            expect(cond2).toBe(true);
            expect(cond3).toBe(true);

            expect(test).toBe(1);
            expect(test2).toEqual(['2']);
            expect(test3).toBe(3);
        });

        it('3 args', () => {
            const {test, test2} = getOptions(['2'] as string[] | Record<string, unknown>, {test: 1}, 'test2');

            const cond1: AssertEqual<typeof test, number> = true;
            const cond2: AssertEqual<typeof test2, string[]> = true;

            expect(cond1).toBe(true);
            expect(cond2).toBe(true);

            expect(test).toBe(1);
            expect(test2).toEqual(['2']);
        });

        it('3 args without defaults', () => {
            const {test2} = getOptions(['2'] as string[] | Record<string, unknown>, {}, 'test2');

            const cond1: AssertEqual<typeof test2, string[]> = true;

            expect(cond1).toBe(true);

            expect(test2).toEqual(['2']);
        });

    });

    describe('getOptions with object with string property as first argument', () => {

        it('all args', () => {
            const {test, test2, test3} = getOptions({test2: '2'} as string[] | Record<string, unknown>, {test: 1}, 'test2', {
                test3: () => 3
            });

            const cond1: AssertEqual<typeof test, number> = true;
            const cond2: AssertEqual<typeof test2, string[]> = true;
            const cond3: AssertEqual<typeof test3, number> = true;

            expect(cond1).toBe(true);
            expect(cond2).toBe(true);
            expect(cond3).toBe(true);

            expect(test).toBe(1);
            expect(test2).toEqual(['2']);
            expect(test3).toBe(3);
        });

        it('3 args', () => {
            const {test, test2} = getOptions({test2: '2'} as string[] | Record<string, unknown>, {test: 1}, 'test2');

            const cond1: AssertEqual<typeof test, number> = true;
            const cond2: AssertEqual<typeof test2, string[]> = true;

            expect(cond1).toBe(true);
            expect(cond2).toBe(true);

            expect(test).toBe(1);
            expect(test2).toEqual(['2']);
        });

        it('3 args without defaults', () => {
            const {test2} = getOptions({test2: '2'} as string[] | Record<string, unknown>, {}, 'test2');

            const cond1: AssertEqual<typeof test2, string[]> = true;

            expect(cond1).toBe(true);

            expect(test2).toEqual(['2']);
        });

    });

    describe('getOptions with object with string[] property as first argument', () => {

        it('all args', () => {
            const {test, test2, test3} = getOptions({test2: ['2']} as string[] | Record<string, unknown>, {test: 1}, 'test2', {
                test3: () => 3
            });

            const cond1: AssertEqual<typeof test, number> = true;
            const cond2: AssertEqual<typeof test2, string[]> = true;
            const cond3: AssertEqual<typeof test3, number> = true;

            expect(cond1).toBe(true);
            expect(cond2).toBe(true);
            expect(cond3).toBe(true);

            expect(test).toBe(1);
            expect(test2).toEqual(['2']);
            expect(test3).toBe(3);
        });

        it('3 args', () => {
            const {test, test2} = getOptions({test2: ['2']} as string[] | Record<string, unknown>, {test: 1}, 'test2');

            const cond1: AssertEqual<typeof test, number> = true;
            const cond2: AssertEqual<typeof test2, string[]> = true;

            expect(cond1).toBe(true);
            expect(cond2).toBe(true);

            expect(test).toBe(1);
            expect(test2).toEqual(['2']);
        });

        it('3 args without defaults', () => {
            const {test2} = getOptions({test2: ['2']} as string[] | Record<string, unknown>, {}, 'test2');

            const cond1: AssertEqual<typeof test2, string[]> = true;

            expect(cond1).toBe(true);

            expect(test2).toEqual(['2']);
        });

    });

    describe('getOptions with object with undefined property as first argument', () => {

        it('all args', () => {
            const {test, test2, test3, test4} = getOptions({test4: 4} as string[] | {test4: number}, {test: 1}, 'test2', {
                test3: () => 3
            });

            const cond1: AssertEqual<typeof test, number> = true;
            const cond2: AssertEqual<typeof test2, undefined> = true;
            const cond3: AssertEqual<typeof test3, number> = true;
            const cond4: AssertEqual<typeof test4, number> = true;

            expect(cond1).toBe(true);
            expect(cond2).toBe(true);
            expect(cond3).toBe(true);
            expect(cond4).toBe(true);

            expect(test).toBe(1);
            expect(test2).toEqual(undefined);
            expect(test3).toBe(3);
            expect(test4).toBe(4);
        });

        it('3 args', () => {
            const {test, test2, test4} = getOptions({test4: 4} as string[] | {test4: number}, {test: 1}, 'test2');

            const cond1: AssertEqual<typeof test, number> = true;
            const cond2: AssertEqual<typeof test2, undefined> = true;
            const cond3: AssertEqual<typeof test4, number> = true;

            expect(cond1).toBe(true);
            expect(cond2).toBe(true);
            expect(cond3).toBe(true);

            expect(test).toBe(1);
            expect(test2).toEqual(undefined);
            expect(test4).toEqual(4);
        });

        it('plugin-clean failed case', () => {
            const {outputPlugin} = getOptions({
                targets: 'dist2',
                outputPlugin: false
            }, {
                pluginName: '@rollup-extras/plugin-clean',
                deleteOnce: true,
                verbose: false,
                outputPlugin: true
            }, 'targets');

            expect(outputPlugin).toEqual(false);
        });

        it('3 args without defaults', () => {
            const {test2, test4} = getOptions({test4: 4} as string[] | {test4: number}, {}, 'test2');

            const cond1: AssertEqual<typeof test2, undefined> = true;
            const cond2: AssertEqual<typeof test4, number> = true;

            expect(cond1).toBe(true);
            expect(cond2).toBe(true);

            expect(test2).toEqual(undefined);
            expect(test4).toEqual(4);
        });

    });

    describe('getOptions with undefined as first argument', () => {

        it('all args', () => {
            const {test, test2, test3} = getOptions(undefined as undefined | Record<string, unknown>, {test: 1}, 'test2', {
                test3: () => 3
            });

            const cond1: AssertEqual<typeof test, number> = true;
            const cond2: AssertEqual<typeof test2, undefined> = true;
            const cond3: AssertEqual<typeof test3, number> = true;

            expect(cond1).toBe(true);
            expect(cond2).toBe(true);
            expect(cond3).toBe(true);

            expect(test).toBe(1);
            expect(test2).toEqual(undefined);
            expect(test3).toBe(3);
        });

        it('3 args', () => {
            const {test, test2} = getOptions(undefined as undefined | Record<string, unknown>, {test: 1}, 'test2');

            const cond1: AssertEqual<typeof test, number> = true;
            const cond2: AssertEqual<typeof test2, undefined> = true;

            expect(cond1).toBe(true);
            expect(cond2).toBe(true);

            expect(test).toBe(1);
            expect(test2).toEqual(undefined);
        });

        it('3 args without defaults', () => {
            const {test2} = getOptions(undefined as undefined | Record<string, unknown>, {}, 'test2');

            const cond1: AssertEqual<typeof test2, undefined> = true;

            expect(cond1).toBe(true);

            expect(test2).toEqual(undefined);
        });

    });

});