import { rollup } from 'rollup';
import { describe, expect, it } from 'vitest';

import mangle from '../src/index.js';

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

async function build(code, mangleOptions, outputOptions = {}) {
    const bundle = await rollup({
        input: 'entry',
        plugins: [virtual({ entry: code }), mangle(mangleOptions)],
    });
    const { output } = await bundle.generate({ format: 'es', ...outputOptions });
    return output;
}

describe('@rollup-extras/plugin-mangle', () => {
    it('should mangle member expression properties (obj.$_prop)', async () => {
        const output = await build('export const x = { $_prop: 1 }; x.$_prop;');
        expect(output[0].code).not.toContain('$_prop');
        expect(output[0].code).toContain('.a');
    });

    it('should mangle object literal keys ({ $_prop: 1 })', async () => {
        const output = await build('export default { $_prop: 1 };');
        expect(output[0].code).not.toContain('$_prop');
        expect(output[0].code).toMatch(/{\s*a:\s*1\s*}/);
    });

    it('should mangle string literals containing prefixed names', async () => {
        const output = await build("export default '$_prop';");
        expect(output[0].code).not.toContain('$_prop');
        expect(output[0].code).toContain("'a'");
    });

    it('should mangle identifiers used as variables', async () => {
        const output = await build('let $_x = 1; export default $_x;');
        expect(output[0].code).not.toContain('$_x');
        // The variable should be renamed to a short name
        expect(output[0].code).toMatch(/let a\b/);
    });

    it('should produce consistent mangled names for the same property', async () => {
        const output = await build('const obj = {}; obj.$_prop = 1; obj.$_prop = 2; export default obj;');
        expect(output[0].code).not.toContain('$_prop');
        const matches = output[0].code.match(/obj\.(\w+)/g);
        expect(matches.length).toBeGreaterThanOrEqual(2);
        // All occurrences should use the same mangled name
        const unique = new Set(matches);
        expect(unique.size).toBe(1);
    });

    it('should not change properties without the prefix', async () => {
        const output = await build('const obj = {}; obj.normalProp = 1; export default obj;');
        expect(output[0].code).toContain('normalProp');
    });

    it('should accept a custom prefix option as a string', async () => {
        const output = await build('const obj = {}; obj.$$foo = 1; obj.$_bar = 2; export default obj;', '$$');
        // $$foo should be mangled
        expect(output[0].code).not.toContain('$$foo');
        // $_bar should NOT be mangled because prefix is $$
        expect(output[0].code).toContain('$_bar');
    });

    it('should accept a custom prefix option in options object', async () => {
        const output = await build('const obj = {}; obj.$$foo = 1; export default obj;', { prefix: '$$' });
        expect(output[0].code).not.toContain('$$foo');
    });

    it('should produce a sourcemap when sourcemap: true', async () => {
        const output = await build('const obj = {}; obj.$_prop = 1; export default obj;', undefined, { sourcemap: true });
        expect(output[0].map).toBeDefined();
        expect(output[0].map).not.toBeNull();
        expect(output[0].map.mappings).toBeTruthy();
    });

    it('should assign different mangled names to different properties', async () => {
        const output = await build('const obj = {}; obj.$_foo = 1; obj.$_bar = 2; export default obj;');
        expect(output[0].code).not.toContain('$_foo');
        expect(output[0].code).not.toContain('$_bar');
        const matches = output[0].code.match(/obj\.(\w+)/g);
        expect(matches.length).toBeGreaterThanOrEqual(2);
        // The two properties should map to different names
        const unique = new Set(matches);
        expect(unique.size).toBe(2);
    });

    it('should handle code with no mangleable references', async () => {
        const output = await build('export default 1 + 2;');
        expect(output[0].code).toContain('1 + 2');
    });

    it('should persist mangled names across chunks', async () => {
        const modules = {
            entry: "export { default as a } from 'mod'; export const obj = {}; obj.$_foo = 1;",
            mod: 'const obj = {}; obj.$_foo = 2; export default obj;',
        };
        const bundle = await rollup({
            input: 'entry',
            plugins: [virtual(modules), mangle()],
        });
        const { output } = await bundle.generate({
            format: 'es',
            manualChunks: { vendor: ['mod'] },
        });
        // Both chunks should use the same mangled name for $_foo
        const allCode = output.map(o => o.code).join('\n');
        expect(allCode).not.toContain('$_foo');
    });

    it('should expand shorthand properties when mangling', async () => {
        const output = await build('const obj = { $_prop: 1 }; const { $_prop } = obj; export default $_prop;');
        expect(output[0].code).not.toContain('$_prop');
        // shorthand { $_prop } should become { a: a } not just { a }
        expect(output[0].code).not.toMatch(/\{\s*a\s*\}/);
    });

    it('should mangle double-quote string literals preserving double quotes', async () => {
        const output = await build('export default "$_prop";');
        expect(output[0].code).not.toContain('$_prop');
        expect(output[0].code).toContain('"a"');
    });

    it('should mangle computed member expression with variable (obj[$_prop])', async () => {
        const output = await build("const $_prop = 'key'; const obj = {}; const val = obj[$_prop]; export default val;");
        // $_prop is a variable, so it should be mangled
        expect(output[0].code).not.toContain('$_prop');
    });

    it('should generate two-letter names when more than 26 identifiers are used', async () => {
        const code = `let $_v0 = 0; let $_v1 = 1; let $_v2 = 2; let $_v3 = 3; let $_v4 = 4; let $_v5 = 5; let $_v6 = 6; let $_v7 = 7; let $_v8 = 8; let $_v9 = 9; let $_v10 = 10; let $_v11 = 11; let $_v12 = 12; let $_v13 = 13; let $_v14 = 14; let $_v15 = 15; let $_v16 = 16; let $_v17 = 17; let $_v18 = 18; let $_v19 = 19; let $_v20 = 20; let $_v21 = 21; let $_v22 = 22; let $_v23 = 23; let $_v24 = 24; let $_v25 = 25; let $_v26 = 26; export default $_v0 + $_v1 + $_v2 + $_v3 + $_v4 + $_v5 + $_v6 + $_v7 + $_v8 + $_v9 + $_v10 + $_v11 + $_v12 + $_v13 + $_v14 + $_v15 + $_v16 + $_v17 + $_v18 + $_v19 + $_v20 + $_v21 + $_v22 + $_v23 + $_v24 + $_v25 + $_v26;`;
        const output = await build(code);
        // None of the original names should remain
        for (let i = 0; i < 27; i++) {
            expect(output[0].code).not.toContain(`$_v${i}`);
        }
        // The 27th identifier should get a two-letter name like 'aa'
        expect(output[0].code).toContain('aa');
    });

    it('should mangle function parameters', async () => {
        const output = await build('function foo($_param) { return $_param; } export default foo(1);');
        expect(output[0].code).not.toContain('$_param');
    });

    it('should have default pluginName', () => {
        expect(mangle().name).toBe('@rollup-extras/plugin-mangle');
    });

    it('should accept custom pluginName', () => {
        expect(mangle({ pluginName: 'my-mangle' }).name).toBe('my-mangle');
    });

    it('should mangle destructuring pattern property key ({ $_prop: localVar })', async () => {
        const output = await build('const obj = { $_prop: 42 }; const { $_prop: localVar } = obj; export default localVar;');
        expect(output[0].code).not.toContain('$_prop');
    });

    it('should NOT mangle template literals', async () => {
        const output = await build('export default `$_prop`;');
        // Template literals are TemplateLiteral nodes, not Literal - should not be mangled
        expect(output[0].code).toContain('$_prop');
    });

    it('should populate sourcemap sources when mangling with sourcemap: true', async () => {
        const output = await build('const obj = {}; obj.$_prop = 1; export default obj;', undefined, { sourcemap: true });
        expect(output[0].map).toBeDefined();
        expect(output[0].map).not.toBeNull();
        // sources should be populated
        const hasSources = output[0].map.sources && output[0].map.sources.length > 0;
        const hasFile = output[0].map.file && output[0].map.file.length > 0;
        expect(hasSources || hasFile).toBe(true);
    });
});
