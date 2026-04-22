/**
 * Minimal HTML tokenizer focused on extracting `<script src="…">` tags.
 *
 * What it handles correctly:
 *   - HTML comments `<!-- … -->` (content inside is ignored)
 *   - `<!DOCTYPE …>` and processing instructions `<? … ?>`
 *   - CDATA sections `<![CDATA[ … ]]>`
 *   - Case-insensitive tag and attribute names
 *   - Attribute values: double-quoted, single-quoted, unquoted
 *   - Self-closing `<script … />` (treated as empty script)
 *   - Script body is opaque until the first `</script>` (case-insensitive),
 *     matching the HTML spec
 *
 * What it does NOT do (by design):
 *   - HTML entity decoding of attribute values
 *   - `<base href>` resolution
 *   - Parsing anything other than the script extraction we need
 */

/**
 * @typedef {{ src: string, attrs: Record<string, string>, start: number, end: number, hasContent: boolean }} ScriptTag
 */

/**
 * @typedef {(src: string, attrs: Record<string, string>) => boolean} ScriptFilter
 */

/**
 * Extracts `<script src="…">` tags that match `filter` from the input HTML.
 * Returns the cleaned HTML (with matched tags removed) and the list of matched
 * scripts in document order.
 *
 * @param {string} html
 * @param {ScriptFilter} filter
 * @returns {{ cleanedHtml: string, scripts: ScriptTag[] }}
 */
export function extractScripts(html, filter) {
    /** @type {ScriptTag[]} */
    const scripts = [];
    /** @type {Array<[number, number]>} */
    const removals = [];

    const len = html.length;
    let i = 0;

    while (i < len) {
        const lt = html.indexOf('<', i);
        if (lt < 0) break;

        // HTML comment
        if (html.startsWith('<!--', lt)) {
            const end = html.indexOf('-->', lt + 4);
            i = end < 0 ? len : end + 3;
            continue;
        }

        // CDATA
        if (html.startsWith('<![CDATA[', lt)) {
            const end = html.indexOf(']]>', lt + 9);
            i = end < 0 ? len : end + 3;
            continue;
        }

        // DOCTYPE or other bogus declarations `<!…>`
        if (html[lt + 1] === '!') {
            const end = html.indexOf('>', lt + 2);
            i = end < 0 ? len : end + 1;
            continue;
        }

        // Processing instruction `<? … ?>` or `<? … >`
        if (html[lt + 1] === '?') {
            const end = html.indexOf('>', lt + 2);
            i = end < 0 ? len : end + 1;
            continue;
        }

        // Closing tag (not interesting at top level; skip to `>`)
        if (html[lt + 1] === '/') {
            const end = html.indexOf('>', lt + 2);
            i = end < 0 ? len : end + 1;
            continue;
        }

        // Not a tag-start letter — just move on
        if (!isTagNameStart(html.charCodeAt(lt + 1))) {
            i = lt + 1;
            continue;
        }

        // Opening tag: parse name
        let p = lt + 1;
        const nameStart = p;
        while (p < len && isTagNameChar(html.charCodeAt(p))) p++;
        const tagName = html.slice(nameStart, p).toLowerCase();

        // Parse attributes
        const parsed = parseAttributes(html, p);
        if (parsed == null) {
            // malformed; bail out of this tag
            i = p;
            continue;
        }
        const { attrs, end: openEnd, selfClosing } = parsed;

        if (tagName !== 'script') {
            i = openEnd;
            continue;
        }

        // Script tag — find end of body (if any)
        /** @type {number} */
        let closeEnd;
        /** @type {boolean} */
        let hasContent;
        if (selfClosing) {
            closeEnd = openEnd;
            hasContent = false;
        } else {
            // Find `</script>` case-insensitively
            const bodyStart = openEnd;
            const closeIdx = findClosingScript(html, bodyStart);
            if (closeIdx < 0) {
                // unterminated script — consume to end of document
                closeEnd = len;
                hasContent = bodyStart < len;
            } else {
                closeEnd = closeIdx.end;
                hasContent = closeIdx.start > bodyStart;
            }
        }

        const src = attrs.src;
        if (typeof src === 'string' && filter(src, attrs)) {
            scripts.push({ src, attrs, start: lt, end: closeEnd, hasContent });
            removals.push(stripSurroundingWhitespace(html, lt, closeEnd));
        }

        i = closeEnd;
    }

    return { cleanedHtml: applyRemovals(html, removals), scripts };
}

/**
 * @param {string} html
 * @param {number} start
 * @returns {{ attrs: Record<string, string>, end: number, selfClosing: boolean } | null}
 */
