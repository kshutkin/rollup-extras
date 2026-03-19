declare module 'glob-parent' {
    function globParent(pattern: string, options?: { flipBackslashes?: boolean }): string;
    export default globParent;
}
