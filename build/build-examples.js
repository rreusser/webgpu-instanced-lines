#!/usr/bin/env node

import { readFileSync, writeFileSync, readdirSync, rmSync } from 'fs';
import { join, basename, dirname } from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, '..');
const examplesDistDir = join(rootDir, 'examples-dist', 'examples');
const outDir = join(rootDir, '_site');

// Step 1: Compile TypeScript examples
console.log('Compiling TypeScript examples...');
try {
  execSync('npx tsc -p tsconfig.examples.json', { cwd: rootDir, stdio: 'inherit' });
} catch (error) {
  console.error('TypeScript compilation failed');
  process.exit(1);
}

// Read the main library source (compiled from TypeScript)
const librarySource = readFileSync(join(rootDir, 'dist/webgpu-instanced-lines.esm.js'), 'utf8');

// Get all compiled example files
const examples = readdirSync(examplesDistDir)
  .filter(f => f.endsWith('.js'))
  .map(f => basename(f, '.js'));

function generateHTML(name, exampleSource) {
  // Remove the import statement and adjust the source
  const adjustedSource = exampleSource
    .replace(/import\s*\{[^}]+\}\s*from\s*['"][^'"]+['"];\s*/g, '')
    .trim();

  return `<!DOCTYPE html>
<html>
<head>
  <title>webgpu-instanced-lines: ${name}</title>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/github.min.css">
  <script src="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/highlight.min.js"></script>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/languages/javascript.min.js"></script>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body { width: 100%; height: 100%; overflow: hidden; }
    canvas {
      width: 100%;
      height: 100%;
      display: block;
    }
    #code-container {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      position: absolute;
      left: 0;
      top: 0;
      z-index: 10;
      max-height: 90%;
      max-width: 90%;
      overflow: auto;
      background-color: white;
      border-radius: 0 0 8px 0;
      box-shadow: 0 2px 10px rgba(0,0,0,0.2);
    }
    #code-container summary {
      padding: 12px 16px;
      cursor: pointer;
      font-weight: 500;
      user-select: none;
    }
    #code-container pre {
      margin: 0;
      padding: 0 16px 16px;
    }
    #code-container code {
      font-size: 13px;
      line-height: 1.5;
    }
    #error {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      text-align: center;
      color: #c00;
      max-width: 80%;
    }
  </style>
</head>
<body>
<canvas id="canvas"></canvas>
<div id="code-container">
  <details>
    <summary>View Source</summary>
    <pre><code class="language-javascript" id="code"></code></pre>
  </details>
</div>
<div id="error"></div>

<script type="module">
// webgpu-instanced-lines library (inlined)
${librarySource}

// Example code
${adjustedSource}

// Initialize
const canvas = document.getElementById('canvas');
const error = document.getElementById('error');

function resize() {
  canvas.width = canvas.clientWidth * devicePixelRatio;
  canvas.height = canvas.clientHeight * devicePixelRatio;
}

resize();
window.addEventListener('resize', resize);

init(canvas).catch(err => {
  console.error(err);
  error.textContent = err.message || 'WebGPU initialization failed';
});

// Syntax highlighting
const codeEl = document.getElementById('code');
codeEl.textContent = ${JSON.stringify(adjustedSource)};
hljs.highlightElement(codeEl);
</script>
</body>
</html>`;
}

// Build all examples
for (const name of examples) {
  const examplePath = join(examplesDistDir, `${name}.js`);
  const exampleSource = readFileSync(examplePath, 'utf8');
  const html = generateHTML(name, exampleSource);
  const outputPath = join(outDir, `${name}.html`);
  writeFileSync(outputPath, html);
  console.log(`Built: _site/${name}.html`);
}

// Clean up compiled examples directory
rmSync(join(rootDir, 'examples-dist'), { recursive: true, force: true });

console.log(`\nBuilt ${examples.length} examples`);
