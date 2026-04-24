/**
 * Tokenizer-based comment scanner, ported from
 * https://github.com/kshutkin/package-prune (pkgprn/src/strip-comments.js).
 *
 * Correctly handles:
 * - Single and double quoted strings (with escapes)
 * - Template literals (with nested `${…}` expressions, arbitrarily deep)
 * - Regular expression literals (with character classes `[…]`)
 * - Hashbang lines (`#!/…`)
 * - Single-line comments (`// …`)
 * - Block comments (slash-star … star-slash)
 */

/**
 * @typedef {'jsdoc' | 'license' | 'regular' | 'annotation'} CommentType
 */

/**
 * @typedef {Object} CommentRange
 * @property {number} start Start index in source (inclusive).
 * @property {number} end End index in source (exclusive).
 * @property {CommentType} type Classification of the comment.
 */

const jsExtensions = ['.js', '.mjs', '.cjs'];

/**
 * @param {string} file
 * @returns {boolean}
 */
export function isStrippableFile(file) {
    return jsExtensions.some(ext => file.endsWith(ext));
}

/**
 * Keywords after which a `/` token begins a regex literal rather than division.
 */
const regexPrecedingKeywords = new Set([
    'return',
    'throw',
    'typeof',
    'void',
    'delete',
    'new',
    'in',
    'instanceof',
    'case',
    'yield',
    'await',
    'of',
    'export',
    'import',
    'default',
    'extends',
    'else',
]);

/**
 * Classify a block comment based on its content.
 * Priority: license > jsdoc > annotation > regular.
 *
 * @param {string} source
 * @param {number} start Start index of the comment (at `/`).
 * @param {number} end End index of the comment (after the closing star-slash).
 * @returns {CommentType}
 */
