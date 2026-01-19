import terser from '@rollup/plugin-terser';
import minifyWGSL from './rollup-plugin-minify-wgsl.js';

export default [
  // ESM build (unminified)
  {
    input: 'webgpu-instanced-lines.js',
    output: {
      file: 'dist/webgpu-instanced-lines.esm.js',
      format: 'esm',
      sourcemap: true
    }
  },
  // ESM build (minified)
  {
    input: 'webgpu-instanced-lines.js',
    output: {
      file: 'dist/webgpu-instanced-lines.esm.min.js',
      format: 'esm',
      sourcemap: true
    },
    plugins: [minifyWGSL(), terser()]
  },
  // UMD build (minified) for browser <script> tag
  {
    input: 'webgpu-instanced-lines.js',
    output: {
      file: 'dist/webgpu-instanced-lines.umd.min.js',
      format: 'umd',
      name: 'WebGPUInstancedLines',
      sourcemap: true
    },
    plugins: [minifyWGSL(), terser()]
  }
];
