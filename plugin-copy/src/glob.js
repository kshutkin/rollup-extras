import { glob, lstat } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

import globParent from 'glob-parent';

/**
 * @param {string} pattern
 * @param {string | string[] | undefined} exclude
 * @param {boolean} [followSymlinks]
 * @returns {Promise<string[]>}
 */
export async function globFiles(pattern, exclude, followSymlinks = true) {
    /** @type {string[]} */
    const result = [];
    const options = { followSymlinks, exclude: exclude == null ? undefined : Array.isArray(exclude) ? exclude : [exclude] };
    const parent = resolve(globParent(pattern));
    /** @type {Map<string, boolean>} */
    const symlinkDirs = new Map();
    for await (const entry of glob(pattern, options)) {
        // Older Node versions ignore followSymlinks, so filter their results too.
        if (!followSymlinks) {
            let directory = dirname(resolve(entry));
            let insideSymlink = false;
            while (directory !== parent && dirname(directory) !== directory) {
                if (!symlinkDirs.has(directory)) {
                    symlinkDirs.set(directory, (await lstat(directory)).isSymbolicLink());
                }
                if (symlinkDirs.get(directory)) {
                    insideSymlink = true;
                    break;
                }
                directory = dirname(directory);
            }
            if (insideSymlink) continue;
        }
        result.push(entry);
    }
    return result;
}
