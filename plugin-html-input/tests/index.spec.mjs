import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { rollup } from 'rollup';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import htmlInput from '../src/index.js';

async function writeFixture(dir, files) {
    for (const [name, content] of Object.entries(files)) {
        const p = join(dir, name);
        await writeFile(p, content, 'utf8');
    }
}

describe('@rollup-extras/plugin-html-input integration', () => {
    let tmpDir;

    beforeEach(async () => {
        tmpDir = await mkdtemp(join(tmpdir(), 'plugin-html-input-'));
    });

    afterEach(async () => {
        if (tmpDir) await rm(tmpDir, { recursive: true, force: true });
    });

    it('infers JS input from HTML rollup input and emits cleaned HTML', async () => {
        await writeFixture(tmpDir, {
            'index.html': '<!doctype html><html><head></head><body><script type="module" src="./main.js"></script></body></html>',
            'main.js': 'console.log("hello")',
        });
        const bundle = await rollup({
            input: join(tmpDir, 'index.html'),
            plugins: [htmlInput()],
        });
        const { output } = await bundle.generate({ format: 'es', dir: 'dist' });

        const jsChunk = output.find(o => o.type === 'chunk' && o.isEntry);
        expect(jsChunk).toBeDefined();
        expect(jsChunk.fileName).toMatch(/^main\.js$/);

        const htmlAsset = output.find(o => o.type === 'asset' && o.fileName === 'index.html');
        expect(htmlAsset).toBeDefined();
        expect(String(htmlAsset.source)).not.toContain('<script');
        expect(String(htmlAsset.source)).toContain('</body>');
    });

    it('accepts HTML through the plugin input option while preserving rollup input', async () => {
        await writeFixture(tmpDir, {
            'index.html': '<html><head></head><body><script type="module" src="./main.js"></script></body></html>',
            'main.js': 'console.log("html-main")',
            'extra.js': 'console.log("extra")',
        });
        const bundle = await rollup({
            input: { extra: join(tmpDir, 'extra.js') },
            plugins: [htmlInput({ input: join(tmpDir, 'index.html') })],
        });
        const { output } = await bundle.generate({ format: 'es', dir: 'dist' });
        const entries = output.filter(o => o.type === 'chunk' && o.isEntry).map(o => o.fileName);
        expect(entries).toEqual(expect.arrayContaining(['extra.js', 'main.js']));
    });

    it('does not emit the HTML asset when emit is false', async () => {
        await writeFixture(tmpDir, {
            'index.html': '<html><head></head><body><script type="module" src="./main.js"></script></body></html>',
            'main.js': 'console.log("x")',
        });
        const bundle = await rollup({
            input: join(tmpDir, 'index.html'),
            plugins: [htmlInput({ emit: false })],
        });
        const { output } = await bundle.generate({ format: 'es', dir: 'dist' });
        const htmlAsset = output.find(o => o.type === 'asset' && o.fileName === 'index.html');
        expect(htmlAsset).toBeUndefined();
    });

    it('ignores external URLs and non-module scripts by default', async () => {
        await writeFixture(tmpDir, {
            'index.html': [
                '<html><head>',
                '<script src="https://cdn.example.com/lib.js"></script>',
                '<script src="./legacy.js"></script>',
                '<script type="module" src="./main.js"></script>',
                '</head><body></body></html>',
            ].join(''),
            'main.js': 'console.log(1)',
            'legacy.js': 'console.log(2)',
        });
        const bundle = await rollup({
            input: join(tmpDir, 'index.html'),
            plugins: [htmlInput()],
        });
        const { output } = await bundle.generate({ format: 'es', dir: 'dist' });
        const entries = output.filter(o => o.type === 'chunk' && o.isEntry).map(o => o.fileName);
        expect(entries).toEqual(['main.js']);

        const htmlAsset = output.find(o => o.type === 'asset' && o.fileName === 'index.html');
        expect(String(htmlAsset.source)).toContain('https://cdn.example.com/lib.js');
        expect(String(htmlAsset.source)).toContain('./legacy.js');
        expect(String(htmlAsset.source)).not.toContain('./main.js');
    });

    it('removes non-matched local scripts when removeNonMatched is true', async () => {
        await writeFixture(tmpDir, {
            'index.html': [
                '<html><head>',
                '<script src="https://cdn.example.com/lib.js"></script>',
                '<script src="./legacy.js"></script>',
                '<script type="module" src="./main.js"></script>',
                '</head><body></body></html>',
            ].join(''),
            'main.js': 'console.log(1)',
            'legacy.js': 'console.log(2)',
        });
        const bundle = await rollup({
            input: join(tmpDir, 'index.html'),
            plugins: [htmlInput({ removeNonMatched: true })],
        });
        const { output } = await bundle.generate({ format: 'es', dir: 'dist' });
        const htmlAsset = output.find(o => o.type === 'asset' && o.fileName === 'index.html');
        expect(String(htmlAsset.source)).toContain('https://cdn.example.com/lib.js');
        expect(String(htmlAsset.source)).not.toContain('./legacy.js');
        expect(String(htmlAsset.source)).not.toContain('./main.js');
    });

    it('supports multiple HTML inputs with MPA-style relative paths', async () => {
        await writeFixture(tmpDir, {
            'main.js': 'console.log("m")',
            'nested.js': 'console.log("n")',
        });
        // nested page
        const nestedDir = join(tmpDir, 'nested');
        await rm(nestedDir, { recursive: true, force: true }).catch(() => {});
        await (await import('node:fs/promises')).mkdir(nestedDir, { recursive: true });
        await writeFixture(tmpDir, {
            'index.html': '<html><head></head><body><script type="module" src="./main.js"></script></body></html>',
        });
        await writeFixture(nestedDir, {
            'index.html': '<html><head></head><body><script type="module" src="./nested.js"></script></body></html>',
            'nested.js': 'console.log("nested")',
        });
        const bundle = await rollup({
            input: [join(tmpDir, 'index.html'), join(nestedDir, 'index.html')],
            plugins: [htmlInput()],
        });
        const { output } = await bundle.generate({ format: 'es', dir: 'dist' });
        const assetNames = output
            .filter(o => o.type === 'asset')
            .map(o => o.fileName)
            .sort();
        expect(assetNames).toEqual(['index.html', 'nested/index.html']);
    });

    it('is a no-op when there are no HTML inputs', async () => {
        await writeFixture(tmpDir, { 'main.js': 'console.log("only js")' });
        const bundle = await rollup({
            input: join(tmpDir, 'main.js'),
            plugins: [htmlInput()],
        });
        const { output } = await bundle.generate({ format: 'es', dir: 'dist' });
        expect(output.find(o => o.type === 'chunk' && o.isEntry).fileName).toBe('main.js');
        expect(output.find(o => o.type === 'asset')).toBeUndefined();
    });
});
