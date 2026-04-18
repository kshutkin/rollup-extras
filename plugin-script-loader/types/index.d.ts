declare module '@rollup-extras/plugin-script-loader' {
	import type { Plugin, SourceMap } from 'rollup';
	export default function _default(options?: ScriptLoaderPluginOptions): Plugin;
	export type ScriptLoaderPluginOptions = {
		prefix?: string;
		useStrict?: boolean;
		pluginName?: string;
		verbose?: boolean;
		emit?: "inline" | "asset";
		name?: string;
		exactFileName?: boolean;
		sourcemap?: boolean;
		minify?: (code: string, sourcemap?: SourceMap) => Promise<{
			code: string;
			map?: SourceMap;
		}>;
	};
	export type ScriptEntry = {
		order: number;
		filePath: string;
		code: string;
		originalMap?: SourceMap;
	};

	export {};
}

//# sourceMappingURL=index.d.ts.map