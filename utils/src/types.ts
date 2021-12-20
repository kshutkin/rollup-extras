// eslint-disable-next-line @typescript-eslint/ban-types
export type Value = boolean | string | string[] | number | undefined | Function;

export type Options = {
    // eslint-disable-next-line @typescript-eslint/ban-types
    [key: string]: string | string[] | undefined | null | boolean | Function | Options;
};

export type SimpleOptions = string | string[] | undefined;

export type DefaultsFactory<T extends {[key: string]: unknown}> = {
    [key: string]: ((options: T | undefined, field: string) => unknown);
}

export type Result<T extends {[key: string]: unknown}, F extends DefaultsFactory<T>> = T & {
    [key in keyof F]: F[key] extends ((options: T | undefined, field: string) => unknown) ? ReturnType<F[key]> : unknown;
}