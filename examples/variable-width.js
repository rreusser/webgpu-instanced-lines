// Variable width example: Per-vertex width with cosine function and rainbow color

import { createGPULines } from '../dist/webgpu-instanced-lines.esm.js';

export async function init(canvas) {
  const adapter = await navigator.gpu?.requestAdapter();
  const device = await adapter?.requestDevice();
  if (!device) throw new Error('WebGPU not supported');

  const context = canvas.getContext('webgpu');
  const format = navigator.gpu.getPreferredCanvasFormat();
  context.configure({ device, format, alphaMode: 'premultiplied' });

  // Construct positions for a sine wave
  const n = 101;
  const positions = new Float32Array(n * 4);
  for (let i = 0; i < n; i++) {
    const t = (i / (n - 1) * 2.0 - 1.0) * 0.8;
    positions[i * 4 + 0] = t;
    positions[i * 4 + 1] = 0.5 * Math.sin(8.0 * t);
    positions[i * 4 + 2] = 0;
    positions[i * 4 + 3] = 1;
  }

  const positionBuffer = device.createBuffer({
    size: positions.byteLength,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
  });
  device.queue.writeBuffer(positionBuffer, 0, positions);

  const drawLines = createGPULines(device, {
    format,
    join: 'round',
    cap: 'round',
    vertexShaderBody: /* wgsl */`
      @group(1) @binding(0) var<storage, read> positions: array<vec4f>;

      struct Vertex {
        position: vec4f,
        width: f32,
        x: f32,
      }

      fn getVertex(index: u32) -> Vertex {
        let p = positions[index];
        // Variable width based on x position
        let baseWidth = 50.0 * ${devicePixelRatio.toFixed(1)};
        let w = baseWidth * (0.5 + 0.4 * cos(16.0 * p.x));
        return Vertex(p, w, p.x);
      }
    `,
    fragmentShaderBody: /* wgsl */`
      const PI: f32 = 3.14159265359;

      fn getColor(lineCoord: vec2f, x: f32) -> vec4f {
        // Rainbow color based on x position
        let r = 0.5 + cos(8.0 * (x - 0.0 * PI / 3.0));
        let g = 0.5 + cos(8.0 * (x - 1.0 * PI / 3.0));
        let b = 0.5 + cos(8.0 * (x - 2.0 * PI / 3.0));
        return vec4f(r, g, b, 1.0);
      }
    `,
    depthWrite: false,
    depthCompare: 'always'
  });

  const dataBindGroup = device.createBindGroup({
    layout: drawLines.getBindGroupLayout(1),
    entries: [{ binding: 0, resource: { buffer: positionBuffer } }]
  });

  function render() {
    const encoder = device.createCommandEncoder();
    const pass = encoder.beginRenderPass({
      colorAttachments: [{
        view: context.getCurrentTexture().createView(),
        clearValue: [0.2, 0.2, 0.2, 1],
        loadOp: 'clear',
        storeOp: 'store'
      }]
    });

    drawLines.draw(pass, {
      vertexCount: n,
      resolution: [canvas.width, canvas.height]
    }, [dataBindGroup]);

    pass.end();
    device.queue.submit([encoder.finish()]);
  }

  render();
  window.addEventListener('resize', render);

  return { render, destroy: () => drawLines.destroy() };
}
