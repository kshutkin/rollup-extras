import { shebang } from '../src/factories';

describe('@rollup-extras/plugin-binify/factories', () => {

    it('smoke', () => {
        expect(shebang).toBeDefined();
    });

    it('at least one new line', () => {
        expect(shebang({ shebang: 'sdfsdf' })).toEqual('sdfsdf\n');
    });

    it('no new new line', () => {
        expect(shebang({ shebang: 'asdasasdasd\n' })).toEqual('asdasasdasd\n');
    });

    it('preserves new lines', () => {
        expect(shebang({ shebang: 'asdasasdasd\n\n' })).toEqual('asdasasdasd\n\n');
    });

    it('don\'t care about newlines in the middle but care about line ending', () => {
        expect(shebang({ shebang: 'asdasa\n\nsdasd' })).toEqual('asdasa\n\nsdasd\n');
    });
});