import { defineConfig } from 'vitest/config';

export default defineConfig({
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
