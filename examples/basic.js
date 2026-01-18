// Basic example: Simple sine wave with round joins and caps

import { createGPULines } from '../webgpu-lines.js';

export async function init(canvas) {
  const adapter = await navigator.gpu?.requestAdapter();
  const device = await adapter?.requestDevice();
  if (!device) throw new Error('WebGPU not supported');

  const context = canvas.getContext('webgpu');
  const format = navigator.gpu.getPreferredCanvasFormat();
  context.configure({ device, format, alphaMode: 'premultiplied' });

  // Construct an array of xy pairs for a sine wave
  const n = 11;
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
      }

      fn getVertex(index: u32) -> Vertex {
        return Vertex(positions[index], uniforms.width);
      }
    `,
    fragmentShaderBody: /* wgsl */`
      fn getColor(lineCoord: vec2f) -> vec4f {
        return vec4f(1.0, 1.0, 1.0, 1.0);
      }
    `
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
      width: 30 * devicePixelRatio,
      resolution: [canvas.width, canvas.height]
    }, [dataBindGroup]);

    pass.end();
    device.queue.submit([encoder.finish()]);
  }

  render();
  window.addEventListener('resize', render);

  return { render, destroy: () => drawLines.destroy() };
}
