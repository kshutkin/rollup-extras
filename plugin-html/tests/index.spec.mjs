import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { rollup } from 'rollup';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import html from '../src/index.js';

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

function emitCss(fileName, source) {
    return {
        name: 'emit-css',
        generateBundle() {
            this.emitFile({ type: 'asset', fileName, source });
        },
    };
}
describe('@rollup-extras/plugin-html integration', () => {
    let tmpDir;

    beforeEach(async () => {
        tmpDir = await mkdtemp(join(tmpdir(), 'plugin-html-test-'));
    });

    afterEach(async () => {
        if (tmpDir) {
            await rm(tmpDir, { recursive: true, force: true });
        }
    });

    it('should generate index.html with a module script tag for ES format', async () => {
        const bundle = await rollup({
            input: 'entry',
            plugins: [virtual({ entry: 'console.log("hello")' }), html()],
        });
        const { output } = await bundle.generate({ format: 'es', dir: 'dist' });

        const htmlAsset = output.find(item => item.fileName === 'index.html');
        expect(htmlAsset).toBeDefined();
        expect(htmlAsset.type).toBe('asset');
        expect(htmlAsset.source).toContain('<script');
        expect(htmlAsset.source).toContain('type="module"');
        expect(htmlAsset.source).toContain('entry.js');
        expect(htmlAsset.source).toContain('</head>');
        expect(htmlAsset.source).toContain('</body>');
    });

    it('should include a link tag in head for CSS assets', async () => {
        const bundle = await rollup({
            input: 'entry',
            plugins: [virtual({ entry: 'console.log("hello")' }), emitCss('styles.css', 'body { margin: 0; }'), html()],
        });
        const { output } = await bundle.generate({ format: 'es', dir: 'dist' });

        const htmlAsset = output.find(item => item.fileName === 'index.html');
        expect(htmlAsset).toBeDefined();
        expect(htmlAsset.source).toContain('<link rel="stylesheet"');
        expect(htmlAsset.source).toContain('styles.css');
        const headEnd = htmlAsset.source.indexOf('</head>');
        const linkPos = htmlAsset.source.indexOf('<link');
        expect(linkPos).toBeLessThan(headEnd);
        expect(htmlAsset.source).toContain('<script');
        expect(htmlAsset.source).toContain('entry.js');
    });

    it('should use a custom outputFile name', async () => {
        const bundle = await rollup({
            input: 'entry',
            plugins: [virtual({ entry: 'console.log("hello")' }), html({ outputFile: 'custom.html' })],
        });
        const { output } = await bundle.generate({ format: 'es', dir: 'dist' });

        const htmlAsset = output.find(item => item.fileName === 'custom.html');
        expect(htmlAsset).toBeDefined();
        expect(htmlAsset.type).toBe('asset');
        expect(htmlAsset.source).toContain('<script');
        expect(htmlAsset.source).toContain('entry.js');
        const indexHtml = output.find(item => item.fileName === 'index.html');
        expect(indexHtml).toBeUndefined();
    });

    it('should use a custom template string', async () => {
        const customTemplate = '<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"></head><body><div id="app"></div></body></html>';
        const bundle = await rollup({
            input: 'entry',
            plugins: [virtual({ entry: 'console.log("hello")' }), html({ template: customTemplate })],
        });
        const { output } = await bundle.generate({ format: 'es', dir: 'dist' });

        const htmlAsset = output.find(item => item.fileName === 'index.html');
        expect(htmlAsset).toBeDefined();
        expect(htmlAsset.source).toContain('lang="en"');
        expect(htmlAsset.source).toContain('<meta charset="utf-8">');
        expect(htmlAsset.source).toContain('<div id="app"></div>');
        expect(htmlAsset.source).toContain('<script');
        expect(htmlAsset.source).toContain('entry.js');
    });

    it('should write HTML to disk when emitFile is false and useWriteBundle is true', async () => {
        const bundle = await rollup({
            input: 'entry',
            plugins: [virtual({ entry: 'console.log("hello")' }), html({ emitFile: false, useWriteBundle: true })],
        });
        await bundle.write({ format: 'es', dir: tmpDir });

        const htmlPath = join(tmpDir, 'index.html');
        const content = await readFile(htmlPath, 'utf8');
        expect(content).toContain('<script');
        expect(content).toContain('type="module"');
        expect(content).toContain('entry.js');
        expect(content).toContain('</head>');
        expect(content).toContain('</body>');
    });

    it('should use a regular script tag for IIFE format (not module)', async () => {
        const bundle = await rollup({
            input: 'entry',
            plugins: [virtual({ entry: 'console.log("hello")' }), html()],
        });
        const { output } = await bundle.generate({ format: 'iife', dir: 'dist', name: 'myBundle' });

        const htmlAsset = output.find(item => item.fileName === 'index.html');
        expect(htmlAsset).toBeDefined();
        expect(htmlAsset.source).toContain('<script');
        expect(htmlAsset.source).toContain('type="text/javascript"');
        expect(htmlAsset.source).not.toContain('type="module"');
        expect(htmlAsset.source).toContain('entry.js');
    });

    it('should use a regular script tag for UMD format (not module)', async () => {
        const bundle = await rollup({
            input: 'entry',
            plugins: [virtual({ entry: 'console.log("hello")' }), html()],
        });
        const { output } = await bundle.generate({ format: 'umd', dir: 'dist', name: 'myBundle' });

        const htmlAsset = output.find(item => item.fileName === 'index.html');
        expect(htmlAsset).toBeDefined();
        expect(htmlAsset.source).toContain('<script');
        expect(htmlAsset.source).toContain('type="text/javascript"');
        expect(htmlAsset.source).not.toContain('type="module"');
        expect(htmlAsset.source).toContain('entry.js');
    });

    it('should skip non-entry chunks (dynamic imports) from script tags', async () => {
        const bundle = await rollup({
            input: 'entry',
            plugins: [
                virtual({
                    entry: 'export default () => import("dynamic");',
                    dynamic: 'export const value = 123;',
                }),
                html(),
            ],
        });
        const { output } = await bundle.generate({ format: 'es', dir: 'dist' });

        const htmlAsset = output.find(item => item.fileName === 'index.html');
        expect(htmlAsset).toBeDefined();
        const entryChunk = output.find(item => item.type === 'chunk' && item.isEntry);
        expect(htmlAsset.source).toContain(entryChunk.fileName);
        const dynamicChunk = output.find(item => item.type === 'chunk' && !item.isEntry);
        expect(dynamicChunk).toBeDefined();
        expect(htmlAsset.source).not.toContain(dynamicChunk.fileName);
    });

    it('should not include non-CSS assets in the HTML', async () => {
        const bundle = await rollup({
            input: 'entry',
            plugins: [
                virtual({ entry: 'console.log("hello")' }),
                {
                    name: 'emit-txt',
                    generateBundle() {
                        this.emitFile({ type: 'asset', fileName: 'readme.txt', source: 'hello world' });
                    },
                },
                html(),
            ],
        });
        const { output } = await bundle.generate({ format: 'es', dir: 'dist' });

        const htmlAsset = output.find(item => item.fileName === 'index.html');
        expect(htmlAsset).toBeDefined();
        expect(htmlAsset.source).not.toContain('readme.txt');
        expect(htmlAsset.source).toContain('<script');
        expect(htmlAsset.source).toContain('entry.js');
    });

    it('should return the default plugin name when no pluginName option is provided', () => {
        const plugin = html();
        expect(plugin.name).toBe('@rollup-extras/plugin-html');
    });

    it('should use the pluginName option as the plugin name property', () => {
        const plugin = html({ pluginName: 'my-html' });
        expect(plugin.name).toBe('my-html');
    });

    it('should include script tags for multiple entry points', async () => {
        const bundle = await rollup({
            input: { a: 'entryA', b: 'entryB' },
            plugins: [
                virtual({
                    entryA: 'export const a = 1;',
                    entryB: 'export const b = 2;',
                }),
                html(),
            ],
        });
        const { output } = await bundle.generate({ format: 'es', dir: 'dist' });

        const htmlAsset = output.find(item => item.fileName === 'index.html');
        expect(htmlAsset).toBeDefined();
        const entryChunks = output.filter(item => item.type === 'chunk' && item.isEntry);
        expect(entryChunks.length).toBe(2);
        for (const chunk of entryChunks) {
            expect(htmlAsset.source).toContain(chunk.fileName);
        }
        const scriptMatches = htmlAsset.source.match(/<script /g);
        expect(scriptMatches.length).toBe(2);
    });

    it('should fall back to default template when template string has no head/body tags', async () => {
        const bundle = await rollup({
            input: 'entry',
            plugins: [virtual({ entry: 'console.log("hello")' }), html({ template: '<html>No head or body</html>' })],
        });
        const { output } = await bundle.generate({ format: 'es', dir: 'dist' });

        const htmlAsset = output.find(item => item.fileName === 'index.html');
        expect(htmlAsset).toBeDefined();
        expect(htmlAsset.source).toContain('</head>');
        expect(htmlAsset.source).toContain('</body>');
        expect(htmlAsset.source).toContain('<script');
        expect(htmlAsset.source).toContain('entry.js');
    });

    it('should ignore assets matching the ignore option', async () => {
        const bundle = await rollup({
            input: 'entry',
            plugins: [
                virtual({ entry: 'console.log("hello")' }),
                emitCss('styles.css', 'body { margin: 0; }'),
                {
                    name: 'emit-map',
                    generateBundle() {
                        this.emitFile({ type: 'asset', fileName: 'bundle.js.map', source: '{"mappings":""}' });
                    },
                },
                html({ ignore: /\.map$/ }),
            ],
        });
        const { output } = await bundle.generate({ format: 'es', dir: 'dist' });

        const htmlAsset = output.find(item => item.fileName === 'index.html');
        expect(htmlAsset).toBeDefined();
        expect(htmlAsset.source).not.toContain('bundle.js.map');
        expect(htmlAsset.source).toContain('styles.css');
        expect(htmlAsset.source).toContain('<link rel="stylesheet"');
        expect(htmlAsset.source).toContain('<script');
    });

    // ====================================================================
    // NEW TESTS - Coverage gaps
    // ====================================================================

    // 1. Template as file path, watch: true (default), file exists with valid HTML
    it('should use a template file when watch is true (default) and file has valid HTML', async () => {
        const tplPath = join(tmpDir, 'tpl.html');
        await writeFile(tplPath, '<!DOCTYPE html><html><head><meta charset="utf-8"></head><body><div id="root"></div></body></html>');
        const bundle = await rollup({
            input: 'entry',
            plugins: [virtual({ entry: 'console.log("hello")' }), html({ template: tplPath })],
        });
        const { output } = await bundle.generate({ format: 'es', dir: 'dist' });

        const htmlAsset = output.find(item => item.fileName === 'index.html');
        expect(htmlAsset).toBeDefined();
        expect(htmlAsset.source).toContain('<meta charset="utf-8">');
        expect(htmlAsset.source).toContain('<div id="root"></div>');
        expect(htmlAsset.source).toContain('<script');
        expect(htmlAsset.source).toContain('entry.js');
    });

    // 2. Template as file path, watch: false, file exists with valid HTML
    it('should use a template file when watch is false and file has valid HTML', async () => {
        const tplPath = join(tmpDir, 'tpl.html');
        await writeFile(tplPath, '<!DOCTYPE html><html><head><meta charset="utf-8"></head><body><div id="root"></div></body></html>');
        const bundle = await rollup({
            input: 'entry',
            plugins: [virtual({ entry: 'console.log("hello")' }), html({ template: tplPath, watch: false })],
        });
        const { output } = await bundle.generate({ format: 'es', dir: 'dist' });

        const htmlAsset = output.find(item => item.fileName === 'index.html');
        expect(htmlAsset).toBeDefined();
        expect(htmlAsset.source).toContain('<meta charset="utf-8">');
        expect(htmlAsset.source).toContain('<div id="root"></div>');
        expect(htmlAsset.source).toContain('<script');
        expect(htmlAsset.source).toContain('entry.js');
    });

    // 3. Template as file path, watch: false, file exists but NOT usable (no head/body)
    it('should fall back to default template when file template has no head/body and watch is false', async () => {
        const tplPath = join(tmpDir, 'bad-tpl.html');
        await writeFile(tplPath, '<html>No head or body</html>');
        const bundle = await rollup({
            input: 'entry',
            plugins: [virtual({ entry: 'console.log("hello")' }), html({ template: tplPath, watch: false })],
        });
        const { output } = await bundle.generate({ format: 'es', dir: 'dist' });

        const htmlAsset = output.find(item => item.fileName === 'index.html');
        expect(htmlAsset).toBeDefined();
        expect(htmlAsset.source).toContain('</head>');
        expect(htmlAsset.source).toContain('</body>');
        expect(htmlAsset.source).toContain('<script');
        expect(htmlAsset.source).toContain('entry.js');
    });

    // 4. Template as file path, watch: false, file does NOT exist
    it('should handle nonexistent template file path with watch: false without crashing', async () => {
        const plugin = html({ template: '/nonexistent/path/to/template.html', watch: false });
        expect(plugin).toBeDefined();
        expect(plugin.name).toBe('@rollup-extras/plugin-html');
        // Allow async catch handler to run for coverage
        await new Promise(r => setTimeout(r, 100));
    });

    // 5. Template file without head/body + custom templateFactory (watch: false)
    it('should use custom templateFactory even when template file has no head/body', async () => {
        const tplPath = join(tmpDir, 'custom-tpl.html');
        await writeFile(tplPath, '<div>custom</div>');
        const bundle = await rollup({
            input: 'entry',
            plugins: [
                virtual({ entry: 'console.log("hello")' }),
                html({
                    template: tplPath,
                    watch: false,
                    templateFactory: (tpl, _assets) => `${tpl}<script src="entry.js"></script>`,
                }),
            ],
        });
        const { output } = await bundle.generate({ format: 'es', dir: 'dist' });

        const htmlAsset = output.find(item => item.fileName === 'index.html');
        expect(htmlAsset).toBeDefined();
        expect(htmlAsset.source).toContain('<div>custom</div>');
        expect(htmlAsset.source).toContain('<script src="entry.js"></script>');
    });

    // 6. useEmittedTemplate: another plugin emits index.html as asset, no template option
    it('should use emitted index.html as template when useEmittedTemplate is true (default)', async () => {
        const emittedHtml = '<!DOCTYPE html><html><head></head><body><div id="app"></div></body></html>';
        const bundle = await rollup({
            input: 'entry',
            plugins: [
                virtual({ entry: 'console.log("hello")' }),
                {
                    name: 'emit-html',
                    generateBundle() {
                        this.emitFile({ type: 'asset', fileName: 'index.html', source: emittedHtml });
                    },
                },
                html(),
            ],
        });
        const { output } = await bundle.generate({ format: 'es', dir: 'dist' });

        const htmlAsset = output.find(item => item.fileName === 'index.html');
        expect(htmlAsset).toBeDefined();
        expect(htmlAsset.source).toContain('<div id="app"></div>');
        expect(htmlAsset.source).toContain('<script');
        expect(htmlAsset.source).toContain('entry.js');
    });

    // 7. useEmittedTemplate: false (template option provided) + another plugin emits index.html
    it('should remove existing emitted index.html when template option is provided', async () => {
        const customTemplate = '<!DOCTYPE html><html><head></head><body><div id="custom"></div></body></html>';
        const bundle = await rollup({
            input: 'entry',
            plugins: [
                virtual({ entry: 'console.log("hello")' }),
                {
                    name: 'emit-html',
                    generateBundle() {
                        this.emitFile({
                            type: 'asset',
                            fileName: 'index.html',
                            source: '<!DOCTYPE html><html><head></head><body><div id="emitted"></div></body></html>',
                        });
                    },
                },
                html({ template: customTemplate }),
            ],
        });
        const { output } = await bundle.generate({ format: 'es', dir: 'dist' });

        const htmlAsset = output.find(item => item.fileName === 'index.html');
        expect(htmlAsset).toBeDefined();
        expect(htmlAsset.source).toContain('<div id="custom"></div>');
        expect(htmlAsset.source).not.toContain('<div id="emitted"></div>');
        expect(htmlAsset.source).toContain('<script');
    });

    // 8. emitFile: true with output file outside dir
    it('should write file to disk when emitFile is true but outputFile is outside dir', async () => {
        const subDir = join(tmpDir, 'subdir');
        const bundle = await rollup({
            input: 'entry',
            plugins: [virtual({ entry: 'console.log("hello")' }), html({ outputFile: '../outside.html', emitFile: true })],
        });
        await bundle.write({ format: 'es', dir: subDir });

        const outsidePath = join(tmpDir, 'outside.html');
        const content = await readFile(outsidePath, 'utf8');
        expect(content).toContain('<script');
        expect(content).toContain('entry.js');
    });

    // 9. templateFactory that throws
    it('should produce output gracefully when templateFactory throws an error', async () => {
        const bundle = await rollup({
            input: 'entry',
            plugins: [
                virtual({ entry: 'console.log("hello")' }),
                html({
                    templateFactory: () => {
                        throw new Error('fail');
                    },
                }),
            ],
        });
        const { output } = await bundle.generate({ format: 'es', dir: 'dist' });
        expect(output).toBeDefined();
    });

    // 10. assetsFactory returning a string
    it('should use assetsFactory that returns a string', async () => {
        const bundle = await rollup({
            input: 'entry',
            plugins: [
                virtual({ entry: 'console.log("hello")' }),
                html({
                    assetsFactory: (fileName, _content, _type) => {
                        if (fileName.endsWith('.js')) return '<script src="custom.js"></script>';
                    },
                }),
            ],
        });
        const { output } = await bundle.generate({ format: 'es', dir: 'dist' });

        const htmlAsset = output.find(item => item.fileName === 'index.html');
        expect(htmlAsset).toBeDefined();
        expect(htmlAsset.source).toContain('<script src="custom.js"></script>');
    });

    // 11. assetsFactory returning an AssetDescriptor object
    it('should use assetsFactory that returns an AssetDescriptor object', async () => {
        const bundle = await rollup({
            input: 'entry',
            plugins: [
                virtual({ entry: 'console.log("hello")' }),
                html({
                    assetsFactory: (fileName, _content, _type) => {
                        if (fileName.endsWith('.js')) return { html: '<script src="custom.js"></script>', head: false, type: 'es' };
                    },
                }),
            ],
        });
        const { output } = await bundle.generate({ format: 'es', dir: 'dist' });

        const htmlAsset = output.find(item => item.fileName === 'index.html');
        expect(htmlAsset).toBeDefined();
        expect(htmlAsset.source).toContain('<script src="custom.js"></script>');
    });

    // 12. assetsFactory returning undefined
    it('should fall back to default handling when assetsFactory returns undefined', async () => {
        const bundle = await rollup({
            input: 'entry',
            plugins: [
                virtual({ entry: 'console.log("hello")' }),
                html({
                    assetsFactory: () => undefined,
                }),
            ],
        });
        const { output } = await bundle.generate({ format: 'es', dir: 'dist' });

        const htmlAsset = output.find(item => item.fileName === 'index.html');
        expect(htmlAsset).toBeDefined();
        expect(htmlAsset.source).toContain('<script');
        expect(htmlAsset.source).toContain('type="module"');
        expect(htmlAsset.source).toContain('entry.js');
    });

    // 13. assetsFactory that throws
    it('should not crash when assetsFactory throws and fall back to default handling', async () => {
        const bundle = await rollup({
            input: 'entry',
            plugins: [
                virtual({ entry: 'console.log("hello")' }),
                html({
                    assetsFactory: () => {
                        throw new Error('oops');
                    },
                }),
            ],
        });
        const { output } = await bundle.generate({ format: 'es', dir: 'dist' });

        const htmlAsset = output.find(item => item.fileName === 'index.html');
        expect(htmlAsset).toBeDefined();
        expect(htmlAsset.source).toContain('<script');
        expect(htmlAsset.source).toContain('entry.js');
    });

    // 14. assetsFactory returns asset with novel type (creates new array)
    it('should handle assetsFactory returning a novel asset type', async () => {
        const bundle = await rollup({
            input: 'entry',
            plugins: [
                virtual({ entry: 'console.log("hello")' }),
                html({
                    assetsFactory: (fileName, _content, _type) => {
                        if (fileName.endsWith('.js')) return { html: '<script src="cjs-bundle.js"></script>', head: false, type: 'cjs' };
                    },
                    templateFactory: (tpl, assets, defaultFactory) => {
                        // Merge novel type into es so defaultFactory renders it
                        if (assets.cjs) {
                            assets.es = (assets.es || []).concat(assets.cjs);
                        }
                        return defaultFactory(tpl, assets);
                    },
                }),
            ],
        });
        const { output } = await bundle.generate({ format: 'es', dir: 'dist' });

        const htmlAsset = output.find(item => item.fileName === 'index.html');
        expect(htmlAsset).toBeDefined();
        expect(htmlAsset.source).toContain('<script src="cjs-bundle.js"></script>');
    });

    // 15. conditionalLoading: true with IIFE - verify nomodule attribute
    it('should add nomodule attribute to IIFE script when conditionalLoading is true', async () => {
        const bundle = await rollup({
            input: 'entry',
            plugins: [virtual({ entry: 'console.log("hello")' }), html({ conditionalLoading: true })],
        });
        const { output } = await bundle.generate({ format: 'iife', dir: 'dist', name: 'myBundle' });

        const htmlAsset = output.find(item => item.fileName === 'index.html');
        expect(htmlAsset).toBeDefined();
        expect(htmlAsset.source).toContain('nomodule');
    });

    // 16. conditionalLoading: false with IIFE - verify NO nomodule attribute
    it('should NOT add nomodule attribute to IIFE script when conditionalLoading is false', async () => {
        const bundle = await rollup({
            input: 'entry',
            plugins: [virtual({ entry: 'console.log("hello")' }), html({ conditionalLoading: false })],
        });
        const { output } = await bundle.generate({ format: 'iife', dir: 'dist', name: 'myBundle' });

        const htmlAsset = output.find(item => item.fileName === 'index.html');
        expect(htmlAsset).toBeDefined();
        expect(htmlAsset.source).not.toContain('nomodule');
    });

    // 17. ignore with invalid value (number) - should fall back to defaults
    it('should ignore the ignore option and include all assets when it is an invalid type', async () => {
        const bundle = await rollup({
            input: 'entry',
            plugins: [virtual({ entry: 'console.log("hello")' }), html({ ignore: 0 })],
        });
        const { output } = await bundle.generate({ format: 'es', dir: 'dist' });

        const htmlAsset = output.find(item => item.fileName === 'index.html');
        expect(htmlAsset).toBeDefined();
        expect(htmlAsset.source).toContain('<script');
        expect(htmlAsset.source).toContain('entry.js');
    });

    // 18. verbose: true - verify it does not crash
    it('should generate valid HTML when verbose option is enabled', async () => {
        const bundle = await rollup({
            input: 'entry',
            plugins: [virtual({ entry: 'console.log("hello")' }), html({ verbose: true })],
        });
        const { output } = await bundle.generate({ format: 'es', dir: 'dist' });

        const htmlAsset = output.find(item => item.fileName === 'index.html');
        expect(htmlAsset).toBeDefined();
        expect(htmlAsset.source).toContain('<script');
        expect(htmlAsset.source).toContain('entry.js');
    });

    // 19. emitFile: false with generateBundle (default useWriteBundle: false) - writeFile path
    it('should write to disk when emitFile is false and useWriteBundle is false (default)', async () => {
        const bundle = await rollup({
            input: 'entry',
            plugins: [virtual({ entry: 'console.log("hello")' }), html({ emitFile: false })],
        });
        await bundle.write({ format: 'es', dir: tmpDir });

        const htmlPath = join(tmpDir, 'index.html');
        const content = await readFile(htmlPath, 'utf8');
        expect(content).toContain('<script');
        expect(content).toContain('type="module"');
        expect(content).toContain('entry.js');
    });

    // 20. IIFE format with CSS asset covers more of defaultTemplateFactory
    it('should include both script and CSS link tags in IIFE format', async () => {
        const bundle = await rollup({
            input: 'entry',
            plugins: [virtual({ entry: 'console.log("hello")' }), emitCss('styles.css', 'body { margin: 0; }'), html()],
        });
        const { output } = await bundle.generate({ format: 'iife', dir: 'dist', name: 'myBundle' });

        const htmlAsset = output.find(item => item.fileName === 'index.html');
        expect(htmlAsset).toBeDefined();
        expect(htmlAsset.source).toContain('type="text/javascript"');
        expect(htmlAsset.source).not.toContain('type="module"');
        expect(htmlAsset.source).toContain('entry.js');
        expect(htmlAsset.source).toContain('<link rel="stylesheet"');
        expect(htmlAsset.source).toContain('styles.css');
        // CSS should be in head, script in body
        const headEnd = htmlAsset.source.indexOf('</head>');
        const linkPos = htmlAsset.source.indexOf('<link');
        expect(linkPos).toBeLessThan(headEnd);
    });

    // 21. Template file with no head/body, watch: true (default) - covers useNewTemplate warn path (L249)
    it('should warn and use default template when watch:true template file has no head/body', async () => {
        const tplPath = join(tmpDir, 'bad-watch-tpl.html');
        await writeFile(tplPath, '<html>No head or body here</html>');
        const bundle = await rollup({
            input: 'entry',
            plugins: [virtual({ entry: 'console.log("hello")' }), html({ template: tplPath })],
        });
        const { output } = await bundle.generate({ format: 'es', dir: 'dist' });

        const htmlAsset = output.find(item => item.fileName === 'index.html');
        expect(htmlAsset).toBeDefined();
        // Should fall back to default template
        expect(htmlAsset.source).toContain('</head>');
        expect(htmlAsset.source).toContain('</body>');
        expect(htmlAsset.source).toContain('<script');
        expect(htmlAsset.source).toContain('entry.js');
    });

    // 22. Template file path that does not exist, watch: true - covers handleTemplateReadError ENOENT via readFileSync
    it('should handle nonexistent template file path with watch: true without crashing', async () => {
        const bundle = await rollup({
            input: 'entry',
            plugins: [virtual({ entry: 'console.log("hello")' }), html({ template: '/nonexistent/watch-true-template.html', watch: true })],
        });
        const { output } = await bundle.generate({ format: 'es', dir: 'dist' });

        const htmlAsset = output.find(item => item.fileName === 'index.html');
        expect(htmlAsset).toBeDefined();
        // Falls back to default template
        expect(htmlAsset.source).toContain('</head>');
        expect(htmlAsset.source).toContain('</body>');
    });

    // 23. assetsFactory returning a string for a CSS asset (covers L323 continue for asset type)
    it('should use assetsFactory for CSS assets and skip default CSS handling', async () => {
        const bundle = await rollup({
            input: 'entry',
            plugins: [
                virtual({ entry: 'console.log("hello")' }),
                emitCss('styles.css', 'body { margin: 0; }'),
                html({
                    assetsFactory: (fileName, _content, _type) => {
                        if (fileName.endsWith('.css')) return '<link rel="stylesheet" href="custom-styles.css">';
                    },
                }),
            ],
        });
        const { output } = await bundle.generate({ format: 'es', dir: 'dist' });

        const htmlAsset = output.find(item => item.fileName === 'index.html');
        expect(htmlAsset).toBeDefined();
        expect(htmlAsset.source).toContain('custom-styles.css');
        // The default styles.css link should NOT be present (assetsFactory took over)
        expect(htmlAsset.source).not.toContain('href="styles.css"');
    });

    // 24. handleTemplateReadError with non-ENOENT error (covers L262)
    it('should handle template read error that is not ENOENT', async () => {
        // A directory path will cause a non-ENOENT read error (EISDIR)
        const bundle = await rollup({
            input: 'entry',
            plugins: [virtual({ entry: 'console.log("hello")' }), html({ template: tmpDir, watch: true })],
        });
        const { output } = await bundle.generate({ format: 'es', dir: 'dist' });

        const htmlAsset = output.find(item => item.fileName === 'index.html');
        expect(htmlAsset).toBeDefined();
        // Falls back to default template
        expect(htmlAsset.source).toContain('</head>');
        expect(htmlAsset.source).toContain('</body>');
    });

    // 25. addInstance API - covers L172-179 (multi-config plugin addInstance)
    it('should support addInstance API with template file and watch mode', async () => {
        const tplPath = join(tmpDir, 'tpl-add-instance.html');
        await writeFile(tplPath, '<!DOCTYPE html><html><head><meta charset="utf-8"></head><body><div id="multi"></div></body></html>');
        const plugin = html({ template: tplPath, watch: true });
        expect(plugin.api).toBeDefined();
        expect(typeof plugin.api.addInstance).toBe('function');

        // Call addInstance to get a second plugin instance
        const secondInstance = plugin.api.addInstance();
        expect(secondInstance).toBeDefined();
        expect(secondInstance.name).toContain('@rollup-extras/plugin-html');

        // The second instance should also have buildStart (because hasTemplateFile && watch)
        expect(secondInstance.buildStart).toBeDefined();
    });

    // 26. buildStart hook for template file watch mode - covers L183-191
    it('should re-read template file on buildStart when watch is true', async () => {
        const tplPath = join(tmpDir, 'tpl-watch.html');
        await writeFile(tplPath, '<!DOCTYPE html><html><head></head><body><div id="v1"></div></body></html>');
        const plugin = html({ template: tplPath, watch: true });

        // First build with original template
        const bundle1 = await rollup({
            input: 'entry',
            plugins: [virtual({ entry: 'console.log("v1")' }), plugin],
        });
        const { output: output1 } = await bundle1.generate({ format: 'es', dir: 'dist' });
        const html1 = output1.find(item => item.fileName === 'index.html');
        expect(html1).toBeDefined();
        expect(html1.source).toContain('<div id="v1"></div>');

        // Update template file (simulating a file change)
        await writeFile(tplPath, '<!DOCTYPE html><html><head></head><body><div id="v2"></div></body></html>');

        // Second build - buildStart should re-read the file
        const bundle2 = await rollup({
            input: 'entry',
            plugins: [virtual({ entry: 'console.log("v2")' }), plugin],
        });
        const { output: output2 } = await bundle2.generate({ format: 'es', dir: 'dist' });
        const html2 = output2.find(item => item.fileName === 'index.html');
        expect(html2).toBeDefined();
        expect(html2.source).toContain('<div id="v2"></div>');
    });

    // 27. buildStart with template file that gets deleted between builds (covers L188 catch)
    it('should handle template file being deleted between watch builds', async () => {
        const tplPath = join(tmpDir, 'tpl-deleted.html');
        await writeFile(tplPath, '<!DOCTYPE html><html><head></head><body><div id="v1"></div></body></html>');
        const plugin = html({ template: tplPath, watch: true });

        // First build with original template
        const bundle1 = await rollup({
            input: 'entry',
            plugins: [virtual({ entry: 'console.log("v1")' }), plugin],
        });
        const { output: output1 } = await bundle1.generate({ format: 'es', dir: 'dist' });
        const html1 = output1.find(item => item.fileName === 'index.html');
        expect(html1).toBeDefined();
        expect(html1.source).toContain('<div id="v1"></div>');

        // Delete template file to trigger error on re-read
        await rm(tplPath);

        // Second build - buildStart should hit the catch(e) handler
        const bundle2 = await rollup({
            input: 'entry',
            plugins: [virtual({ entry: 'console.log("v2")' }), plugin],
        });
        const { output: output2 } = await bundle2.generate({ format: 'es', dir: 'dist' });
        // Should still produce output (falls back to previous template or default)
        expect(output2).toBeDefined();
    });

    // 28. CJS format entry chunk - covers L332/L338 false paths (format not in es/iife/umd)
    it('should not inject any script tags for CJS format entries', async () => {
        const bundle = await rollup({
            input: 'entry',
            plugins: [virtual({ entry: 'module.exports = 1;' }), html()],
        });
        const { output } = await bundle.generate({ format: 'cjs', dir: 'dist' });

        const htmlAsset = output.find(item => item.fileName === 'index.html');
        expect(htmlAsset).toBeDefined();
        // CJS format is not es/iife/umd, so no script tags should be added
        expect(htmlAsset.source).not.toContain('<script');
    });

    // 29. useEmittedTemplate with chunk (not asset) type - covers L219-221 chunk branch
    it('should use emitted chunk code as template when useEmittedTemplate is true', async () => {
        const bundle = await rollup({
            input: 'entry',
            plugins: [
                virtual({ entry: 'console.log("hello")' }),
                {
                    name: 'emit-html-chunk',
                    generateBundle(_options, bundle) {
                        // Manually add a chunk with fileName 'index.html' to exercise the chunk branch
                        bundle['index.html'] = {
                            type: 'chunk',
                            fileName: 'index.html',
                            code: '<!DOCTYPE html><html><head></head><body><div id="chunk-tpl"></div></body></html>',
                            isEntry: false,
                            isDynamicEntry: false,
                            facadeModuleId: null,
                            modules: {},
                            exports: [],
                            imports: [],
                            dynamicImports: [],
                            implicitlyLoadedBefore: [],
                            importedBindings: {},
                            referencedFiles: [],
                            map: null,
                            name: 'index',
                            moduleIds: [],
                            sourcemapFileName: null,
                            preliminaryFileName: 'index.html',
                        };
                    },
                },
                html(),
            ],
        });
        const { output } = await bundle.generate({ format: 'es', dir: 'dist' });

        const htmlAsset = output.find(item => item.fileName === 'index.html');
        expect(htmlAsset).toBeDefined();
        expect(htmlAsset.source).toContain('<div id="chunk-tpl"></div>');
        expect(htmlAsset.source).toContain('<script');
    });

    // 30. addInstance without template file (covers the false branch of hasTemplateFile && watch in addInstance)
    it('should support addInstance API without template file', async () => {
        const plugin = html();
        expect(plugin.api).toBeDefined();
        const secondInstance = plugin.api.addInstance();
        expect(secondInstance).toBeDefined();
        // Without hasTemplateFile, no buildStart should be added
        expect(secondInstance.buildStart).toBeUndefined();
    });

    // 31. Generate with output.file instead of output.dir (covers dir ?? '' fallback branches)
    it('should emit index.html when output.dir is undefined', async () => {
        const bundle = await rollup({
            input: 'entry',
            plugins: [virtual({ entry: 'console.log("hello")' }), html()],
        });
        // Use file option instead of dir, so options.dir is undefined
        const { output } = await bundle.generate({ format: 'es' });

        const htmlAsset = output.find(item => item.fileName === 'index.html');
        expect(htmlAsset).toBeDefined();
        expect(htmlAsset.source).toContain('<script');
        expect(htmlAsset.source).toContain('entry.js');
    });

    // ====================================================================
    // Additional coverage tests
    // ====================================================================

    // Cover line 226: multi-config scenario where existing emitted index.html
    // is found but useEmittedTemplate is false (template option provided).
    // First config has remainingConfigsCount > 0, second has remainingConfigsCount === 0.
    it('should handle multi-config scenario removing existing emitted html', async () => {
        const customTemplate = '<!DOCTYPE html><html><head></head><body><div id="multi"></div></body></html>';
        const plugin = html({ template: customTemplate });
        const secondInstance = plugin.api.addInstance();

        const bundle1 = await rollup({
            input: 'entry',
            plugins: [
                virtual({ entry: 'console.log("config1")' }),
                {
                    name: 'emit-html-1',
                    generateBundle() {
                        this.emitFile({
                            type: 'asset',
                            fileName: 'index.html',
                            source: '<!DOCTYPE html><html><head></head><body>emitted1</body></html>',
                        });
                    },
                },
                plugin,
            ],
        });

        const bundle2 = await rollup({
            input: 'entry',
            plugins: [
                virtual({ entry: 'console.log("config2")' }),
                {
                    name: 'emit-html-2',
                    generateBundle() {
                        this.emitFile({
                            type: 'asset',
                            fileName: 'index.html',
                            source: '<!DOCTYPE html><html><head></head><body>emitted2</body></html>',
                        });
                    },
                },
                secondInstance,
            ],
        });

        // First generate: remainingConfigsCount = 1 (second config pending)
        const { output: _output1 } = await bundle1.generate({ format: 'es', dir: 'dist' });

        // Second generate: remainingConfigsCount = 0, triggers final generateBundle
        const { output: output2 } = await bundle2.generate({ format: 'es', dir: 'dist' });

        const htmlAsset = output2.find(item => item.fileName === 'index.html');
        expect(htmlAsset).toBeDefined();
        expect(htmlAsset.source).toContain('<div id="multi"></div>');
        expect(htmlAsset.source).toContain('<script');
    });

    // Cover line 332: CSS asset detected via .css extension in multi-config scenario
    // where assets are collected across multiple outputs.
    it('should collect CSS assets across multi-config outputs', async () => {
        const plugin = html();
        const secondInstance = plugin.api.addInstance();

        const bundle1 = await rollup({
            input: 'entry',
            plugins: [virtual({ entry: 'console.log("config1")' }), emitCss('styles.css', 'body { margin: 0; }'), plugin],
        });

        const bundle2 = await rollup({
            input: 'entry',
            plugins: [virtual({ entry: 'console.log("config2")' }), secondInstance],
        });

        // First generate: collects CSS assets, remainingConfigsCount = 1
        const { output: _output1 } = await bundle1.generate({ format: 'es', dir: 'dist' });

        // Second generate: remainingConfigsCount = 0, triggers final generateBundle
        const { output: output2 } = await bundle2.generate({ format: 'es', dir: 'dist' });

        const htmlAsset = output2.find(item => item.fileName === 'index.html');
        expect(htmlAsset).toBeDefined();
        expect(htmlAsset.source).toContain('<link rel="stylesheet"');
        expect(htmlAsset.source).toContain('styles.css');
        expect(htmlAsset.source).toContain('<script');
    });

    // Cover line 403: predicateFactory logs warning for injectIntoHead with invalid type
    it('should ignore the injectIntoHead option and use defaults when it is an invalid type', async () => {
        const bundle = await rollup({
            input: 'entry',
            plugins: [
                virtual({ entry: 'console.log("hello")' }),
                emitCss('styles.css', 'body { margin: 0; }'),
                html({ injectIntoHead: 0 }),
            ],
        });
        const { output } = await bundle.generate({ format: 'es', dir: 'dist' });

        const htmlAsset = output.find(item => item.fileName === 'index.html');
        expect(htmlAsset).toBeDefined();
        expect(htmlAsset.source).toContain('<script');
        expect(htmlAsset.source).toContain('entry.js');
        // CSS link should still be present (default injectIntoHead is used)
        expect(htmlAsset.source).toContain('<link rel="stylesheet"');
    });
});
