import { rollup } from 'rollup';
import { describe, expect, it } from 'vitest';

import stripComments from '../src/index.js';

function virtual(modules) {
    return {
        name: 'virtual-input',
        resolveId(id) {
            if (modules[id]) return id;
        },
        load(id) {
            if (modules[id]) return modules[id];
        },
    };
}

async function build(code, pluginOptions, outputOptions = {}) {
    const bundle = await rollup({
        input: 'entry',
        plugins: [virtual({ entry: code })],
    });
    const { output } = await bundle.generate({
        format: 'es',
        plugins: [stripComments(pluginOptions)],
        ...outputOptions,
    });
    return output;
}

describe('@rollup-extras/plugin-strip-comments', () => {
    it('should strip regular line comments by default', async () => {
        const output = await build('// hello\nexport default 1;');
        expect(output[0].code).not.toContain('// hello');
    });

    it('should strip regular block comments by default', async () => {
        const output = await build('/* hello */\nexport default 1;');
        expect(output[0].code).not.toContain('hello');
    });

    it('should strip jsdoc comments by default', async () => {
        const output = await build('/** jsdoc */\nexport default 1;');
        expect(output[0].code).not.toContain('jsdoc');
    });

    it('should preserve license comments (/*! ... */) by default', async () => {
        const output = await build('/*! my license */\nexport default 1;');
        expect(output[0].code).toContain('my license');
    });

    it('should preserve comments containing @license by default', async () => {
        const output = await build('/* @license MIT */\nexport default 1;');
        expect(output[0].code).toContain('@license');
    });

    it('should preserve comments containing @preserve by default', async () => {
        const output = await build('/* @preserve copyright */\nexport default 1;');
        expect(output[0].code).toContain('@preserve');
    });

    it('should preserve annotation comments like /*#__PURE__*/ by default', async () => {
        const output = await build('export default /*#__PURE__*/ (() => 1)();');
        expect(output[0].code).toContain('#__PURE__');
    });

    it('should strip license comments when types includes license', async () => {
        const output = await build('/*! my license */\nexport default 1;', ['license']);
        expect(output[0].code).not.toContain('my license');
    });

    it('should strip @license comments when types includes license', async () => {
        const output = await build('/* @license MIT */\nexport default 1;', ['license']);
        expect(output[0].code).not.toContain('@license');
    });

    it('should strip annotation comments when types includes annotation', async () => {
        const output = await build('export default /*#__PURE__*/ (() => 1)();', ['annotation']);
        expect(output[0].code).not.toContain('#__PURE__');
    });

    it('should accept a single comment type as a string shorthand', async () => {
        const output = await build('// regular\n/*! license */\nexport default 1;', 'license');
        expect(output[0].code).not.toContain('license');
        expect(output[0].code).toContain('// regular');
    });

    it('should accept `true` shorthand (equivalent to default)', async () => {
        const output = await build('// hello\nexport default 1;', true);
        expect(output[0].code).not.toContain('// hello');
    });

    it('should accept an options object with types', async () => {
        const output = await build('/*! license */\nexport default 1;', { types: ['license'] });
        expect(output[0].code).not.toContain('license');
    });

    it('should not touch // sequences inside string literals', async () => {
        const output = await build('export default "http://example.com";');
        expect(output[0].code).toContain('http://example.com');
    });

    it('should not misidentify division as a regex literal', async () => {
        const output = await build('const a = 1; const b = 2; const c = a / b; // gone\nexport default c;');
        expect(output[0].code).not.toContain('// gone');
        expect(output[0].code).toContain('a / b');
    });

    it('should not touch comments inside regex literals', async () => {
        const output = await build('const re = /a\\/\\/b/; export default re;');
        expect(output[0].code).toContain('/a\\/\\/b/');
    });

    it('should not touch // inside template literals', async () => {
        // biome-ignore lint/suspicious/noTemplateCurlyInString: source code passed to build
        const output = await build('const x = 1; export default `//${x}`;');
        expect(output[0].code).toContain('//');
    });

    it('should pass code through unchanged when there are no comments', async () => {
        const output = await build('export default 1 + 2;');
        expect(output[0].code).toContain('1 + 2');
    });

    it('should produce a sourcemap with mappings when sourcemap is enabled', async () => {
        const output = await build('// comment\nconst x = 1;\nexport default x;', undefined, { sourcemap: true });
        expect(output[0].map).toBeDefined();
        expect(output[0].map).not.toBeNull();
        expect(output[0].map.mappings).toBeTruthy();
    });

    it('should use the default plugin name when no pluginName option is provided', () => {
        expect(stripComments().name).toBe('@rollup-extras/plugin-strip-comments');
    });

    it('should use a custom plugin name when pluginName option is provided', () => {
        expect(stripComments({ pluginName: 'my-strip' }).name).toBe('my-strip');
    });

    it('should throw on unknown comment type', () => {
        expect(() => stripComments({ types: ['bogus'] })).toThrow(/unknown comment type/);
    });

    it('should strip multiple comments in a single chunk', async () => {
        const output = await build('// one\n// two\n/* three */\nexport default 1;');
        expect(output[0].code).not.toContain('one');
        expect(output[0].code).not.toContain('two');
        expect(output[0].code).not.toContain('three');
    });

    it('should handle hashbang lines correctly', async () => {
        const output = await build('#!/usr/bin/env node\n// comment\nexport default 1;');
        expect(output[0].code).not.toContain('// comment');
    });

    it('should strip both jsdoc and regular by default but keep license and annotation', async () => {
        const input = [
            '/** jsdoc */',
            '// regular',
            '/*! license */',
            'export const x = /*#__PURE__*/ (() => 1)();',
            'export default x;',
        ].join('\n');
        const output = await build(input);
        expect(output[0].code).not.toContain('jsdoc');
        expect(output[0].code).not.toContain('regular');
        expect(output[0].code).toContain('license');
        expect(output[0].code).toContain('#__PURE__');
    });
});
