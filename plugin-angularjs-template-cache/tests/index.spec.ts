/* eslint-disable @typescript-eslint/no-explicit-any */
import fs from 'fs/promises';
import { glob } from 'glob';
import { createLogger, LogLevel } from '@niceties/logger';
import plugin from '../src';
import { PluginContext } from 'rollup';

let loggerStart: jest.Mock, loggerFinish: jest.Mock, logger: jest.Mock;

jest.mock('fs/promises');
jest.mock('glob');
jest.mock('@niceties/logger', () => ({
    createLogger: jest.fn(() => Object.assign((logger = jest.fn()), {
        start: (loggerStart = jest.fn()),
        finish: (loggerFinish = jest.fn())
    }))
}));

describe('@rollup-extras/plugin-angularjs-template-cache', () => {

    let rollupContextMock: Partial<PluginContext>;

    beforeEach(() => {
        (fs.readFile as unknown as jest.Mock<ReturnType<typeof fs.readFile>, Parameters<typeof fs.readFile>>).mockClear();
        (createLogger as jest.Mock<ReturnType<typeof createLogger>, Parameters<typeof createLogger>>).mockClear();
        rollupContextMock = {
            addWatchFile: jest.fn()
        };
        (glob as unknown as jest.Mock<ReturnType<typeof glob>, Parameters<typeof glob>>).mockImplementation(() => Promise.resolve(['assets/aFolder/test.json', 'assets/aFolder/test2.json']));
        (fs.readFile as jest.Mock<ReturnType<typeof fs.readFile>, Parameters<typeof fs.readFile>>).mockImplementation(() => Promise.resolve(''));
        (fs.stat as jest.Mock<ReturnType<typeof fs.stat>, Parameters<typeof fs.stat>>).mockImplementation(() => Promise.resolve({
            mtime: new Date(),
            isFile: () => true
        }) as unknown as ReturnType<typeof fs.stat>);
    });

    it('smoke', () => {
        expect(plugin).toBeDefined();
    });

    it('pluginName (default)', () => {
        const pluginInstance = plugin('views/**/*.html');
        expect((pluginInstance as {name: string}).name).toEqual('@rollup-extras/plugin-angularjs-template-cache');
    });

    it('pluginName (changed)', () => {
        const pluginInstance = plugin({ templates: 'views/**/*.html', pluginName: 'test' });
        expect((pluginInstance as {name: string}).name).toEqual('test');
    });
});