function parseAttributes(html, start) {
    /** @type {Record<string, string>} */
    const attrs = {};
    const len = html.length;
    let i = start;
    let selfClosing = false;

    while (i < len) {
        // skip whitespace
        while (i < len && isWhitespace(html.charCodeAt(i))) i++;
        if (i >= len) return null;

        const ch = html[i];
        if (ch === '>') {
            return { attrs, end: i + 1, selfClosing };
        }
        if (ch === '/') {
            selfClosing = true;
            i++;
            continue;
        }

        // attribute name
        const nameStart = i;
        while (i < len && isAttrNameChar(html.charCodeAt(i))) i++;
        if (i === nameStart) {
            // no progress — malformed; skip one char to avoid infinite loop
            i++;
            continue;
        }
        const name = html.slice(nameStart, i).toLowerCase();
        // skip whitespace before `=`
        while (i < len && isWhitespace(html.charCodeAt(i))) i++;

        let value = '';
        if (i < len && html[i] === '=') {
            i++;
            while (i < len && isWhitespace(html.charCodeAt(i))) i++;
            if (i >= len) return null;
            const q = html[i];
            if (q === '"' || q === "'") {
                i++;
                const vStart = i;
                while (i < len && html[i] !== q) i++;
                value = html.slice(vStart, i);
                if (i < len) i++; // consume closing quote
            } else {
                const vStart = i;
                while (i < len && !isWhitespace(html.charCodeAt(i)) && html[i] !== '>') i++;
                value = html.slice(vStart, i);
            }
        }

        attrs[name] = value;
    }

    return null;
}

/**
 * Finds the next `</script>` (case-insensitive) starting from `from`.
 *
 * @param {string} html
 * @param {number} from
 * @returns {-1 | { start: number, end: number }}
 */
function findClosingScript(html, from) {
    const len = html.length;
    let i = from;
    while (i < len) {
        const lt = html.indexOf('</', i);
        if (lt < 0) return -1;
        const after = lt + 2;
        if (
            after + 6 <= len &&
            (html.charCodeAt(after) | 0x20) === 0x73 /* s */ &&
            (html.charCodeAt(after + 1) | 0x20) === 0x63 /* c */ &&
            (html.charCodeAt(after + 2) | 0x20) === 0x72 /* r */ &&
            (html.charCodeAt(after + 3) | 0x20) === 0x69 /* i */ &&
            (html.charCodeAt(after + 4) | 0x20) === 0x70 /* p */ &&
            (html.charCodeAt(after + 5) | 0x20) === 0x74 /* t */
        ) {
            const nextCh = html.charCodeAt(after + 6);
            if (nextCh === 0x3e /* > */ || isWhitespace(nextCh) || nextCh === 0x2f /* / */) {
                const gt = html.indexOf('>', after + 6);
                if (gt < 0) return -1;
                return { start: lt, end: gt + 1 };
            }
        }
        i = lt + 2;
    }
    return -1;
}

/**
 * Expands `[start, end)` to swallow surrounding whitespace on the same line
 * and the following line break so removing the tag does not leave a blank line
 * behind. Only expands forward through spaces/tabs and up to one `\n` (with
 * optional preceding `\r`), and backward through spaces/tabs on the same line
 * only if the previous non-space char is a line break.
 *
 * @param {string} html
 * @param {number} start
 * @param {number} end
 * @returns {[number, number]}
 */
function stripSurroundingWhitespace(html, start, end) {
    let s = start;
    let e = end;
    // Look back on same line
    let back = s - 1;
    while (back >= 0 && (html[back] === ' ' || html[back] === '\t')) back--;
    const prevIsLineStart = back < 0 || html[back] === '\n' || html[back] === '\r';
    // Look ahead for trailing whitespace + single line break
    let fwd = e;
    while (fwd < html.length && (html[fwd] === ' ' || html[fwd] === '\t')) fwd++;
    if (prevIsLineStart) {
        s = back + 1;
        if (fwd < html.length && html[fwd] === '\r') fwd++;
        if (fwd < html.length && html[fwd] === '\n') fwd++;
        e = fwd;
    }
    return [s, e];
}

/**
 * @param {string} html
 * @param {Array<[number, number]>} removals
 * @returns {string}
 */
function applyRemovals(html, removals) {
    if (removals.length === 0) return html;
    let out = '';
    let cursor = 0;
    for (const [s, e] of removals) {
        out += html.slice(cursor, s);
        cursor = e;
    }
    out += html.slice(cursor);
    return out;
}

/** @param {number} c */
function isWhitespace(c) {
    return c === 0x20 || c === 0x09 || c === 0x0a || c === 0x0d || c === 0x0c;
}

/** @param {number} c */
function isTagNameStart(c) {
    return (c >= 0x41 && c <= 0x5a) || (c >= 0x61 && c <= 0x7a);
}

/** @param {number} c */
function isTagNameChar(c) {
    return (
        (c >= 0x41 && c <= 0x5a) ||
        (c >= 0x61 && c <= 0x7a) ||
        (c >= 0x30 && c <= 0x39) ||
        c === 0x2d /* - */ ||
        c === 0x5f /* _ */ ||
        c === 0x3a /* : */
    );
}

/** @param {number} c */
function isAttrNameChar(c) {
    // anything other than whitespace, `/`, `>`, `=`
    return !isWhitespace(c) && c !== 0x2f && c !== 0x3e && c !== 0x3d;
}