function classifyBlockComment(source, start, end) {
    // License: starts with /*! or contains @license / @preserve
    if (source[start + 2] === '!') {
        return 'license';
    }

    const body = source.slice(start + 2, end - 2);
    if (body.includes('@license') || body.includes('@preserve')) {
        return 'license';
    }

    // JSDoc: starts with /** (and not the degenerate /**/)
    if (source[start + 2] === '*' && end - start > 4) {
        return 'jsdoc';
    }

    // Annotation: bundler hints like /*#__PURE__*/, /*@__PURE__*/, /*#__NO_SIDE_EFFECTS__*/, etc.
    if (/^[#@]__[A-Z_]+__$/.test(body.trim())) {
        return 'annotation';
    }

    return 'regular';
}

/**
 * Scan source code and return an array of comment ranges with their types.
 *
 * @param {string} source
 * @returns {CommentRange[]}
 */
export function scanComments(source) {
    /** @type {CommentRange[]} */
    const comments = [];
    const len = source.length;
    let i = 0;

    /** @type {number[]} */
    const templateStack = [];

    let exprEnd = false;

    if (len >= 2 && source[0] === '#' && source[1] === '!') {
        while (i < len && source[i] !== '\n') i++;
    }

    while (i < len) {
        const ch = source.charCodeAt(i);

        if (ch <= 0x20 || ch === 0xfeff || ch === 0xa0) {
            i++;
            continue;
        }

        // single-line comment
        if (ch === 0x2f && i + 1 < len && source.charCodeAt(i + 1) === 0x2f) {
            const start = i;
            i += 2;
            while (i < len && source.charCodeAt(i) !== 0x0a) i++;
            comments.push({ start, end: i, type: 'regular' });
            continue;
        }

        // block comment
        if (ch === 0x2f && i + 1 < len && source.charCodeAt(i + 1) === 0x2a) {
            const start = i;
            i += 2;
            while (i < len && !(source.charCodeAt(i) === 0x2a && i + 1 < len && source.charCodeAt(i + 1) === 0x2f)) {
                i++;
            }
            if (i < len) i += 2;
            comments.push({ start, end: i, type: classifyBlockComment(source, start, i) });
            continue;
        }

        // regex literal
        if (ch === 0x2f && !exprEnd) {
            i = skipRegex(source, i, len);
            exprEnd = true;
            continue;
        }

        if (ch === 0x27) {
            i = skipSingleString(source, i, len);
            exprEnd = true;
            continue;
        }

        if (ch === 0x22) {
            i = skipDoubleString(source, i, len);
            exprEnd = true;
            continue;
        }

        if (ch === 0x60) {
            i = scanTemplateTail(source, i + 1, len, templateStack);
            exprEnd = true;
            continue;
        }

        if (ch === 0x7d) {
            if (templateStack.length > 0) {
                const depth = templateStack[templateStack.length - 1];
                if (depth === 0) {
                    templateStack.pop();
                    i = scanTemplateTail(source, i + 1, len, templateStack);
                    exprEnd = true;
                    continue;
                }
                templateStack[templateStack.length - 1] = depth - 1;
            }
            i++;
            exprEnd = false;
            continue;
        }

        if (ch === 0x7b) {
            if (templateStack.length > 0) {
                templateStack[templateStack.length - 1]++;
            }
            i++;
            exprEnd = false;
            continue;
        }

        if (isIdentStart(ch) || isDigit(ch)) {
            const wordStart = i;
            i++;
            while (i < len && isIdentPart(source.charCodeAt(i))) i++;
            const word = source.slice(wordStart, i);
            exprEnd = !regexPrecedingKeywords.has(word);
            continue;
        }

        if ((ch === 0x2b || ch === 0x2d) && i + 1 < len && source.charCodeAt(i + 1) === ch) {
            i += 2;
            exprEnd = true;
            continue;
        }

        if (ch === 0x29 || ch === 0x5d) {
            i++;
            exprEnd = true;
            continue;
        }

        i++;
        exprEnd = false;
    }

    return comments;
}

/**
 * @param {number} ch
 * @returns {boolean}
 */
function isDigit(ch) {
    return ch >= 0x30 && ch <= 0x39;
}

/**
 * @param {number} ch
 * @returns {boolean}
 */
function isIdentStart(ch) {
    return (ch >= 0x41 && ch <= 0x5a) || (ch >= 0x61 && ch <= 0x7a) || ch === 0x5f || ch === 0x24 || ch === 0x5c || ch > 0x7f;
}

/**
 * @param {number} ch
 * @returns {boolean}
 */
function isIdentPart(ch) {
    return isIdentStart(ch) || isDigit(ch);
}

/**
 * @param {string} s
 * @param {number} i
 * @param {number} len
 * @returns {number}
 */
function skipSingleString(s, i, len) {
    i++;
    while (i < len) {
        const ch = s.charCodeAt(i);
        if (ch === 0x27) {
            i++;
            break;
        }
        if (ch === 0x5c) {
            i += 2;
            continue;
        }
        if (ch === 0x0a || ch === 0x0d) break;
        i++;
    }
    return i;
}

/**
 * @param {string} s
 * @param {number} i
 * @param {number} len
 * @returns {number}
 */
function skipDoubleString(s, i, len) {
    i++;
    while (i < len) {
        const ch = s.charCodeAt(i);
        if (ch === 0x22) {
            i++;
            break;
        }
        if (ch === 0x5c) {
            i += 2;
            continue;
        }
        if (ch === 0x0a || ch === 0x0d) break;
        i++;
    }
    return i;
}

/**
 * @param {string} s
 * @param {number} i
 * @param {number} len
 * @returns {number}
 */
function skipRegex(s, i, len) {
    i++;
    while (i < len) {
        const ch = s.charCodeAt(i);
        if (ch === 0x5c) {
            i += 2;
            continue;
        }
        if (ch === 0x5b) {
            i++;
            while (i < len) {
                const cc = s.charCodeAt(i);
                if (cc === 0x5c) {
                    i += 2;
                    continue;
                }
                if (cc === 0x5d) {
                    i++;
                    break;
                }
                if (cc === 0x0a || cc === 0x0d) break;
                i++;
            }
            continue;
        }
        if (ch === 0x2f) {
            i++;
            while (i < len && isRegexFlag(s.charCodeAt(i))) i++;
            break;
        }
        if (ch === 0x0a || ch === 0x0d) break;
        i++;
    }
    return i;
}

/**
 * @param {number} ch
 * @returns {boolean}
 */
function isRegexFlag(ch) {
    return ch >= 0x61 && ch <= 0x7a;
}

/**
 * Scan the body of a template literal starting after the opening backtick
 * (or after the `}` that closes a template expression).
 *
 * @param {string} s
 * @param {number} i
 * @param {number} len
 * @param {number[]} templateStack
 * @returns {number}
 */
function scanTemplateTail(s, i, len, templateStack) {
    while (i < len) {
        const ch = s.charCodeAt(i);
        if (ch === 0x5c) {
            i += 2;
            continue;
        }
        if (ch === 0x60) {
            i++;
            return i;
        }
        if (ch === 0x24 && i + 1 < len && s.charCodeAt(i + 1) === 0x7b) {
            i += 2;
            templateStack.push(0);
            return i;
        }
        i++;
    }
    return i;
}

/**
 * Parse a types value into a `Set` of comment types.
 *
 * - `true`                   → `{'jsdoc', 'regular'}`
 * - `['jsdoc', 'regular']`   → `{'jsdoc', 'regular'}`
 * - `['license']`            → `{'license'}`
 * - `['annotation']`         → `{'annotation'}`
 *
 * @param {CommentType[] | readonly CommentType[] | true} value
 * @returns {Set<CommentType>}
 */
export function parseCommentTypes(value) {
    if (value === true) {
        return new Set(/** @type {CommentType[]} */ (['jsdoc', 'regular']));
    }

    const valid = /** @type {CommentType[]} */ (['jsdoc', 'license', 'regular', 'annotation']);

    /** @type {Set<CommentType>} */
    const result = new Set();

    for (const part of value) {
        if (!valid.includes(/** @type {CommentType} */ (part))) {
            throw new Error(`unknown comment type "${part}" (expected: ${valid.join(', ')})`);
        }
        result.add(/** @type {CommentType} */ (part));
    }

    if (result.size === 0) {
        return new Set(/** @type {CommentType[]} */ (['jsdoc', 'regular']));
    }

    return result;
}
