import { test } from '../src';

describe('hello test', () => {

    it('smoke', () => {
        expect(test).toBeDefined();
    });

    it('hello!', () => {
        expect(test).toEqual('Hello world!');
    });
});
