import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const useRolldown = process.env.BUNDLER === 'rolldown';

export default defineConfig({
    resolve: useRolldown ? {
        alias: {
            rollup: fileURLToPath(new URL('./test/rolldown-shim.mjs', import.meta.url)),
        },
    } : {},
    test: {
        include: ['**/tests/**/*.spec.mjs'],
        exclude: ['**/node_modules/**'],
        environment: 'node',
        pool: 'forks',
        silent: true,
        coverage: {
            provider: 'v8',
            reportsDirectory: './coverage',
            exclude: ['node_modules', '**/tests/**', '**/dist/**', '**/types/**', '**/*.config.js', '**/*.d.ts'],
        },
    },
});
