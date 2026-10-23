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
    'label: {} /[/*]/.test("*");',
    'outer: inner: {} /[/*]/.test("*");',
    'label /* comment */: {} /[/*]/.test("*");',
    'switch(1) { case 1: {} /[/*]/.test("*"); }',
    'switch(1) { default: {} /[/*]/.test("*"); }',
    'switch(1) { case true ? 1 : 2: {} /[/*]/.test("*"); }',
    'switch(1) { case ({value: 1}).value: {} /[/*]/.test("*"); }',
    'switch(1) { case 1: switch(2) { case 2: {} /[/*]/.test("*"); } /[/*]/.test("*"); }',
    'switch(1) { case (null ?? 1): {} /[/*]/.test("*"); }',
    'switch(1) { case ({value: 1})?.value: {} /[/*]/.test("*"); }',
    'const n = true ? 1 : {} / 2; /[/*]/.test("*");',
    'const n = {value: {} / 2}; /[/*]/.test("*");',
    'const n = {case: {} / 2, default: {} / 2}; /[/*]/.test("*");',
    'const f = function(){ label: {} return /[/*]/.test("*"); }; f();',
]) {
    test(`statement and expression colons survive stripping: ${source}`, () => {
        assert.equal(vm.runInNewContext(stripComments(source, regular)), vm.runInNewContext(source));
    });
}

for (const quote of ["'", '"']) {
    for (const separator of ['\u2028', '\u2029', '\\\n', '\\\r', '\\\r\n', '\\\u2028', '\\\u2029']) {
        const literal = `${quote}a${separator}//b/* c */${quote}`;
        const source = `const s = ${literal}; s; // remove`;
        test(`quoted strings preserve separators: ${JSON.stringify(source)}`, () => {
            const stripped = stripComments(source, regular);
            assert.equal(vm.runInNewContext(stripped), vm.runInNewContext(source));
            assert.equal(stripped, `const s = ${literal}; s;  `);
        });
    }
}

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
    'do /[/*]/.test("*"); while(false);',
    'const of = 4; of / 2; const re = /[/*]/; re.test("*");',
    'const of = 4; for (; of / 2;) { break; } /[/*]/.test("*");',
    'for (const x of /[/*]/.source) {} /[/*]/.test("*");',
    'for (const of of /[/*]/.source) {} /[/*]/.test("*");',
    'let of; for (of of /[/*]/.source) {} /[/*]/.test("*");',
    'for (const {of} of [{of: 4}]) { of / 2; } /[/*]/.test("*");',
    'const of = [2]; for (const x of of) { x / 2; } /[/*]/.test("*");',
    'let of = 4; for (of / 2; false;) {} /[/*]/.test("*");',
    'async function f(){ for await (const of of /[/*]/.source) {} } /[/*]/.test("*");',
    'function f(){ const x = 4; return x\n/2; } f();',
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

for (const terminator of ['\n', '\r', '\r\n', '\u2028', '\u2029', '/*\n*/']) {
    for (const keyword of ['break', 'break outer', 'continue', 'continue outer']) {
        const source = `outer: for(let i=0;i<1;i++){${keyword}${terminator}/[/*]/.test('*');} true;`;
        test(`jump statement ends at ${JSON.stringify(terminator)} after ${keyword}`, () => {
            assert.equal(vm.runInNewContext(stripComments(source, regular)), vm.runInNewContext(source));
        });
    }
    for (const source of [`debugger${terminator}/[/*]/.test('*');`, `function f(){ return${terminator}{} /[/*]/.test('*'); } f();`]) {
        test(`restricted statement boundary preserves regex context: ${JSON.stringify(source)}`, () => {
            assert.equal(vm.runInNewContext(stripComments(source, regular)), vm.runInNewContext(source));
        });
    }
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

for (const separator of [
    '\t',
    '\v',
    '\f',
    ' ',
    '\n',
    '\r',
    '\r\n',
    '\u00a0',
    '\u1680',
    '\u2000',
    '\u2001',
    '\u2002',
    '\u2003',
    '\u2004',
    '\u2005',
    '\u2006',
    '\u2007',
    '\u2008',
    '\u2009',
    '\u200a',
    '\u2028',
    '\u2029',
    '\u202f',
    '\u205f',
    '\u3000',
    '\ufeff',
]) {
    for (const source of [`if${separator}(true) /[/*]/.test('*');`, `if (true)${separator}/[/*]/.test('*');`]) {
        test(`whitespace separates tokens without changing regex context: ${JSON.stringify(source)}`, () => {
            assert.equal(vm.runInNewContext(stripComments(source, regular)), vm.runInNewContext(source));
        });
    }
}
