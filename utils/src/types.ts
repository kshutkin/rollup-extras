export type SimpleOptions = string | string[] | undefined;

export type DefaultsFactory<T extends {[key: string]: unknown}> = {
    [key: string]: ((options: T, field: string) => unknown);
}

export type Result<T extends {[key: string]: unknown}, F extends DefaultsFactory<T>> = T & {
    [key in keyof F]: F[key] extends ((options: T, field: string) => unknown) ? ReturnType<F[key]> : unknown;
}