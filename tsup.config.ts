import {defineConfig} from 'tsup';

export default defineConfig({
  entry: ['src/index.ts', 'src/runtime.ts'],
  format: ['esm', 'cjs'],
  shims: true,
  dts: true,
  clean: true,
  external: ['vite'],
});