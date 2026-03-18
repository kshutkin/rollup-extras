// biome-ignore-all lint: test file

import { getOptions, getOptionsObject, multiConfigPluginBase } from '@rollup-extras/utils';
import loggerFactory from '@rollup-extras/utils/logger';
import { multiConfigPluginBase as mcpb } from '@rollup-extras/utils/mutli-config-plugin-base';
import { getOptions as go, getOptionsObject as goo } from '@rollup-extras/utils/options';
import statistics from '@rollup-extras/utils/statistics';

import type { NormalizedOutputOptions, OutputBundle, Plugin, PluginContext } from 'rollup';

// ============================================================================
// multiConfigPluginBase
// ============================================================================

const execute = function (this: PluginContext, options: NormalizedOutputOptions, bundle: OutputBundle) {};
const plugin = multiConfigPluginBase(false, 'test-plugin', execute);
const pluginName: string = plugin.name;
const newInstance: Plugin = plugin.api.addInstance();

// with useWriteBundle
const wbPlugin = multiConfigPluginBase(true, 'test-wb', execute);

// with onFinalHook
const onFinal = function (
    this: PluginContext,
    options: NormalizedOutputOptions,
    bundle: OutputBundle,
    remaining: number,
    remainingOutputs: number
) {};
const fhPlugin = multiConfigPluginBase(false, 'test-fh', execute, onFinal);

// ============================================================================
// getOptionsObject
// ============================================================================

const result1 = getOptionsObject({ foo: 'bar' }, { baz: 42 });
const foo: string = result1.foo;
const baz: number = result1.baz;

// ============================================================================
// getOptions
// ============================================================================

const result2 = getOptions('hello', { pluginName: 'test' }, 'targets');
const result3 = getOptions(['a', 'b'], { pluginName: 'test' }, 'targets');
const result4 = getOptions({ targets: ['a'] }, { pluginName: 'test' }, 'targets');

// ============================================================================
// logger factory
// ============================================================================

const logger = loggerFactory({ pluginName: 'my-plugin' });
logger('hello');
logger.start('starting');
logger.finish('done');

// ============================================================================
// statistics
// ============================================================================

const stat = statistics(false, result => `copied ${typeof result === 'number' ? result + ' files' : result.join(', ')}`);
stat('file1');
stat('file2');
const msg: string | undefined = stat();

// ============================================================================
// Negative tests
// ============================================================================

// @ts-expect-error - multiConfigPluginBase requires pluginName string
multiConfigPluginBase(false, 123, execute);

// @ts-expect-error - statistics requires boolean and function
statistics('not-bool', r => '');
