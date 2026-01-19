import terser from '@rollup/plugin-terser';
import typescript from '@rollup/plugin-typescript';
import minifyWGSL from './rollup-plugin-minify-wgsl.js';

export default [
  // ESM build (unminified) with declaration files
  {
    input: 'webgpu-instanced-lines.ts',
    output: {
      file: 'dist/webgpu-instanced-lines.esm.js',
      format: 'esm',
      sourcemap: true
    },
    plugins: [typescript({ declaration: true, declarationDir: 'dist' })]
  },
  // ESM build (minified)
  {
    input: 'webgpu-instanced-lines.ts',
    output: {
      file: 'dist/webgpu-instanced-lines.esm.min.js',
      format: 'esm',
      sourcemap: true
    },
    plugins: [typescript(), minifyWGSL(), terser()]
  },
  // UMD build (minified) for browser <script> tag
  {
    input: 'webgpu-instanced-lines.ts',
    output: {
      file: 'dist/webgpu-instanced-lines.umd.min.js',
      format: 'umd',
      name: 'WebGPUInstancedLines',
      sourcemap: true
    },
    plugins: [typescript(), minifyWGSL(), terser()]
  }
];
