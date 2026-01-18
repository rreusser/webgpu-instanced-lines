import terser from '@rollup/plugin-terser';

export default [
  // ESM build (unminified)
  {
    input: 'webgpu-lines.js',
    output: {
      file: 'dist/webgpu-lines.esm.js',
      format: 'esm',
      sourcemap: true
    }
  },
  // ESM build (minified)
  {
    input: 'webgpu-lines.js',
    output: {
      file: 'dist/webgpu-lines.esm.min.js',
      format: 'esm',
      sourcemap: true
    },
    plugins: [terser()]
  },
  // UMD build (minified) for browser <script> tag
  {
    input: 'webgpu-lines.js',
    output: {
      file: 'dist/webgpu-lines.umd.min.js',
      format: 'umd',
      name: 'WebGPULines',
      sourcemap: true
    },
    plugins: [terser()]
  }
];
