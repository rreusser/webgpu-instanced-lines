// Closed loop example: Seven-sided star shape
//
// For closed loops, use modular arithmetic in getVertex to wrap indices.
import { createGPULines } from '../webgpu-instanced-lines';

export async function init(canvas: HTMLCanvasElement) {
  const adapter = await navigator.gpu?.requestAdapter();
  if (!adapter) throw new Error('WebGPU not supported');
  const device = await adapter.requestDevice();

  const context = canvas.getContext('webgpu')!;
  const format = navigator.gpu.getPreferredCanvasFormat();
  context.configure({ device, format, alphaMode: 'premultiplied' });

  // A seven-sided star - only store n unique points
  const n = 7;
  const positions = new Float32Array(n * 4);

  for (let i = 0; i < n; i++) {
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
    colorTargets: {
      format,
      blend: {
        color: { srcFactor: 'src-alpha', dstFactor: 'one-minus-src-alpha', operation: 'add' },
        alpha: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha', operation: 'add' }
      }
    },
    join: 'round',
    cap: 'butt', // No caps needed for closed loop
    clampIndices: false, // Pass raw indices for custom wrapping
    vertexShaderBody: /* wgsl */`
      @group(1) @binding(0) var<storage, read> positions: array<vec4f>;

      const n = ${n};

      struct Vertex {
        position: vec4f,
        width: f32,
      }

      fn getVertex(index: i32) -> Vertex {
        // Use modular arithmetic to wrap indices for closed loop
        let p = positions[(index % n + n) % n];
        // Apply aspect ratio correction
        let aspect = uniforms.resolution.x / uniforms.resolution.y;
        return Vertex(vec4f(p.x, p.y * aspect, p.z, p.w), 50.0 * ${devicePixelRatio.toFixed(1)});
      }
    `,
    fragmentShaderBody: /* wgsl */`
      fn getColor(lineCoord: vec2f) -> vec4f {
        return vec4f(1.0, 1.0, 1.0, 0.5);
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
        clearValue: [0.2, 0.2, 0.2, 1],
        loadOp: 'clear',
        storeOp: 'store'
      }]
    });

    // Pass n + 3 to provide extra indices for join computation at the loop closure
    drawLines.draw(pass, {
      vertexCount: n + 1,
      resolution: [canvas.width, canvas.height]
    }, [dataBindGroup]);

    pass.end();
    device.queue.submit([encoder.finish()]);
  }

  render();
  window.addEventListener('resize', render);

  return { render, destroy: () => drawLines.destroy() };
}
