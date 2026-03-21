// biome-ignore-all lint: test file

import { getOptions, getOptionsObject, multiConfigPluginBase } from '@rollup-extras/utils';
import loggerFactory from '@rollup-extras/utils/logger';
import { multiConfigPluginBase as mcpb } from '@rollup-extras/utils/multi-config-plugin-base';
import { getOptions as go, getOptionsObject as goo } from '@rollup-extras/utils/options';
import statistics from '@rollup-extras/utils/statistics';

import type { NormalizedOutputOptions, OutputBundle, Plugin, PluginContext } from 'rollup';

// ============================================================================
// Type assertion helpers
// ============================================================================

type IsExact<T, U> = [T] extends [U] ? ([U] extends [T] ? true : false) : false;
type Assert<T extends true> = T;
type Has<T, K extends string> = K extends keyof T ? true : false;

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

// Verify the return type is not `any` — these would fail if result1 were `any`
type _r1HasFoo = Assert<Has<typeof result1, 'foo'>>;
type _r1HasBaz = Assert<Has<typeof result1, 'baz'>>;
type _r1FooIsString = Assert<IsExact<typeof result1.foo, string>>;
type _r1BazIsNumber = Assert<IsExact<typeof result1.baz, number>>;

// getOptionsObject with factory
const result1f = getOptionsObject(
    { foo: 'bar' },
    { baz: 42 },
    { logger: (options: Partial<{ foo: string }>, field: string) => console.log }
);
type _r1fHasLogger = Assert<Has<typeof result1f, 'logger'>>;

// getOptionsObject via subpath import
const result1sub = goo({ foo: 'bar' }, { baz: 42 });
type _r1subHasFoo = Assert<Has<typeof result1sub, 'foo'>>;
type _r1subHasBaz = Assert<Has<typeof result1sub, 'baz'>>;
type _r1subFooIsString = Assert<IsExact<typeof result1sub.foo, string>>;
type _r1subBazIsNumber = Assert<IsExact<typeof result1sub.baz, number>>;

// ============================================================================
// getOptions
// ============================================================================

const result2 = getOptions('hello', { pluginName: 'test' }, 'targets');
const result3 = getOptions(['a', 'b'], { pluginName: 'test' }, 'targets');
const result4 = getOptions({ targets: ['a'] }, { pluginName: 'test' }, 'targets');

// Verify return type carries defaults
type _r2HasPluginName = Assert<Has<typeof result2, 'pluginName'>>;
type _r3HasPluginName = Assert<Has<typeof result3, 'pluginName'>>;
type _r4HasPluginName = Assert<Has<typeof result4, 'pluginName'>>;

// getOptions via subpath import
const result2sub = go('hello', { pluginName: 'test' }, 'targets');
type _r2subHasPluginName = Assert<Has<typeof result2sub, 'pluginName'>>;

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
