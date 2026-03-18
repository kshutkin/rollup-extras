export default function statistics(
    verbose: boolean,
    messageFactory: (result: number | string[]) => string
): (name?: string) => undefined | string;
