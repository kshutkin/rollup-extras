export function count(value: string, symbol: string) {
    let occurrences = 0;

    for (const s of value) s === symbol && ++occurrences;

    return occurrences;
}