import { describe, expect, it } from 'vitest';

import { shebang } from '../src/factories';

describe('@rollup-extras/plugin-binify/factories', () => {
    it('should add at least one new line', () => {
        expect(shebang({ shebang: 'sdfsdf' })).toEqual('sdfsdf\n');
    });

    it('should not add new line if already present', () => {
        expect(shebang({ shebang: 'asdasasdasd\n' })).toEqual('asdasasdasd\n');
    });

    it('should preserve existing new lines', () => {
        expect(shebang({ shebang: 'asdasasdasd\n\n' })).toEqual('asdasasdasd\n\n');
    });

    it('should only care about line ending, not newlines in the middle', () => {
        expect(shebang({ shebang: 'asdasa\n\nsdasd' })).toEqual('asdasa\n\nsdasd\n');
    });
});
