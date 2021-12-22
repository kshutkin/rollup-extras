import { createLogger } from '@niceties/logger';

export default function(options: { pluginName?: string }): ReturnType<typeof createLogger> {
    return createLogger(options.pluginName);
}