import { glob } from 'node:fs/promises';

/**
 * @param {string} pattern
 * @returns {string}
 */
export function globParent(pattern) {
    const parts = pattern.split('/');
    const nonGlobParts = [];
    for (const part of parts) {
        if (/[*?{[(!]/.test(part)) break;
        nonGlobParts.push(part);
    }
    return nonGlobParts.join('/') || '.';
}

/**
 * @param {string} pattern
 * @param {string | string[] | undefined} exclude
 * @returns {Promise<string[]>}
 */
export async function globFiles(pattern, exclude) {
    /** @type {string[]} */
    const result = [];
    const options = exclude != null ? { exclude: Array.isArray(exclude) ? exclude : [exclude] } : undefined;
    for await (const entry of options ? glob(pattern, options) : glob(pattern)) {
        result.push(entry);
    }
    return result;
}
