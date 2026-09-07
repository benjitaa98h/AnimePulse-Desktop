import js from '@eslint/js';
import globals from 'globals';

/** Bug-oriented only: no style rules, no formatting. */
export default [
  {
    ignores: ['dist/**', 'out/**', 'node_modules/**'],
  },

  {
    // main-process (commonjs)
    files: ['main.js', 'preload.js', 'discord-rpc.js', 'folder-watcher.js', 'src/db.js', 'src/scrobbler.js', 'src/secrets.js', 'src/logger.js'],
    ...js.configs.recommended,
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'commonjs',
      globals: { ...globals.node }
    },
    rules: {
      'eqeqeq': ['warn', 'smart'],
      'no-unused-vars': ['error', { argsIgnorePattern: '^_', caughtErrors: 'none' }]
    }
  },

  {
    // renderer: classic scripts via <script defer>, comparten scope global
    files: ['src/**/*.js'],
    ignores: ['src/db.js', 'src/scrobbler.js', 'src/secrets.js', 'src/logger.js'],
    ...js.configs.recommended,
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'commonjs',
      globals: {
        ...globals.browser,
        tailwind: 'readonly',
        lucide: 'readonly',
        animeJS: 'readonly',
        ipcRenderer: 'readonly'
      }
    },
    rules: {
      'eqeqeq': ['warn', 'smart'],
      'no-empty': ['error', { allowEmptyCatch: true }],
      'no-unused-vars': 'off'
    }
  },

  {
    // tests y configs ESM
    files: ['test/**/*.js', 'vitest.config.js', 'eslint.config.mjs'],
    ...js.configs.recommended,
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module'
    },
    rules: {
      'eqeqeq': ['warn', 'smart'],
      'no-unused-vars': ['error', { argsIgnorePattern: '^_', caughtErrors: 'none' }]
    }
  }
];