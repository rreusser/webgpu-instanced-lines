// Varying example: Pass custom interpolated values to the fragment shader
// Demonstrates coloring a spiral by progress along the path

import { createGPULines } from '../webgpu-instanced-lines';

export async function init(canvas: HTMLCanvasElement) {
  const adapter = await navigator.gpu?.requestAdapter();
  if (!adapter) throw new Error('WebGPU not supported');
  const device = await adapter.requestDevice();

  const context = canvas.getContext('webgpu')!;
  const format = navigator.gpu.getPreferredCanvasFormat();
  context.configure({ device, format, alphaMode: 'premultiplied' });

  // Create a spiral path
  const n = 120;
  const positions = new Float32Array(n * 4);
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    const angle = t * Math.PI * 4;
    const r = 0.15 + t * 0.55;
    positions[i * 4 + 0] = r * Math.cos(angle);
    positions[i * 4 + 1] = r * Math.sin(angle);
    positions[i * 4 + 2] = 0;
    positions[i * 4 + 3] = 1;
  }

  const positionBuffer = device.createBuffer({
    size: positions.byteLength,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
  });
  device.queue.writeBuffer(positionBuffer, 0, positions);

  const drawLines = createGPULines(device, {
    colorTargets: { format },
    join: 'round',
    cap: 'round',
    vertexShaderBody: /* wgsl */`
      @group(1) @binding(0) var<storage, read> positions: array<vec4f>;

      struct Vertex {
        position: vec4f,
        width: f32,
        t: f32, // progress along path (0 to 1)
      }

      fn getVertex(index: u32) -> Vertex {
        let p = positions[index];
        let t = f32(index) / ${(n - 1).toFixed(1)};
        return Vertex(p, 20.0 * ${devicePixelRatio.toFixed(1)}, t);
      }
    `,
    fragmentShaderBody: /* wgsl */`
      fn getColor(lineCoord: vec2f, t: f32) -> vec4f {
        // Gradient from magenta (start) to cyan (end)
        let startColor = vec3f(0.9, 0.2, 0.6);
        let endColor = vec3f(0.2, 0.8, 0.9);
        let color = mix(startColor, endColor, t);
        return vec4f(color, 1.0);
      }
    `,
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
        clearValue: [0.12, 0.12, 0.15, 1],
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
