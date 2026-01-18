// Depth example: Animated 3D spirals with depth testing and SDF borders

import { createGPULines } from '../webgpu-lines.js';

export async function init(canvas) {
  const adapter = await navigator.gpu?.requestAdapter();
  const device = await adapter?.requestDevice();
  if (!device) throw new Error('WebGPU not supported');

  const context = canvas.getContext('webgpu');
  const format = navigator.gpu.getPreferredCanvasFormat();
  context.configure({ device, format, alphaMode: 'premultiplied' });

  const n = 101;
  const width = 30;
  const borderWidth = 5;

  // Create positions buffer (just x values from 0 to 1)
  const positions = new Float32Array(n * 4);
  for (let i = 0; i < n; i++) {
    const x = i / (n - 1);
    positions[i * 4 + 0] = x;
    positions[i * 4 + 1] = 0;
    positions[i * 4 + 2] = 0;
    positions[i * 4 + 3] = 1;
  }

  const positionBuffer = device.createBuffer({
    size: positions.byteLength,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
  });
  device.queue.writeBuffer(positionBuffer, 0, positions);

  // Uniform buffer for time and phase
  const uniformBuffer = device.createBuffer({
    size: 32, // time, phase, color (vec3), padding
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
  });

  const drawLines = createGPULines(device, {
    format,
    depthFormat: 'depth24plus',
    join: 'round',
    cap: 'round',
    joinResolution: 1,
    vertexShaderBody: /* wgsl */`
      @group(1) @binding(0) var<storage, read> positions: array<vec4f>;
      @group(1) @binding(1) var<uniform> params: Params;

      struct Params {
        time: f32,
        phase: f32,
        color: vec3f,
      }

      struct Vertex {
        position: vec4f,
        width: f32,
      }

      fn getVertex(index: u32) -> Vertex {
        let p = positions[index];
        let x = p.x;
        let theta = 3.141 * (6.0 * x + params.time) - params.phase;
        let pos = vec4f(
          0.5 * cos(theta),
          0.5 * (x * 2.0 - 1.0) * 1.5,
          0.5 * sin(theta),
          1.0
        );
        return Vertex(pos, uniforms.width);
      }
    `,
    fragmentShaderBody: /* wgsl */`
      @group(1) @binding(1) var<uniform> params: Params;

      struct Params {
        time: f32,
        phase: f32,
        color: vec3f,
      }

      fn getColor(lineCoord: vec2f) -> vec4f {
        let width = uniforms.width;
        let borderWidth = ${(borderWidth * devicePixelRatio).toFixed(1)};

        // Convert the line coord into an SDF
        let sdf = length(lineCoord) * width;

        // Apply a border with smooth transition
        let color = mix(params.color, vec3f(1.0), smoothstep(width - borderWidth - 0.5, width - borderWidth + 0.5, sdf));
        return vec4f(color, 1.0);
      }
    `,
    depthWrite: true,
    depthCompare: 'less'
  });

  const dataBindGroup = device.createBindGroup({
    layout: drawLines.getBindGroupLayout(1),
    entries: [
      { binding: 0, resource: { buffer: positionBuffer } },
      { binding: 1, resource: { buffer: uniformBuffer } }
    ]
  });

  // Create depth texture
  let depthTexture = device.createTexture({
    size: [canvas.width, canvas.height],
    format: 'depth24plus',
    usage: GPUTextureUsage.RENDER_ATTACHMENT
  });

  const colors = [
    [0.5, 1.0, 0.0],
    [0.0, 0.5, 1.0],
    [1.0, 0.0, 0.5]
  ];
  const phases = [0, Math.PI / 2, Math.PI];

  function render(time = 0) {
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

    const props = {
      vertexCount: n,
      width: width * devicePixelRatio,
      resolution: [canvas.width, canvas.height]
    };

    // Draw three spirals with different phases and colors
    for (let i = 0; i < 3; i++) {
      const uniforms = new Float32Array([
        time * 0.001, // time
        phases[i],    // phase
        0, 0,         // padding
        ...colors[i], // color
        0             // padding
      ]);
      device.queue.writeBuffer(uniformBuffer, 0, uniforms);
      drawLines.draw(pass, props, [dataBindGroup]);
    }

    pass.end();
    device.queue.submit([encoder.finish()]);
  }

  // Animation loop
  let animationId;
  function animate(time) {
    render(time);
    animationId = requestAnimationFrame(animate);
  }
  animate(0);

  return {
    render,
    destroy: () => {
      cancelAnimationFrame(animationId);
      drawLines.destroy();
    }
  };
}
