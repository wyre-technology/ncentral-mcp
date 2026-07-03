import { defineConfig } from 'tsup';

export default defineConfig([
  {
    entry: { index: 'src/index.ts', http: 'src/http.ts' },
    format: ['esm'],
    target: 'node22',
    outDir: 'dist',
    clean: true,
    sourcemap: true,
  },
]);
