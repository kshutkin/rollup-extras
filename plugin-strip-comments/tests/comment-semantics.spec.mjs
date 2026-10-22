/* biome-ignore-all lint/suspicious/noTemplateCurlyInString: fixtures contain JavaScript template expressions */
import assert from 'node:assert/strict';
import vm from 'node:vm';

import { it as test } from 'vitest';

import stripCommentsPlugin from '../src/index.js';

// Adapted from package-prune/pkgprn/tests/comment-semantics.test.js.
function stripComments(source, types) {
    return stripCommentsPlugin([...types]).renderChunk(source, { fileName: 'fixture.js' })?.code ?? source;
}

const regular = new Set(['regular']);

for (const source of [
    'const/*comment*/value = 1; value;',
    'let a = 1, b = 2; a +/*comment*/+b;',
    'function f(){return /*\ncomment\n*/ 42;} f();',
    'function f(){return /*\u2028comment*/ 42;} f();',
]) {
    test(`comment removal preserves execution: ${JSON.stringify(source)}`, () => {
        assert.equal(vm.runInNewContext(stripComments(source, regular)), vm.runInNewContext(source));
    });
}

for (const source of [
    'const s = `a\n\n\nb`; // comment\ns;',
    'const s = `a  \nb\t\n`; // comment\ns;',
    'const s = `outer ${`inner\n\n\n${1 /* comment */}`} end`; s;',
    "const s = 'a  \\\n  b'; // comment\ns;",
]) {
    test(`literal whitespace survives comment stripping: ${JSON.stringify(source)}`, () => {
        assert.equal(vm.runInNewContext(stripComments(source, regular)), vm.runInNewContext(source));
    });
}

for (const source of [
    'if (true) /[/*]/.test("*");',
    'if ((() => true)()) /[/*]/.test("*");',
    'let x = 0; while (x++ < 1) /[/*]/.test("*"); x;',
    'for (let x = 0; x < 1; x++) /[/*]/.test("*");',
    'const obj = { if: () => 4 }; obj.if() / 2; // comment',
    'const f = () => 4; f() / 2; // comment',
]) {
    test(`regex and division context survives stripping: ${source}`, () => {
        assert.equal(vm.runInNewContext(stripComments(source, regular)), vm.runInNewContext(source));
    });
}

for (const source of ['const s = `${/[/*]/.test("*") /* comment */}`; s;', 'const s = `${1} ${/[/*]/.test("*") /* comment */}`; s;']) {
    test(`regex inside template expressions survives stripping: ${source}`, () => {
        assert.equal(vm.runInNewContext(stripComments(source, regular)), vm.runInNewContext(source));
    });
}

for (const source of [
    'const n = {} / 2; const re = /[/*]/; re.test("*");',
    'const n = true ? {} / 2 : 1; const re = /[/*]/; re.test("*");',
    'const n = null || {} / 2; const re = /[/*]/; re.test("*");',
    'const n = true && {} / 2; const re = /[/*]/; re.test("*");',
    'const n = null ?? {} / 2; const re = /[/*]/; re.test("*");',
    'const n = 1 + {valueOf(){return 4;}} / 2; const re = /[/*]/; re.test("*");',
    'const n = function(){} / 2; const re = /[/*]/; re.test("*");',
    'const n = function named(){} / 2; const re = /[/*]/; re.test("*");',
    'const n = function*(){} / 2; const re = /[/*]/; re.test("*");',
    'const n = async function(){} / 2; const re = /[/*]/; re.test("*");',
    'const n = class {} / 2; const re = /[/*]/; re.test("*");',
    'const n = class Named extends class {} {} / 2; const re = /[/*]/; re.test("*");',
    'const n = class extends (function(){}) {} / 2; const re = /[/*]/; re.test("*");',
    'const n = function(a = function(){}){} / 2; const re = /[/*]/; re.test("*");',
    'for (; {} / 2;) {} /[/*]/.test("*");',
    'function f(){} /[/*]/.test("*");',
    'async function f(){} /[/*]/.test("*");',
    'class C {} /[/*]/.test("*");',
    'const f = function(){ function g(){} return /[/*]/.test("*"); }; f();',
    'const f = function(){ function g(){} /[/*]/.test("*"); }; f();',
    'const f = () => { function g(){} /[/*]/.test("*"); }; f();',
    'const n = {class: 4, function: 2}; const re = /[/*]/; re.test("*");',
    'const f = () => {}; f / 2; const re = /[/*]/; re.test("*");',
    'const obj = {return: 4}; obj.return / 2; const re = /[/*]/; re.test("*");',
    'const obj = {throw: 4}; obj.throw / 2; const re = /[/*]/; re.test("*");',
]) {
    test(`division context preserves subsequent regex: ${source}`, () => {
        assert.equal(vm.runInNewContext(stripComments(source, regular)), vm.runInNewContext(source));
    });
}
for (const terminator of ['\r', '\r\n', '\u2028', '\u2029']) {
    test(`line comments end at ${JSON.stringify(terminator)}`, () => {
        const source = `const x=1; // comment${terminator}const y=2; y;`;
        assert.equal(vm.runInNewContext(stripComments(source, regular)), vm.runInNewContext(source));
    });
}

for (const terminator of ['\r', '\r\n', '\u2028', '\u2029']) {
    for (const source of [`if${terminator}(true) /[/*]/.test('*');`, `if (true)${terminator}/[/*]/.test('*');`]) {
        test(`line terminators separate tokens without changing regex context: ${JSON.stringify(source)}`, () => {
            assert.equal(vm.runInNewContext(stripComments(source, regular)), vm.runInNewContext(source));
        });
    }
}
