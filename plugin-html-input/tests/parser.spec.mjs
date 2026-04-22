import { describe, expect, it } from 'vitest';

import { extractScripts } from '../src/parser.js';

const all = () => true;

describe('extractScripts', () => {
    it('extracts a simple module script', () => {
        const html = '<!doctype html><html><head></head><body><script type="module" src="main.js"></script></body></html>';
        const { cleanedHtml, scripts } = extractScripts(html, all);
        expect(scripts).toHaveLength(1);
        expect(scripts[0].src).toBe('main.js');
        expect(scripts[0].attrs.type).toBe('module');
        expect(cleanedHtml).not.toContain('<script');
        expect(cleanedHtml).toContain('</body>');
    });

    it('handles single-quoted and unquoted attributes', () => {
        const html = "<script src='a.js' defer></script><script src=b.js type=module></script>";
        const { scripts } = extractScripts(html, all);
        expect(scripts.map(s => s.src)).toEqual(['a.js', 'b.js']);
        expect(scripts[0].attrs.defer).toBe('');
        expect(scripts[1].attrs.type).toBe('module');
    });

    it('is case-insensitive for tag and attribute names', () => {
        const html = '<SCRIPT SRC="x.js" TYPE="MODULE"></SCRIPT>';
        const { scripts, cleanedHtml } = extractScripts(html, all);
        expect(scripts).toHaveLength(1);
        expect(scripts[0].src).toBe('x.js');
        expect(scripts[0].attrs.type).toBe('MODULE');
        expect(cleanedHtml).toBe('');
    });

    it('ignores <script> inside HTML comments', () => {
        const html = '<!-- <script src="ignored.js"></script> --><script src="real.js"></script>';
        const { scripts, cleanedHtml } = extractScripts(html, all);
        expect(scripts).toHaveLength(1);
        expect(scripts[0].src).toBe('real.js');
        expect(cleanedHtml).toContain('<!--');
        expect(cleanedHtml).toContain('ignored.js');
    });

    it('treats script body as opaque until </script>', () => {
        const html = '<script src="a.js">var x = "</scr" + "ipt>";</script>';
        const { scripts } = extractScripts(html, all);
        expect(scripts).toHaveLength(1);
        expect(scripts[0].hasContent).toBe(true);
    });

    it('handles self-closing script tag', () => {
        const html = '<div><script src="a.js" type="module" /></div>';
        const { scripts, cleanedHtml } = extractScripts(html, all);
        expect(scripts).toHaveLength(1);
        expect(scripts[0].src).toBe('a.js');
        expect(scripts[0].hasContent).toBe(false);
        expect(cleanedHtml).toBe('<div></div>');
    });

    it('skips CDATA sections', () => {
        const html = '<root><![CDATA[<script src="inside.js"></script>]]><script src="outside.js"></script></root>';
        const { scripts } = extractScripts(html, all);
        expect(scripts.map(s => s.src)).toEqual(['outside.js']);
    });

    it('skips DOCTYPE and processing instructions', () => {
        const html = '<!DOCTYPE html><?xml version="1.0"?><script src="a.js"></script>';
        const { scripts } = extractScripts(html, all);
        expect(scripts).toHaveLength(1);
    });

    it('only removes tags matched by the filter', () => {
        const html = '<script src="keep.js"></script><script type="module" src="remove.js"></script>';
        const { cleanedHtml, scripts } = extractScripts(html, (_src, attrs) => attrs.type === 'module');
        expect(scripts).toHaveLength(1);
        expect(scripts[0].src).toBe('remove.js');
        expect(cleanedHtml).toContain('keep.js');
        expect(cleanedHtml).not.toContain('remove.js');
    });

    it('strips surrounding whitespace on a removed line', () => {
        const html = '<head>\n    <script type="module" src="a.js"></script>\n</head>';
        const { cleanedHtml } = extractScripts(html, all);
        expect(cleanedHtml).toBe('<head>\n</head>');
    });

    it('leaves inline script (no src) alone by default', () => {
        const html = '<script>console.log(1)</script><script src="a.js"></script>';
        const { cleanedHtml, scripts } = extractScripts(html, all);
        expect(scripts.map(s => s.src)).toEqual(['a.js']);
        expect(cleanedHtml).toContain('console.log(1)');
    });

    it('returns empty result when no scripts match', () => {
        const html = '<html><body>Hello</body></html>';
        const { cleanedHtml, scripts } = extractScripts(html, all);
        expect(scripts).toHaveLength(0);
        expect(cleanedHtml).toBe(html);
    });

    it('handles multiple consecutive scripts', () => {
        const html = '<script src="a.js"></script><script src="b.js"></script><script src="c.js"></script>';
        const { scripts, cleanedHtml } = extractScripts(html, all);
        expect(scripts.map(s => s.src)).toEqual(['a.js', 'b.js', 'c.js']);
        expect(cleanedHtml).toBe('');
    });
});
