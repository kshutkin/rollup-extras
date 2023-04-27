import statistics from '../src/statistics';

describe('@rollup-extras/util/statistics', () => {

    it('smoke', () => {
        expect(statistics).toBeDefined();
    });

    describe('statistics non verbose', () => {

        it('less than cap', () => {
            const collector = statistics(false, (result) => JSON.stringify(result));

            collector('test1');
            collector('test2');

            expect(collector()).toEqual('["test1","test2"]');
        });

        it('more than cap', () => {
            const collector = statistics(false, (result) => JSON.stringify(result));

            collector('test1');
            collector('test2');
            collector('test3');
            collector('test4');
            collector('test5');
            collector('test6');

            expect(collector()).toEqual('6');
        });

    });

    describe('statistics verbose', () => {

        it('less than cap', () => {
            const collector = statistics(true, (result) => JSON.stringify(result));

            collector('test1');
            collector('test2');

            expect(collector()).toEqual('2');
        });

        it('more than cap', () => {
            const collector = statistics(true, (result) => JSON.stringify(result));

            collector('test1');
            collector('test2');
            collector('test3');
            collector('test4');
            collector('test5');
            collector('test6');

            expect(collector()).toEqual('6');
        });

    });

});