import { Logger } from '@niceties/logger';
import { PluginContext } from 'rollup';

type CallbackFunction = (this: PluginContext & { logger: Logger }) => void;

export type ExecPluginOptions = {
    pluginName?: string;
    exec?: CallbackFunction;
} | CallbackFunction;
