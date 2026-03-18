/**
 * @param {boolean} verbose
 * @param {(result: number | string[]) => string} messageFactory
 * @returns {(name?: string) => undefined | string}
 */
export default function statistics(verbose, messageFactory) {
    let count = 0,
        names = verbose ? null : /** @type {string[]} */ ([]);
    return name => {
        if (name != null) {
            count++;
            if (names) {
                if (count > 5) {
                    names = null;
                } else {
                    names.push(name);
                }
            }
            return;
        }
        return messageFactory(!names ? count : names);
    };
}
