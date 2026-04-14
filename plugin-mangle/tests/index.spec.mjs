import { parseAst } from 'rollup/parseAst';
import { describe, expect, it, vi } from 'vitest';

import { createLogger } from '@niceties/logger';

import plugin from '../src';

let loggerFinish, logger;

vi.mock('@niceties/logger', () => ({
    LogLevel: { verbose: 0, info: 1, warn: 2, error: 3 },
    createLogger: vi.fn(() => {
        logger = vi.fn();
        loggerFinish = vi.fn();
        return Object.assign(logger, {
            finish: loggerFinish,
            start: vi.fn(),
        });
    }),
}));

function createMockChunk(fileName = 'chunk.mjs') {
    return { fileName };
}

function makeMockContext() {
    return {
        parse(source) {
            return parseAst(source);
        },
    };
}

describe('@rollup-extras/plugin-mangle', () => {
    it('should be defined', () => {
        expect(plugin).toBeDefined();
    });

    it('should return a plugin object', () => {
        const pluginInstance = plugin();
        expect(pluginInstance).toBeDefined();
        expect(pluginInstance.name).toEqual('@rollup-extras/plugin-mangle');
    });

    it('should use default plugin name', () => {
        const pluginInstance = plugin();
        expect(pluginInstance.name).toEqual('@rollup-extras/plugin-mangle');
        expect(createLogger).toHaveBeenCalledWith('@rollup-extras/plugin-mangle');
    });

    it('should use changed plugin name', () => {
        const pluginInstance = plugin({ pluginName: 'test-mangle' });
        expect(pluginInstance.name).toEqual('test-mangle');
        expect(createLogger).toHaveBeenCalledWith('test-mangle');
    });

    it('should accept string as prefix option', () => {
        const pluginInstance = plugin('$$');
        expect(pluginInstance.name).toEqual('@rollup-extras/plugin-mangle');
    });

    it('should have renderChunk method', () => {
        const pluginInstance = plugin();
        expect(typeof pluginInstance.renderChunk).toBe('function');
    });

    describe('renderChunk', () => {
        it('should mangle member expression properties with default prefix', () => {
            const pluginInstance = plugin();
            const code = 'const x = obj.$_foo;';
            const ctx = makeMockContext();
            const result = pluginInstance.renderChunk.call(ctx, code, createMockChunk());
            expect(result.code).not.toContain('$_foo');
            expect(result.map).toBeDefined();
        });

        it('should mangle object property keys', () => {
            const pluginInstance = plugin();
            const code = 'const x = { $_foo: 1, $_bar: 2 };';
            const ctx = makeMockContext();
            const result = pluginInstance.renderChunk.call(ctx, code, createMockChunk());
            expect(result.code).not.toContain('$_foo');
            expect(result.code).not.toContain('$_bar');
        });

        it('should mangle string literals containing prefixed values', () => {
            const pluginInstance = plugin();
            const code = "const x = '$_foo';";
            const ctx = makeMockContext();
            const result = pluginInstance.renderChunk.call(ctx, code, createMockChunk());
            expect(result.code).not.toContain('$_foo');
            // Should preserve quote style
            expect(result.code).toContain("'");
        });

        it('should mangle identifiers used as variables', () => {
            const pluginInstance = plugin();
            const code = 'let $_foo = 1; console.log($_foo);';
            const ctx = makeMockContext();
            const result = pluginInstance.renderChunk.call(ctx, code, createMockChunk());
            expect(result.code).not.toContain('$_foo');
        });

        it('should not mangle properties without the prefix', () => {
            const pluginInstance = plugin();
            const code = 'const x = obj.normalProp;';
            const ctx = makeMockContext();
            const result = pluginInstance.renderChunk.call(ctx, code, createMockChunk());
            expect(result.code).toContain('normalProp');
        });

        it('should generate consistent mangled names for same property', () => {
            const pluginInstance = plugin();
            const code = 'obj.$_foo = 1; obj.$_foo = 2;';
            const ctx = makeMockContext();
            const result = pluginInstance.renderChunk.call(ctx, code, createMockChunk());
            // Both occurrences should be mangled to the same name
            const matches = result.code.match(/obj\.(\w+)/g);
            expect(matches).toHaveLength(2);
            expect(matches[0]).toEqual(matches[1]);
        });

        it('should generate different mangled names for different properties', () => {
            const pluginInstance = plugin();
            const code = 'obj.$_foo = 1; obj.$_bar = 2;';
            const ctx = makeMockContext();
            const result = pluginInstance.renderChunk.call(ctx, code, createMockChunk());
            const matches = result.code.match(/obj\.(\w+)/g);
            expect(matches).toHaveLength(2);
            expect(matches[0]).not.toEqual(matches[1]);
        });

        it('should use custom prefix', () => {
            const pluginInstance = plugin('$$');
            const code = 'const x = obj.$$foo; const y = obj.$_bar;';
            const ctx = makeMockContext();
            const result = pluginInstance.renderChunk.call(ctx, code, createMockChunk());
            // $$foo should be mangled
            expect(result.code).not.toContain('$$foo');
            // $_bar should NOT be mangled (different prefix)
            expect(result.code).toContain('$_bar');
        });

        it('should use prefix from options object', () => {
            const pluginInstance = plugin({ prefix: '$$' });
            const code = 'const x = obj.$$foo;';
            const ctx = makeMockContext();
            const result = pluginInstance.renderChunk.call(ctx, code, createMockChunk());
            expect(result.code).not.toContain('$$foo');
        });

        it('should handle shorthand properties', () => {
            const pluginInstance = plugin();
            const code = 'const $_foo = 1; const obj = { $_foo };';
            const ctx = makeMockContext();
            const result = pluginInstance.renderChunk.call(ctx, code, createMockChunk());
            expect(result.code).not.toContain('$_foo');
        });

        it('should return source map', () => {
            const pluginInstance = plugin();
            const code = 'const x = obj.$_foo;';
            const ctx = makeMockContext();
            const result = pluginInstance.renderChunk.call(ctx, code, createMockChunk());
            expect(result.map).toBeDefined();
        });

        it('should handle code with no mangeable properties', () => {
            const pluginInstance = plugin();
            const code = 'const x = 1 + 2;';
            const ctx = makeMockContext();
            const result = pluginInstance.renderChunk.call(ctx, code, createMockChunk());
            expect(result.code).toEqual(code);
        });

        it('should handle computed member expressions (string literal inside is mangled)', () => {
            const pluginInstance = plugin();
            const code = "const x = obj['$_foo'];";
            const ctx = makeMockContext();
            const result = pluginInstance.renderChunk.call(ctx, code, createMockChunk());
            // The string literal inside computed access should be mangled
            expect(result.code).not.toContain('$_foo');
        });

        it('should generate short mangled names (a, b, c, ...)', () => {
            const pluginInstance = plugin();
            const code = 'obj.$_a = 1;';
            const ctx = makeMockContext();
            const result = pluginInstance.renderChunk.call(ctx, code, createMockChunk());
            // First property should get 'a'
            expect(result.code).toContain('obj.a');
        });

        it('should persist mangled names across renderChunk calls', () => {
            const pluginInstance = plugin();
            const code1 = 'obj.$_foo = 1;';
            const code2 = 'obj.$_foo = 2;';
            const ctx1 = makeMockContext();
            const ctx2 = makeMockContext();
            const result1 = pluginInstance.renderChunk.call(ctx1, code1, createMockChunk('chunk1.mjs'));
            const result2 = pluginInstance.renderChunk.call(ctx2, code2, createMockChunk('chunk2.mjs'));
            // Same property should get same mangled name across chunks
            const match1 = result1.code.match(/obj\.(\w+)/);
            const match2 = result2.code.match(/obj\.(\w+)/);
            expect(match1[1]).toEqual(match2[1]);
        });

        it('should handle double-quoted string literals', () => {
            const pluginInstance = plugin();
            const code = 'const x = "$_foo";';
            const ctx = makeMockContext();
            const result = pluginInstance.renderChunk.call(ctx, code, createMockChunk());
            expect(result.code).not.toContain('$_foo');
            expect(result.code).toContain('"');
        });
    });
});
