import { BinifyPluginOptions } from './types';

export function shebang(options: BinifyPluginOptions): string {
    let shebangValue: string = options.shebang as string;
    // we can have includes() here instead of endsWith()
    // and allow to do weird tricks with first line of js file
    // but it is not an intention of this plugin
    if (!shebangValue.endsWith('\n')) {
        shebangValue += '\n';
    }
    return shebangValue;
}
