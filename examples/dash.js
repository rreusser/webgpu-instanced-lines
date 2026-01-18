// Dash example: Dashing with cumulative distance tracking and mouse interaction

import { createGPULines } from '../webgpu-lines.js';

export async function init(canvas) {
  const adapter = await navigator.gpu?.requestAdapter();
  const device = await adapter?.requestDevice();
  if (!device) throw new Error('WebGPU not supported');

  const context = canvas.getContext('webgpu');
  const format = navigator.gpu.getPreferredCanvasFormat();
  context.configure({ device, format, alphaMode: 'premultiplied' });

  const width = 40;
  const dashLength = 4;

  // Construct initial path as a sine wave
  const n = 11;
  const path = [];
  for (let i = 0; i < n; i++) {
    const t = (i / (n - 1) * 2.0 - 1.0) * 0.8;
    path.push([t, 0.5 * Math.sin(8.0 * t)]);
  }

  // Compute cumulative distance for dashing
  const dist = new Array(n).fill(0);
  function computeCumulativeDistance() {
    const w = canvas.width;
    const h = canvas.height;
    for (let i = 1; i < path.length; i++) {
      const dx = (path[i][0] - path[i-1][0]) * w * 0.5;
      const dy = (path[i][1] - path[i-1][1]) * h * 0.5;
      dist[i] = dist[i-1] + Math.hypot(dx, dy);
    }
  }
  computeCumulativeDistance();

  // Create buffer with position (vec4) and distance (f32) interleaved
  // Actually, let's use two separate buffers for simplicity
  const positionBuffer = device.createBuffer({
    size: n * 16, // vec4f per point
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
  });

  const distBuffer = device.createBuffer({
    size: n * 4, // f32 per point
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
  });

  function updateBuffers() {
    const positions = new Float32Array(n * 4);
    for (let i = 0; i < path.length; i++) {
      positions[i * 4 + 0] = path[i][0];
      positions[i * 4 + 1] = path[i][1];
      positions[i * 4 + 2] = 0;
      positions[i * 4 + 3] = 1;
    }
    device.queue.writeBuffer(positionBuffer, 0, positions);
    device.queue.writeBuffer(distBuffer, 0, new Float32Array(dist));
  }

  updateBuffers();

  const drawLines = createGPULines(device, {
    format,
    depthFormat: 'depth24plus',
    join: 'round',
    cap: 'round',
    vertexShaderBody: /* wgsl */`
      @group(1) @binding(0) var<storage, read> positions: array<vec4f>;
      @group(1) @binding(1) var<storage, read> distances: array<f32>;

      struct Vertex {
        position: vec4f,
        width: f32,
        dist: f32,
      }

      fn getVertex(index: u32) -> Vertex {
        return Vertex(positions[index], uniforms.width, distances[index]);
      }
    `,
    fragmentShaderBody: /* wgsl */`
      fn linearstep(a: f32, b: f32, x: f32) -> f32 {
        return clamp((x - a) / (b - a), 0.0, 1.0);
      }

      fn getColor(lineCoord: vec2f, dist: f32) -> vec4f {
        let dashLength = ${(dashLength * width * 2 * devicePixelRatio).toFixed(1)};
        let dashvar = fract(dist / dashLength) * dashLength;
        let v = linearstep(0.0, 1.0, dashvar) * linearstep(dashLength * 0.5 + 1.0, dashLength * 0.5, dashvar);
        return vec4f(vec3f(v), 1.0);
      }
    `,
    depthWrite: true,
    depthCompare: 'less'
  });

  const dataBindGroup = device.createBindGroup({
    layout: drawLines.getBindGroupLayout(1),
    entries: [
      { binding: 0, resource: { buffer: positionBuffer } },
      { binding: 1, resource: { buffer: distBuffer } }
    ]
  });

  // Create depth texture
  let depthTexture = device.createTexture({
    size: [canvas.width, canvas.height],
    format: 'depth24plus',
    usage: GPUTextureUsage.RENDER_ATTACHMENT
  });

  function render() {
    // Recreate depth texture if canvas size changed
    if (depthTexture.width !== canvas.width || depthTexture.height !== canvas.height) {
      depthTexture.destroy();
      depthTexture = device.createTexture({
        size: [canvas.width, canvas.height],
        format: 'depth24plus',
        usage: GPUTextureUsage.RENDER_ATTACHMENT
      });
    }

    const encoder = device.createCommandEncoder();
    const pass = encoder.beginRenderPass({
      colorAttachments: [{
        view: context.getCurrentTexture().createView(),
        clearValue: [0.2, 0.2, 0.2, 1],
        loadOp: 'clear',
        storeOp: 'store'
      }],
      depthStencilAttachment: {
        view: depthTexture.createView(),
        depthClearValue: 1.0,
        depthLoadOp: 'clear',
        depthStoreOp: 'store'
      }
    });

    drawLines.draw(pass, {
      vertexCount: path.length,
      width: width * devicePixelRatio,
      resolution: [canvas.width, canvas.height]
    }, [dataBindGroup]);

    pass.end();
    device.queue.submit([encoder.finish()]);
  }

  // Mouse interaction: prepend points to path
  canvas.addEventListener('mousemove', (e) => {
    const newPoint = [
      e.offsetX / canvas.clientWidth * 2 - 1,
      -e.offsetY / canvas.clientHeight * 2 + 1
    ];

    const lastPoint = path[0];
    const newDist = Math.hypot(
      canvas.clientWidth * (lastPoint[0] - newPoint[0]),
      canvas.clientHeight * (lastPoint[1] - newPoint[1])
    );

    if (newDist < Math.max(2, width * 0.5)) return;

    path.unshift(newPoint);
    dist.unshift(dist[0] - newDist);

    path.pop();
    dist.pop();

    updateBuffers();
    render();
  });

  render();
  window.addEventListener('resize', () => {
    computeCumulativeDistance();
    updateBuffers();
    render();
  });

  return { render, destroy: () => drawLines.destroy() };
}
