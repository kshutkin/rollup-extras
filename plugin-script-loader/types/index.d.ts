declare module '@rollup-extras/plugin-script-loader' {
	import type { Plugin } from 'rollup';
	export default function _default(options?: ScriptLoaderPluginOptions): Plugin;
	export type ScriptLoaderPluginOptions = {
		prefix?: string;
		useStrict?: boolean;
		pluginName?: string;
		verbose?: boolean;
	};

	export {};
}

//# sourceMappingURL=index.d.ts.map