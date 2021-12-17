export type StringOrArrayOptions =  string | string[] | Options[] | undefined;

export type Options = {
    // eslint-disable-next-line @typescript-eslint/ban-types
    [key: string]: string | string[] | undefined | null | boolean | Function | Options;
};

