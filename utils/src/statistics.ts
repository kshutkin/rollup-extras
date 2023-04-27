export default function statistics(verbose: boolean, messageFactory: (result: number | string[]) => string) {
    let count = 0, names: string[] | null = verbose ? null : [];
    return (name?: string): undefined | string => {
        if (name != null) {
            count ++;
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