// Closed loop example: Seven-sided star shape

import { createGPULines } from '../webgpu-lines.js';

export async function init(canvas) {
  const adapter = await navigator.gpu?.requestAdapter();
  const device = await adapter?.requestDevice();
  if (!device) throw new Error('WebGPU not supported');

  const context = canvas.getContext('webgpu');
  const format = navigator.gpu.getPreferredCanvasFormat();
  context.configure({ device, format, alphaMode: 'premultiplied' });

  // A seven-sided star, with first three vertices repeated at end for closed loop
  const n = 7;
  const pointCount = n + 3;
  const positions = new Float32Array(pointCount * 4);

  for (let i = 0; i < pointCount; i++) {
    const t = i / n;
    const theta = t * Math.PI * 2 * 2;
    const r = 0.7;
    positions[i * 4 + 0] = r * Math.cos(theta);
    positions[i * 4 + 1] = r * Math.sin(theta);
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
    // No cap needed for closed loop
    vertexShaderBody: /* wgsl */`
      @group(1) @binding(0) var<storage, read> positions: array<vec4f>;

      struct Vertex {
        position: vec4f,
        width: f32,
      }

      fn getVertex(index: u32) -> Vertex {
        let p = positions[index];
        // Apply aspect ratio correction
        let aspect = uniforms.resolution.x / uniforms.resolution.y;
        return Vertex(vec4f(p.x, p.y * aspect, p.z, p.w), 50.0);
      }
    `,
    fragmentShaderBody: /* wgsl */`
      fn getColor(lineCoord: vec2f) -> vec4f {
        return vec4f(1.0, 1.0, 1.0, 0.5);
      }
    `,
    blend: {
      color: { srcFactor: 'src-alpha', dstFactor: 'one-minus-src-alpha', operation: 'add' },
      alpha: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha', operation: 'add' }
    },
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
      vertexCount: pointCount,
      width: 50,
      resolution: [canvas.width, canvas.height]
    }, [dataBindGroup]);

    pass.end();
    device.queue.submit([encoder.finish()]);
  }

  render();
  window.addEventListener('resize', render);

  return { render, destroy: () => drawLines.destroy() };
}
