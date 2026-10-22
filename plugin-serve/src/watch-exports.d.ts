import type { RollupWatcher, RollupWatchOptions } from 'rollup';

/**
 * Watch and generate Rollup output in memory, closing each build result automatically.
 * Configure `serve({ inMemory: true })` in the supplied Rollup configuration.
 */
export default function watch(config: RollupWatchOptions | RollupWatchOptions[]): RollupWatcher;
