import type { createLogger } from '@niceties/logger';

export default function logger(options: { pluginName?: string }): ReturnType<typeof createLogger>;
