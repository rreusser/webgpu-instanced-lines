// Multiple example: Multiple separate lines with line breaks (NaN/w=0)

import { createGPULines } from '../webgpu-lines.js';

export async function init(canvas) {
  const adapter = await navigator.gpu?.requestAdapter();
  const device = await adapter?.requestDevice();
  if (!device) throw new Error('WebGPU not supported');

  const context = canvas.getContext('webgpu');
  const format = navigator.gpu.getPreferredCanvasFormat();
  context.configure({ device, format, alphaMode: 'premultiplied' });

  const n = 31;
  const lineCount = 10;

  // Build positions with line breaks (w=0) between each line
  const points = [];

  // Start with a break to signal a cap
  points.push([NaN, NaN, 0, 0]);

  for (let line = 0; line < lineCount; line++) {
    for (let i = 0; i < n; i++) {
      const t = (i / (n - 1) * 2 - 1) * 0.9;
      const y = ((line + 0.5) / lineCount * 2 - 1) * 0.9;
      const x = t;
      const yOffset = (1 / lineCount) * Math.sin((t - line * 0.1) * 8.0);
      points.push([x, y + yOffset, 0, 1]);
    }
    // Signal a cap after each line
    points.push([NaN, NaN, 0, 0]);
  }

  const positions = new Float32Array(points.length * 4);
  for (let i = 0; i < points.length; i++) {
    positions[i * 4 + 0] = points[i][0];
    positions[i * 4 + 1] = points[i][1];
    positions[i * 4 + 2] = points[i][2];
    positions[i * 4 + 3] = points[i][3];
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
        uv: vec2f,
      }

      fn getVertex(index: u32) -> Vertex {
        let p = positions[index];
        return Vertex(p, 40.0, p.xy);
      }
    `,
    fragmentShaderBody: /* wgsl */`
      const PI: f32 = 3.14159265359;

      fn getColor(lineCoord: vec2f, uv: vec2f) -> vec4f {
        // Convert the x-coordinate into a rainbow color
        let r = 0.6 + 0.4 * cos(8.0 * (uv.x - 0.0 * PI / 3.0));
        let g = 0.6 + 0.4 * cos(8.0 * (uv.x - 1.0 * PI / 3.0));
        let b = 0.6 + 0.4 * cos(8.0 * (uv.x - 2.0 * PI / 3.0));
        return vec4f(r, g, b, 0.7);
      }
    `,
    blend: {
      color: { srcFactor: 'src-alpha', dstFactor: 'one-minus-src-alpha', operation: 'add' },
      alpha: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha', operation: 'add' }
    },
    depthWrite: false,
    depthCompare: 'always',
    cullMode: 'back'
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
      vertexCount: points.length,
      width: 40,
      resolution: [canvas.width, canvas.height]
    }, [dataBindGroup]);

    pass.end();
    device.queue.submit([encoder.finish()]);
  }

  render();
  window.addEventListener('resize', render);

  return { render, destroy: () => drawLines.destroy() };
}
