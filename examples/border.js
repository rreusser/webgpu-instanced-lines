// Border example: SDF border effect with mouse interaction

import { createGPULines } from '../webgpu-lines.js';

export async function init(canvas) {
  const adapter = await navigator.gpu?.requestAdapter();
  const device = await adapter?.requestDevice();
  if (!device) throw new Error('WebGPU not supported');

  const context = canvas.getContext('webgpu');
  const format = navigator.gpu.getPreferredCanvasFormat();
  context.configure({ device, format, alphaMode: 'premultiplied' });

  // Construct positions for a high-frequency sine wave
  const n = 11;
  const positions = new Float32Array(n * 4);
  for (let i = 0; i < n; i++) {
    const t = (i / (n - 1) * 2.0 - 1.0) * 0.8;
    positions[i * 4 + 0] = t;
    positions[i * 4 + 1] = 0.5 * Math.sin(54.0 * t);
    positions[i * 4 + 2] = 0;
    positions[i * 4 + 3] = 1;
  }

  const positionBuffer = device.createBuffer({
    size: positions.byteLength,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
  });
  device.queue.writeBuffer(positionBuffer, 0, positions);

  // Separate uniform buffers for each line (to avoid race condition)
  const uniformBufferRound = device.createBuffer({
    size: 16, // 2 vec2s
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
  });
  const uniformBufferMiter = device.createBuffer({
    size: 16,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
  });

  const width = 35;
  const borderWidth = 10;
  let scale = [1, 1];

  function createDrawLines(join) {
    return createGPULines(device, {
      format,
      join,
      cap: 'round',
      miterLimit: 3.0,
      vertexShaderBody: /* wgsl */`
        @group(1) @binding(0) var<storage, read> positions: array<vec4f>;
        @group(1) @binding(1) var<uniform> transform: Transform;

        struct Transform {
          scale: vec2f,
          translate: vec2f,
        }

        struct Vertex {
          position: vec4f,
          width: f32,
        }

        fn getVertex(index: u32) -> Vertex {
          let p = positions[index];
          let xy = p.xy * transform.scale + transform.translate;
          return Vertex(vec4f(xy, 0.0, 1.0), uniforms.width);
        }
      `,
      fragmentShaderBody: /* wgsl */`
        fn getColor(lineCoord: vec2f) -> vec4f {
          let width = uniforms.width;
          let borderWidth = ${borderWidth.toFixed(1)} * ${devicePixelRatio.toFixed(1)};

          // Convert the line coord into an SDF
          let sdf = length(lineCoord) * width;

          let borderColor = 0.5 + 0.5 * vec3f(lineCoord.xy, 0.0);

          // Apply a border with 1px transition
          let color = mix(vec3f(0.0), borderColor, smoothstep(width - borderWidth - 1.0, width - borderWidth + 1.0, sdf));
          return vec4f(color, 1.0);
        }
      `,
      depthWrite: false,
      depthCompare: 'always'
    });
  }

  const drawLinesRound = createDrawLines('round');
  const drawLinesMiter = createDrawLines('miter');

  const dataBindGroupRound = device.createBindGroup({
    layout: drawLinesRound.getBindGroupLayout(1),
    entries: [
      { binding: 0, resource: { buffer: positionBuffer } },
      { binding: 1, resource: { buffer: uniformBufferRound } }
    ]
  });

  const dataBindGroupMiter = device.createBindGroup({
    layout: drawLinesMiter.getBindGroupLayout(1),
    entries: [
      { binding: 0, resource: { buffer: positionBuffer } },
      { binding: 1, resource: { buffer: uniformBufferMiter } }
    ]
  });

  function render() {
    // Write uniforms BEFORE creating the render pass
    device.queue.writeBuffer(uniformBufferRound, 0, new Float32Array([...scale, 0, -0.4]));
    device.queue.writeBuffer(uniformBufferMiter, 0, new Float32Array([...scale, 0, 0.4]));

    const encoder = device.createCommandEncoder();
    const pass = encoder.beginRenderPass({
      colorAttachments: [{
        view: context.getCurrentTexture().createView(),
        clearValue: [0.2, 0.2, 0.2, 1],
        loadOp: 'clear',
        storeOp: 'store'
      }]
    });

    const props = {
      vertexCount: n,
      width: width * devicePixelRatio,
      resolution: [canvas.width, canvas.height]
    };

    // Draw round joins at bottom
    drawLinesRound.draw(pass, props, [dataBindGroupRound]);

    // Draw miter joins at top
    drawLinesMiter.draw(pass, props, [dataBindGroupMiter]);

    pass.end();
    device.queue.submit([encoder.finish()]);
  }

  canvas.addEventListener('mousemove', (e) => {
    scale = [
      e.offsetX / canvas.clientWidth * 2 - 1,
      -e.offsetY / canvas.clientHeight * 2 + 1
    ];
    render();
  });

  render();
  window.addEventListener('resize', render);

  return {
    render,
    destroy: () => {
      drawLinesRound.destroy();
      drawLinesMiter.destroy();
    }
  };
}
