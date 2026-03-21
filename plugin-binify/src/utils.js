/**
 * @param {string} value
 * @param {string} symbol
 * @returns {number}
 */
export function count(value, symbol) {
    let occurrences = 0;

    for (const s of value) s === symbol && ++occurrences;

    return occurrences;
}
