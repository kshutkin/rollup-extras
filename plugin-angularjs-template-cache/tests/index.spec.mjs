import { chmod, mkdir, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { rollup } from 'rollup';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import templateCache from '../src/index.js';

function entryPlugin(code) {
    return {
        name: 'entry',
        resolveId(id) {
            if (id === 'entry') return id;
        },
        load(id) {
            if (id === 'entry') return code;
        },
    };
}

describe('@rollup-extras/plugin-angularjs-template-cache', () => {
    let tmpDir;

    beforeEach(async () => {
        tmpDir = await mkdtemp(join(tmpdir(), 'angularjs-tc-test-'));
    });

    afterEach(async () => {
        await rm(tmpDir, { recursive: true, force: true });
    });

    it('should generate $templateCache.put calls for each template file', async () => {
        const templatesDir = join(tmpDir, 'templates');
        await mkdir(templatesDir, { recursive: true });
        await writeFile(join(templatesDir, 'hello.html'), '<div>Hello</div>');

        const bundle = await rollup({
            input: 'entry',
            external: ['angular'],
            plugins: [
                entryPlugin("import templates from 'templates'; console.log(templates);"),
                templateCache({
                    templates: join(templatesDir, '**/*.html'),
                    rootDir: templatesDir,
                    importAngular: false,
                }),
            ],
        });
        const { output } = await bundle.generate({ format: 'es' });
        const code = output[0].code;

        expect(code).toContain('$templateCache.put');
        expect(code).toContain('Hello');
        expect(code).toContain('hello.html');
    });

    it('should use custom angular module name', async () => {
        const templatesDir = join(tmpDir, 'templates');
        await mkdir(templatesDir, { recursive: true });
        await writeFile(join(templatesDir, 'test.html'), '<p>Test</p>');

        const bundle = await rollup({
            input: 'entry',
            external: ['angular'],
            plugins: [
                entryPlugin("import templates from 'templates'; console.log(templates);"),
                templateCache({
                    templates: join(templatesDir, '**/*.html'),
                    rootDir: templatesDir,
                    importAngular: false,
                    angularModule: 'myApp.templates',
                }),
            ],
        });
        const { output } = await bundle.generate({ format: 'es' });
        const code = output[0].code;

        expect(code).toContain('myApp.templates');
        expect(code).toContain('$templateCache.put');
    });

    it('should respect custom rootDir for template URI paths', async () => {
        const templatesDir = join(tmpDir, 'deep', 'nested');
        await mkdir(templatesDir, { recursive: true });
        await writeFile(join(templatesDir, 'widget.html'), '<div>Widget</div>');

        const bundle = await rollup({
            input: 'entry',
            external: ['angular'],
            plugins: [
                entryPlugin("import templates from 'templates'; console.log(templates);"),
                templateCache({
                    templates: join(templatesDir, '**/*.html'),
                    rootDir: tmpDir,
                    importAngular: false,
                }),
            ],
        });
        const { output } = await bundle.generate({ format: 'es' });
        const code = output[0].code;

        expect(code).toContain('deep/nested/widget.html');
    });

    it('should apply processHtml callback to transform HTML content', async () => {
        const templatesDir = join(tmpDir, 'templates');
        await mkdir(templatesDir, { recursive: true });
        await writeFile(join(templatesDir, 'spaced.html'), '<div>   Hello   World   </div>');

        const bundle = await rollup({
            input: 'entry',
            external: ['angular'],
            plugins: [
                entryPlugin("import templates from 'templates'; console.log(templates);"),
                templateCache({
                    templates: join(templatesDir, '**/*.html'),
                    rootDir: templatesDir,
                    importAngular: false,
                    processHtml: html => html.replace(/\s+/g, ' ').trim(),
                }),
            ],
        });
        const { output } = await bundle.generate({ format: 'es' });
        const code = output[0].code;

        expect(code).toContain('<div> Hello World </div>');
        expect(code).not.toContain('<div>   Hello');
    });

    it('should apply transformTemplateUri callback to modify URIs', async () => {
        const templatesDir = join(tmpDir, 'templates');
        await mkdir(templatesDir, { recursive: true });
        await writeFile(join(templatesDir, 'dialog.html'), '<div>Dialog</div>');

        const bundle = await rollup({
            input: 'entry',
            external: ['angular'],
            plugins: [
                entryPlugin("import templates from 'templates'; console.log(templates);"),
                templateCache({
                    templates: join(templatesDir, '**/*.html'),
                    rootDir: templatesDir,
                    importAngular: false,
                    transformTemplateUri: uri => `app/${uri}`,
                }),
            ],
        });
        const { output } = await bundle.generate({ format: 'es' });
        const code = output[0].code;

        expect(code).toContain('app/dialog.html');
    });

    it('should create non-standalone module when standalone is false', async () => {
        const templatesDir = join(tmpDir, 'templates');
        await mkdir(templatesDir, { recursive: true });
        await writeFile(join(templatesDir, 'item.html'), '<li>Item</li>');

        const bundle = await rollup({
            input: 'entry',
            external: ['angular'],
            plugins: [
                entryPlugin("import templates from 'templates'; console.log(templates);"),
                templateCache({
                    templates: join(templatesDir, '**/*.html'),
                    rootDir: templatesDir,
                    importAngular: false,
                    standalone: false,
                }),
            ],
        });
        const { output } = await bundle.generate({ format: 'es' });
        const code = output[0].code;

        expect(code).toContain('angular.module("templates")');
        expect(code).not.toContain(', []');
    });

    it('should include templates from nested subdirectories', async () => {
        const templatesDir = join(tmpDir, 'templates');
        const subDir = join(templatesDir, 'partials');
        await mkdir(subDir, { recursive: true });
        await writeFile(join(templatesDir, 'header.html'), '<header>Header</header>');
        await writeFile(join(templatesDir, 'footer.html'), '<footer>Footer</footer>');
        await writeFile(join(subDir, 'sidebar.html'), '<aside>Sidebar</aside>');

        const bundle = await rollup({
            input: 'entry',
            external: ['angular'],
            plugins: [
                entryPlugin("import templates from 'templates'; console.log(templates);"),
                templateCache({
                    templates: join(templatesDir, '**/*.html'),
                    rootDir: templatesDir,
                    importAngular: false,
                }),
            ],
        });
        const { output } = await bundle.generate({ format: 'es' });
        const code = output[0].code;

        expect(code).toContain('Header');
        expect(code).toContain('Footer');
        expect(code).toContain('Sidebar');
        expect(code).toContain('header.html');
        expect(code).toContain('footer.html');
        expect(code).toContain('partials/sidebar.html');

        const putCount = (code.match(/\$templateCache\.put/g) || []).length;
        expect(putCount).toBe(3);
    });

    it('should import angular by default when importAngular is not set to false', async () => {
        const templatesDir = join(tmpDir, 'templates');
        await mkdir(templatesDir, { recursive: true });
        await writeFile(join(templatesDir, 'greeting.html'), '<span>Hi</span>');

        const bundle = await rollup({
            input: 'entry',
            external: ['angular'],
            plugins: [
                entryPlugin("import templates from 'templates'; console.log(templates);"),
                templateCache({
                    templates: join(templatesDir, '**/*.html'),
                    rootDir: templatesDir,
                }),
            ],
        });
        const { output } = await bundle.generate({ format: 'es' });
        const code = output[0].code;

        expect(code).toContain("import angular from 'angular'");
        expect(code).toContain('$templateCache.put');
        expect(code).toContain('greeting.html');
    });

    it('should use import statements for templates when useImports is true', async () => {
        const templatesDir = join(tmpDir, 'templates');
        await mkdir(templatesDir, { recursive: true });
        await writeFile(join(templatesDir, 'card.html'), '<div class="card">Card</div>');

        // The useImports option generates import statements from the virtual module.
        // Since the virtual module has no real fs location, we mark .html as external
        // so rollup doesn't fail resolving them, and verify the code patterns.
        const bundle = await rollup({
            input: 'entry',
            external: id => id.endsWith('.html'),
            plugins: [
                entryPlugin("import templates from 'templates'; console.log(templates);"),
                templateCache({
                    templates: join(templatesDir, '**/*.html'),
                    rootDir: templatesDir,
                    importAngular: false,
                    useImports: true,
                }),
            ],
            onwarn() {},
        });
        const { output } = await bundle.generate({ format: 'es' });
        const code = output[0].code;

        expect(code).toMatch(/import\s+template0\s+from/);
        expect(code).toMatch(/\.put\("card\.html",\s*template0\)/);
    });

    it('should transform HTML imports to URI strings when transformHtmlImportsToUris is true', async () => {
        const templatesDir = join(tmpDir, 'templates');
        await mkdir(templatesDir, { recursive: true });
        await writeFile(join(templatesDir, 'dialog.html'), '<div>Dialog Content</div>');

        const bundle = await rollup({
            input: 'entry',
            plugins: [
                entryPlugin("import uri from './templates/dialog.html'; console.log(uri);"),
                templateCache({
                    templates: join(templatesDir, '**/*.html'),
                    rootDir: tmpDir,
                    importAngular: false,
                    transformHtmlImportsToUris: true,
                }),
            ],
            onwarn() {},
        });
        const { output } = await bundle.generate({ format: 'es' });
        const code = output[0].code;

        expect(code).toContain('templates/dialog.html');
    });

    it('should resolve custom module name', async () => {
        const templatesDir = join(tmpDir, 'templates');
        await mkdir(templatesDir, { recursive: true });
        await writeFile(join(templatesDir, 'page.html'), '<main>Page</main>');

        const bundle = await rollup({
            input: 'entry',
            external: ['angular'],
            plugins: [
                entryPlugin("import x from 'my-templates'; console.log(x);"),
                templateCache({
                    templates: join(templatesDir, '**/*.html'),
                    rootDir: templatesDir,
                    importAngular: false,
                    module: 'my-templates',
                }),
            ],
        });
        const { output } = await bundle.generate({ format: 'es' });
        const code = output[0].code;

        expect(code).toContain('$templateCache.put');
        expect(code).toContain('page.html');
    });

    it('should escape special characters in HTML content', async () => {
        const templatesDir = join(tmpDir, 'templates');
        await mkdir(templatesDir, { recursive: true });
        const htmlWithSpecialChars = '<div title="hello">Line1\nLine2</div>\n<span class="test\\">end</span>';
        await writeFile(join(templatesDir, 'special.html'), htmlWithSpecialChars);

        const bundle = await rollup({
            input: 'entry',
            external: ['angular'],
            plugins: [
                entryPlugin("import templates from 'templates'; console.log(templates);"),
                templateCache({
                    templates: join(templatesDir, '**/*.html'),
                    rootDir: templatesDir,
                    importAngular: false,
                }),
            ],
        });
        const { output } = await bundle.generate({ format: 'es' });
        const code = output[0].code;

        // The output should be valid JavaScript (no syntax errors from unescaped chars)
        expect(code).toContain('special.html');
        expect(code).toContain('$templateCache.put');
        // Verify that the double quotes in the HTML are properly escaped
        // The js-string-escape library should escape them as \"
        expect(code).toContain('\\"hello\\"');
        // Verify it parses as valid JS (no syntax errors from unescaped characters)
        expect(() => new Function(code)).not.toThrow();
    });

    it('should handle empty glob with no matching templates', async () => {
        const templatesDir = join(tmpDir, 'templates');
        await mkdir(templatesDir, { recursive: true });
        // No HTML files created

        const bundle = await rollup({
            input: 'entry',
            external: ['angular'],
            plugins: [
                entryPlugin("import templates from 'templates'; console.log(templates);"),
                templateCache({
                    templates: join(templatesDir, '**/*.html'),
                    rootDir: templatesDir,
                    importAngular: false,
                }),
            ],
        });
        const { output } = await bundle.generate({ format: 'es' });
        const code = output[0].code;

        // Should not crash and should produce a module
        expect(code).toContain('angular.module');
        expect(code).toContain('$templateCache');
    });

    it('should use the default plugin name when no pluginName option is provided', () => {
        const plugin = templateCache({
            templates: '*.html',
            importAngular: false,
        });
        expect(plugin.name).toBe('@rollup-extras/plugin-angularjs-template-cache');
    });

    it('should create standalone module by default (with [], dependency array)', async () => {
        const templatesDir = join(tmpDir, 'templates');
        await mkdir(templatesDir, { recursive: true });
        await writeFile(join(templatesDir, 'nav.html'), '<nav>Navigation</nav>');

        const bundle = await rollup({
            input: 'entry',
            external: ['angular'],
            plugins: [
                entryPlugin("import templates from 'templates'; console.log(templates);"),
                templateCache({
                    templates: join(templatesDir, '**/*.html'),
                    rootDir: templatesDir,
                    importAngular: false,
                }),
            ],
        });
        const { output } = await bundle.generate({ format: 'es' });
        const code = output[0].code;

        expect(code).toContain('angular.module("templates", [])');
    });
});

// --- NEW TESTS FOR BRANCH COVERAGE ---

describe('@rollup-extras/plugin-angularjs-template-cache auto-import, watch, glob options, and edge cases', () => {
    let tmpDir;

    function entryPlugin2(code) {
        return {
            name: 'entry',
            resolveId(id) {
                if (id === 'entry') return id;
            },
            load(id) {
                if (id === 'entry') return code;
            },
        };
    }

    beforeEach(async () => {
        tmpDir = await mkdtemp(join(tmpdir(), 'angularjs-tc-cov-'));
    });

    afterEach(async () => {
        await rm(tmpDir, { recursive: true, force: true });
    });

    it('should auto-import templates when autoImport is true (no explicit import in entry)', async () => {
        const templatesDir = join(tmpDir, 'templates');
        await mkdir(templatesDir, { recursive: true });
        await writeFile(join(templatesDir, 'auto.html'), '<div>Auto</div>');

        const bundle = await rollup({
            input: 'entry',
            external: ['angular'],
            plugins: [
                entryPlugin2("console.log('no explicit template import');"),
                templateCache({
                    templates: join(templatesDir, '**/*.html'),
                    rootDir: templatesDir,
                    importAngular: false,
                    autoImport: true,
                }),
            ],
        });
        const { output } = await bundle.generate({ format: 'es' });
        const allCode = output.map(o => (o.type === 'chunk' ? o.code : '')).join('\n');
        expect(allCode).toContain('$templateCache.put');
        expect(allCode).toContain('Auto');
    });

    it('should not crash when watch option is false', async () => {
        const templatesDir = join(tmpDir, 'templates');
        await mkdir(templatesDir, { recursive: true });
        await writeFile(join(templatesDir, 'watched.html'), '<div>Watched</div>');

        const bundle = await rollup({
            input: 'entry',
            external: ['angular'],
            plugins: [
                entryPlugin2("import templates from 'templates'; console.log(templates);"),
                templateCache({
                    templates: join(templatesDir, '**/*.html'),
                    rootDir: templatesDir,
                    importAngular: false,
                    watch: false,
                }),
            ],
        });
        const { output } = await bundle.generate({ format: 'es' });
        const code = output[0].code;
        expect(code).toContain('$templateCache.put');
        expect(code).toContain('Watched');
    });

    it('should skip directories that match the glob pattern (e.g. something.html/)', async () => {
        const templatesDir = join(tmpDir, 'templates');
        await mkdir(templatesDir, { recursive: true });
        await writeFile(join(templatesDir, 'real.html'), '<div>Real</div>');
        await mkdir(join(templatesDir, 'something.html'), { recursive: true });

        const bundle = await rollup({
            input: 'entry',
            external: ['angular'],
            plugins: [
                entryPlugin2("import templates from 'templates'; console.log(templates);"),
                templateCache({
                    templates: join(templatesDir, '**/*.html'),
                    rootDir: templatesDir,
                    importAngular: false,
                }),
            ],
        });
        const { output } = await bundle.generate({ format: 'es' });
        const code = output[0].code;
        expect(code).toContain('Real');
        const putCount = (code.match(/\$templateCache\.put/g) || []).length;
        expect(putCount).toBe(1);
    });

    it('should produce correct output when verbose is set to list-filenames', async () => {
        const templatesDir = join(tmpDir, 'templates');
        await mkdir(templatesDir, { recursive: true });
        await writeFile(join(templatesDir, 'verbose.html'), '<div>Verbose</div>');

        const bundle = await rollup({
            input: 'entry',
            external: ['angular'],
            plugins: [
                entryPlugin2("import templates from 'templates'; console.log(templates);"),
                templateCache({
                    templates: join(templatesDir, '**/*.html'),
                    rootDir: templatesDir,
                    importAngular: false,
                    verbose: 'list-filenames',
                }),
            ],
        });
        const { output } = await bundle.generate({ format: 'es' });
        const code = output[0].code;
        expect(code).toContain('$templateCache.put');
        expect(code).toContain('Verbose');
    });

    it('should accept a string glob as shorthand options', async () => {
        const templatesDir = join(tmpDir, 'templates');
        await mkdir(templatesDir, { recursive: true });
        await writeFile(join(templatesDir, 'short.html'), '<div>Short</div>');

        const bundle = await rollup({
            input: 'entry',
            external: ['angular'],
            plugins: [
                entryPlugin2("import templates from 'templates'; console.log(templates);"),
                templateCache(join(templatesDir, '**/*.html')),
            ],
        });
        const { output } = await bundle.generate({ format: 'es' });
        const allCode = output.map(o => (o.type === 'chunk' ? o.code : '')).join('\n');
        expect(allCode).toContain('$templateCache.put');
        expect(allCode).toContain('Short');
    });

    it('should support multiple template globs', async () => {
        const dir1 = join(tmpDir, 'dir1');
        const dir2 = join(tmpDir, 'dir2');
        await mkdir(dir1, { recursive: true });
        await mkdir(dir2, { recursive: true });
        await writeFile(join(dir1, 'a.html'), '<div>A</div>');
        await writeFile(join(dir2, 'b.html'), '<div>B</div>');

        const bundle = await rollup({
            input: 'entry',
            external: ['angular'],
            plugins: [
                entryPlugin2("import templates from 'templates'; console.log(templates);"),
                templateCache({
                    templates: [join(dir1, '**/*.html'), join(dir2, '**/*.html')],
                    rootDir: tmpDir,
                    importAngular: false,
                }),
            ],
        });
        const { output } = await bundle.generate({ format: 'es' });
        const code = output[0].code;
        expect(code).toContain('A');
        expect(code).toContain('B');
        const putCount = (code.match(/\$templateCache\.put/g) || []).length;
        expect(putCount).toBe(2);
    });

    it('should return null from resolveId when the module ID does not match', () => {
        const plugin = templateCache({
            templates: '*.html',
            importAngular: false,
        });
        const result = plugin.resolveId.call({}, 'unknown-module', 'entry');
        expect(result).toBeNull();
    });

    it('should return null from load when the module ID does not match', async () => {
        const plugin = templateCache({
            templates: '*.html',
            importAngular: false,
        });
        const result = await plugin.load.call({}, 'random-id');
        expect(result).toBeNull();
    });
});

describe('@rollup-extras/plugin-angularjs-template-cache verbose logging and error handling', () => {
    let tmpDir;

    function entryPlugin3(code) {
        return {
            name: 'entry',
            resolveId(id) {
                if (id === 'entry') return id;
            },
            load(id) {
                if (id === 'entry') return code;
            },
        };
    }

    beforeEach(async () => {
        tmpDir = await mkdtemp(join(tmpdir(), 'angularjs-tc-verb-'));
    });

    afterEach(async () => {
        await rm(tmpDir, { recursive: true, force: true });
    });

    it('should produce correct output when verbose is set to true', async () => {
        const templatesDir = join(tmpDir, 'templates');
        await mkdir(templatesDir, { recursive: true });
        await writeFile(join(templatesDir, 'info.html'), '<div>Info</div>');

        const bundle = await rollup({
            input: 'entry',
            external: ['angular'],
            plugins: [
                entryPlugin3("import templates from 'templates'; console.log(templates);"),
                templateCache({
                    templates: join(templatesDir, '**/*.html'),
                    rootDir: templatesDir,
                    importAngular: false,
                    verbose: true,
                }),
            ],
        });
        const { output } = await bundle.generate({ format: 'es' });
        const code = output[0].code;
        expect(code).toContain('$templateCache.put');
        expect(code).toContain('Info');
    });

    it('should handle broken symlinks gracefully (ENOENT error path)', async () => {
        const templatesDir = join(tmpDir, 'templates');
        await mkdir(templatesDir, { recursive: true });
        await writeFile(join(templatesDir, 'valid.html'), '<div>Valid</div>');
        await symlink('/nonexistent/target.html', join(templatesDir, 'broken.html'));

        const bundle = await rollup({
            input: 'entry',
            external: ['angular'],
            plugins: [
                entryPlugin3("import templates from 'templates'; console.log(templates);"),
                templateCache({
                    templates: join(templatesDir, '**/*.html'),
                    rootDir: templatesDir,
                    importAngular: false,
                }),
            ],
        });
        const { output } = await bundle.generate({ format: 'es' });
        const code = output[0].code;
        // The valid template should still be present
        expect(code).toContain('Valid');
        expect(code).toContain('valid.html');
        // Only the valid file should have a $templateCache.put entry
        const putCount = (code.match(/\$templateCache\.put/g) || []).length;
        expect(putCount).toBe(1);
    });

    it('should handle non-ENOENT errors gracefully when reading template files', async () => {
        const templatesDir = join(tmpDir, 'templates');
        await mkdir(templatesDir, { recursive: true });
        await writeFile(join(templatesDir, 'good.html'), '<div>Good</div>');
        // Create a file and change its permissions so readFile fails with EACCES
        const noReadFile = join(templatesDir, 'noaccess.html');
        await writeFile(noReadFile, '<div>NoAccess</div>');
        await chmod(noReadFile, 0o000);

        const bundle = await rollup({
            input: 'entry',
            external: ['angular'],
            plugins: [
                entryPlugin3("import templates from 'templates'; console.log(templates);"),
                templateCache({
                    templates: join(templatesDir, '**/*.html'),
                    rootDir: templatesDir,
                    importAngular: false,
                }),
            ],
        });
        const { output } = await bundle.generate({ format: 'es' });
        const code = output[0].code;
        // The good template should still be present
        expect(code).toContain('Good');
        // Only the readable file should have a put entry
        const putCount = (code.match(/\$templateCache\.put/g) || []).length;
        expect(putCount).toBe(1);
        // Restore permissions for cleanup
        await chmod(noReadFile, 0o644);
    });

    it('should resolve .html import path when no importer is provided', () => {
        const plugin = templateCache({
            templates: '*.html',
            importAngular: false,
            transformHtmlImportsToUris: true,
        });
        const result = plugin.resolveId.call({}, 'dialog.html', undefined);
        expect(result).not.toBeNull();
        expect(result.id).toContain('dialog.html');
        expect(result.moduleSideEffects).toBe(false);
    });
});

// --- MISSING TESTS PLAN ---

describe('@rollup-extras/plugin-angularjs-template-cache (missing tests plan)', () => {
    let tmpDir;

    function entryPlugin(code) {
        return {
            name: 'entry',
            resolveId(id) {
                if (id === 'entry') return id;
            },
            load(id) {
                if (id === 'entry') return code;
            },
        };
    }

    beforeEach(async () => {
        tmpDir = await mkdtemp(join(tmpdir(), 'angularjs-tc-plan-'));
    });

    afterEach(async () => {
        await rm(tmpDir, { recursive: true, force: true });
    });

    it('should use a custom pluginName when provided', () => {
        const plugin = templateCache({ pluginName: 'my-plugin', templates: '*.html' });
        expect(plugin.name).toBe('my-plugin');
    });

    it('should use the default glob when called with no arguments', async () => {
        const templatesDir = join(tmpDir, 'project');
        await mkdir(templatesDir, { recursive: true });
        await writeFile(join(templatesDir, 'test.html'), '<div>Default</div>');

        const originalCwd = process.cwd();
        process.chdir(templatesDir);
        try {
            const bundle = await rollup({
                input: 'entry',
                external: ['angular'],
                plugins: [entryPlugin("import templates from 'templates'; console.log(templates);"), templateCache()],
            });
            const { output } = await bundle.generate({ format: 'es' });
            const allCode = output.map(o => (o.type === 'chunk' ? o.code : '')).join('\n');
            expect(allCode).toContain('$templateCache.put');
            expect(allCode).toContain('Default');
        } finally {
            process.chdir(originalCwd);
        }
    });

    it('should accept an array of globs as the sole argument', async () => {
        const dir1 = join(tmpDir, 'dir1');
        const dir2 = join(tmpDir, 'dir2');
        await mkdir(dir1, { recursive: true });
        await mkdir(dir2, { recursive: true });
        await writeFile(join(dir1, 'a.html'), '<div>A</div>');
        await writeFile(join(dir2, 'b.html'), '<div>B</div>');

        const bundle = await rollup({
            input: 'entry',
            external: ['angular'],
            plugins: [
                entryPlugin("import templates from 'templates'; console.log(templates);"),
                templateCache([join(dir1, '**/*.html'), join(dir2, '**/*.html')]),
            ],
        });
        const { output } = await bundle.generate({ format: 'es' });
        const code = output.map(o => (o.type === 'chunk' ? o.code : '')).join('\n');
        expect(code).toContain('A');
        expect(code).toContain('B');
        const putCount = (code.match(/\$templateCache\.put/g) || []).length;
        expect(putCount).toBe(2);
    });

    it('should use the current directory as rootDir when no rootDir option is provided', async () => {
        const templatesDir = join(tmpDir, 'templates');
        await mkdir(templatesDir, { recursive: true });
        await writeFile(join(templatesDir, 'widget.html'), '<div>Widget</div>');

        const originalCwd = process.cwd();
        process.chdir(tmpDir);
        try {
            const bundle = await rollup({
                input: 'entry',
                external: ['angular'],
                plugins: [
                    entryPlugin("import templates from 'templates'; console.log(templates);"),
                    templateCache({
                        templates: join(templatesDir, '**/*.html'),
                        importAngular: false,
                    }),
                ],
            });
            const { output } = await bundle.generate({ format: 'es' });
            const code = output[0].code;
            // rootDir defaults to '.', so the URI should include 'templates/widget.html'
            expect(code).toContain('templates/widget.html');
        } finally {
            process.chdir(originalCwd);
        }
    });

    it('should return null from resolveId when module option overrides the default name', () => {
        const plugin = templateCache({
            templates: '*.html',
            module: 'my-templates',
            importAngular: false,
        });
        // Resolving the default 'templates' name should return null
        const result = plugin.resolveId.call({}, 'templates', 'entry');
        expect(result).toBeNull();
    });

    it('should not include an angular import when importAngular is false', async () => {
        const templatesDir = join(tmpDir, 'templates');
        await mkdir(templatesDir, { recursive: true });
        await writeFile(join(templatesDir, 'test.html'), '<div>Test</div>');

        const bundle = await rollup({
            input: 'entry',
            external: ['angular'],
            plugins: [
                entryPlugin("import templates from 'templates'; console.log(templates);"),
                templateCache({
                    templates: join(templatesDir, '**/*.html'),
                    rootDir: templatesDir,
                    importAngular: false,
                }),
            ],
        });
        const { output } = await bundle.generate({ format: 'es' });
        const code = output[0].code;
        expect(code).not.toContain('import angular');
        expect(code).not.toContain('require("angular")');
    });

    it('should not resolve .html imports when transformHtmlImportsToUris is disabled (default)', async () => {
        const templatesDir = join(tmpDir, 'templates');
        await mkdir(templatesDir, { recursive: true });
        await writeFile(join(templatesDir, 'dialog.html'), '<div>Dialog</div>');

        const plugin = templateCache({
            templates: join(templatesDir, '**/*.html'),
            rootDir: templatesDir,
            importAngular: false,
            // transformHtmlImportsToUris defaults to false
        });

        // Importing a .html file should NOT be transformed
        const result = plugin.resolveId.call({}, './dialog.html', 'entry');
        expect(result).toBeNull();
    });

    it('should resolve .html imports relative to the importer path when transformHtmlImportsToUris is true', async () => {
        const templatesDir = join(tmpDir, 'templates');
        const subDir = join(templatesDir, 'subfolder');
        await mkdir(subDir, { recursive: true });
        await writeFile(join(subDir, 'template.html'), '<div>Relative</div>');

        const bundle = await rollup({
            input: 'entry',
            plugins: [
                entryPlugin("import uri from './templates/subfolder/template.html'; console.log(uri);"),
                templateCache({
                    templates: join(templatesDir, '**/*.html'),
                    rootDir: tmpDir,
                    importAngular: false,
                    transformHtmlImportsToUris: true,
                }),
            ],
            onwarn() {},
        });
        const { output } = await bundle.generate({ format: 'es' });
        const code = output[0].code;
        expect(code).toContain('templates/subfolder/template.html');
    });

    it('should deduplicate templates when multiple globs match the same file', async () => {
        const templatesDir = join(tmpDir, 'templates');
        await mkdir(templatesDir, { recursive: true });
        await writeFile(join(templatesDir, 'shared.html'), '<div>Shared</div>');

        const bundle = await rollup({
            input: 'entry',
            external: ['angular'],
            plugins: [
                entryPlugin("import templates from 'templates'; console.log(templates);"),
                templateCache({
                    templates: [join(templatesDir, '**/*.html'), join(templatesDir, 'shared.html')],
                    rootDir: templatesDir,
                    importAngular: false,
                }),
            ],
        });
        const { output } = await bundle.generate({ format: 'es' });
        const code = output[0].code;
        // Each template should appear only once
        const putCount = (code.match(/\$templateCache\.put/g) || []).length;
        expect(putCount).toBe(1);
    });
});
