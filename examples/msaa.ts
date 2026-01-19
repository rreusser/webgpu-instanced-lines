// MSAA example: 4x multi-sample anti-aliasing

import { createGPULines } from '../webgpu-instanced-lines';

export async function init(canvas: HTMLCanvasElement) {
  const adapter = await navigator.gpu?.requestAdapter();
  if (!adapter) throw new Error('WebGPU not supported');
  const device = await adapter.requestDevice();

  const context = canvas.getContext('webgpu')!;
  const format = navigator.gpu.getPreferredCanvasFormat();
  context.configure({ device, format, alphaMode: 'premultiplied' });

  const sampleCount = 4;

  // Create a star pattern to show off anti-aliasing
  const points = 7;
  const n = points * 2 + 1;
  const positions = new Float32Array(n * 4);
  for (let i = 0; i <= points * 2; i++) {
    const angle = (i / points) * Math.PI + Math.PI / 2;
    const r = i % 2 === 0 ? 0.7 : 0.3;
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
    multisample: { count: sampleCount },
    join: 'miter',
    cap: 'butt',
    vertexShaderBody: /* wgsl */`
      @group(1) @binding(0) var<storage, read> positions: array<vec4f>;

      struct Vertex {
        position: vec4f,
        width: f32,
      }

      fn getVertex(index: u32) -> Vertex {
        return Vertex(positions[index], 8.0 * ${devicePixelRatio.toFixed(1)});
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

  // Create multisample texture (recreated on resize)
  let msaaTexture: GPUTexture;

  function createMsaaTexture() {
    if (msaaTexture) msaaTexture.destroy();
    msaaTexture = device.createTexture({
      size: [canvas.width, canvas.height],
      format,
      sampleCount,
      usage: GPUTextureUsage.RENDER_ATTACHMENT
    });
  }

  createMsaaTexture();

  function render() {
    // Recreate MSAA texture if canvas size changed
    if (msaaTexture.width !== canvas.width || msaaTexture.height !== canvas.height) {
      createMsaaTexture();
    }

    const encoder = device.createCommandEncoder();
    const pass = encoder.beginRenderPass({
      colorAttachments: [{
        view: msaaTexture.createView(),
        resolveTarget: context.getCurrentTexture().createView(),
        clearValue: [0.15, 0.15, 0.15, 1],
        loadOp: 'clear',
        storeOp: 'discard'  // MSAA texture is discarded after resolve
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

  return {
    render,
    destroy: () => {
      drawLines.destroy();
      msaaTexture.destroy();
      positionBuffer.destroy();
    }
  };
}
