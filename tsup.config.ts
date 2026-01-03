import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts', 'src/manager.tsx', 'src/preset.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  splitting: false,
  sourcemap: true,
  clean: true,
  external: ['storybook', 'react', 'react-dom', '@storybook/icons'],
  esbuildOptions(options) {
    options.jsx = 'automatic';
  },
});
