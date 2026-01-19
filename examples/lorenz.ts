// Lorenz attractor example: Animated strange attractor with rotating camera

import { createGPULines } from '../webgpu-instanced-lines';
import { mat4 } from 'gl-matrix';

export async function init(canvas: HTMLCanvasElement) {
  const adapter = await navigator.gpu?.requestAdapter();
  if (!adapter) throw new Error('WebGPU not supported');
  const device = await adapter.requestDevice();

  const context = canvas.getContext('webgpu')!;
  const format = navigator.gpu.getPreferredCanvasFormat();
  context.configure({ device, format, alphaMode: 'premultiplied' });

  // Simulation parameters
  const particleCount = 64;
  const trailLength = 128;
  const dt = 0.005;
  const lineWidth = 6;

  // Lorenz parameters (classic values)
  const sigma = 10.0;
  const rho = 28.0;
  const beta = 8.0 / 3.0;

  // State buffer: stores position history as a ring buffer
  // Layout: [particle0_step0, particle0_step1, ..., particle1_step0, ...]
  const stateBuffer = device.createBuffer({
    label: 'state-buffer',
    size: particleCount * trailLength * 16, // vec4f per point
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
  });

  // Simulation state
  let currentStep = 0;

  // Initialize particles in a small sphere near the attractor
  const initialState = new Float32Array(particleCount * trailLength * 4);
  for (let p = 0; p < particleCount; p++) {
    // Quasirandom initialization
    const g = 1.22074408460575947536;
    const rand = [
      (0.5 + (p + 0.5) / g) % 1,
      (0.5 + (p + 0.5) / (g * g)) % 1,
      (0.5 + (p + 0.5) / (g * g * g)) % 1
    ];
    const u = rand[0] * 2 - 1;
    const theta = 2 * Math.PI * rand[1];
    const r = Math.sqrt(1 - u * u) * Math.sqrt(rand[2]);
    const x = 1 + r * Math.cos(theta) * 2;
    const y = 1 + u * 2;
    const z = 25 + r * Math.sin(theta) * 2;

    for (let s = 0; s < trailLength; s++) {
      const idx = (p * trailLength + s) * 4;
      initialState[idx + 0] = x;
      initialState[idx + 1] = y;
      initialState[idx + 2] = z;
      initialState[idx + 3] = 1;
    }
  }
  device.queue.writeBuffer(stateBuffer, 0, initialState);

  // Create compute shader for Lorenz integration
  const computeShaderCode = /* wgsl */`
    struct SimParams {
      dt: f32,
      sigma: f32,
      rho: f32,
      beta: f32,
      srcStep: u32,
      dstStep: u32,
      trailLength: u32,
      particleCount: u32,
    }
    @group(0) @binding(0) var<storage, read_write> state: array<vec4f>;
    @group(0) @binding(1) var<uniform> params: SimParams;

    fn lorenz(p: vec3f) -> vec3f {
      return vec3f(
        params.sigma * (p.y - p.x),
        p.x * (params.rho - p.z) - p.y,
        p.x * p.y - params.beta * p.z
      );
    }

    @compute @workgroup_size(64)
    fn main(@builtin(global_invocation_id) gid: vec3u) {
      let particle = gid.x;
      if (particle >= params.particleCount) { return; }

      // Read current position
      let srcIdx = particle * params.trailLength + params.srcStep;
      let p = state[srcIdx].xyz;

      // RK4 integration
      let dt = params.dt;
      let k1 = lorenz(p);
      let k2 = lorenz(p + 0.5 * dt * k1);
      let k3 = lorenz(p + 0.5 * dt * k2);
      let k4 = lorenz(p + dt * k3);
      var newP = p + (dt / 6.0) * (k1 + 2.0 * k2 + 2.0 * k3 + k4);

      // Reset if diverged
      if (dot(newP, newP) > 1e8) {
        newP = vec3f(1.0, 1.0, 25.0);
      }

      // Write to destination
      let dstIdx = particle * params.trailLength + params.dstStep;
      state[dstIdx] = vec4f(newP, 1.0);
    }
  `;

  const computeModule = device.createShaderModule({ code: computeShaderCode });
  const computePipeline = device.createComputePipeline({
    layout: 'auto',
    compute: { module: computeModule, entryPoint: 'main' }
  });

  const simUniformBuffer = device.createBuffer({
    size: 32,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
  });

  const computeBindGroup = device.createBindGroup({
    layout: computePipeline.getBindGroupLayout(0),
    entries: [
      { binding: 0, resource: { buffer: stateBuffer } },
      { binding: 1, resource: { buffer: simUniformBuffer } }
    ]
  });

  // Camera matrices (pre-allocated)
  const viewMatrix = mat4.create();
  const projMatrix = mat4.create();
  const projViewMatrix = mat4.create();
  const projViewBuffer = device.createBuffer({
    size: 64,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
  });

  // Line uniforms: stepOffset, trailLength, particleCount
  const lineUniformBuffer = device.createBuffer({
    size: 16,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
  });

  // Create line renderer
  const drawLines = createGPULines(device, {
    colorTargets: { format },
    depthStencil: {
      format: 'depth24plus',
      depthWriteEnabled: true,
      depthCompare: 'less',
    },
    join: 'miter',
    cap: 'square',
    vertexShaderBody: /* wgsl */`
      @group(1) @binding(0) var<storage, read> state: array<vec4f>;
      @group(1) @binding(1) var<uniform> projViewMatrix: mat4x4f;
      @group(1) @binding(2) var<uniform> lineParams: LineParams;

      struct LineParams {
        stepOffset: u32,
        trailLength: u32,
        particleCount: u32,
      }

      // Lorenz parameters for analytic velocity
      const sigma = 10.0;
      const rho = 28.0;
      const beta = 2.666667;

      fn lorenzVelocity(p: vec3f) -> vec3f {
        return vec3f(
          sigma * (p.y - p.x),
          p.x * (rho - p.z) - p.y,
          p.x * p.y - beta * p.z
        );
      }

      struct Vertex {
        position: vec4f,
        width: f32,
        t: f32,        // progress along trail
        velocity: f32, // velocity magnitude (normalized)
      }

      fn getVertex(index: u32) -> Vertex {
        // Decode particle and step from index
        let pointsPerParticle = lineParams.trailLength + 1u; // +1 for line break
        let particle = index / pointsPerParticle;
        let step = index % pointsPerParticle;

        // Line break sentinel
        if (step >= lineParams.trailLength) {
          return Vertex(vec4f(0.0, 0.0, 0.0, 0.0), 0.0, 0.0, 0.0);
        }

        // Ring buffer lookup
        let bufferStep = (step + lineParams.stepOffset) % lineParams.trailLength;
        let bufferIdx = particle * lineParams.trailLength + bufferStep;
        let pos = state[bufferIdx].xyz;

        // Compute velocity analytically from Lorenz equations
        let vel = lorenzVelocity(pos);
        let speed = length(vel);
        let normalizedVelocity = clamp(speed / 300.0, 0.0, 1.0);

        // Scale and center the attractor, swap Y/Z so lobes are upright
        let scale = 0.04;
        let swapped = vec3f(pos.x, pos.z, pos.y);  // Z becomes vertical
        let center = vec3f(0.0, 25.0, 0.0);
        let scaledPos = (swapped - center) * scale;

        let projected = projViewMatrix * vec4f(scaledPos, 1.0);
        let t = f32(step) / f32(lineParams.trailLength - 1u);
        return Vertex(projected, ${(lineWidth * devicePixelRatio).toFixed(1)} * (0.3 + 0.7 * t), t, normalizedVelocity);
      }
    `,
    fragmentShaderBody: /* wgsl */`
      fn rainbow(p: vec2f) -> vec3f {
        let theta = p.x * ${(2.0 * Math.PI).toFixed(6)};
        let c = cos(theta);
        let s = sin(theta);
        let m1 = mat3x3f(
          0.5230851,  0.56637411, 0.46725319,
          0.12769652, 0.14082407, 0.13691271,
         -0.25934743,-0.12121582, 0.2348705
        );
        let m2 = mat3x3f(
          0.3555664, -0.11472876,-0.01250831,
          0.15243126,-0.03668075, 0.0765231,
         -0.00192128,-0.01350681,-0.0036526
        );
        return m1 * vec3f(1.0, p.y * 2.0 - 1.0, s) +
               m2 * vec3f(c, s * c, c * c - s * s);
      }

      fn getColor(lineCoord: vec2f, t: f32, velocity: f32) -> vec4f {
        // Discard outside circular region (round cap from square geometry)
        if (length(lineCoord) > 1.0) {
          discard;
        }

        let width = ${(lineWidth * devicePixelRatio).toFixed(1)};
        let borderWidth = 1.0 * ${devicePixelRatio.toFixed(1)};

        // Color from velocity using rainbow palette
        // p.x = hue (velocity), p.y = saturation/brightness control
        let fillColor = rainbow(vec2f(velocity, t));

        // SDF border
        let sdf = length(lineCoord) * width * 0.5;
        let borderStart = width * 0.5 - borderWidth;
        let borderMask = smoothstep(borderStart - 0.5, borderStart + 0.5, sdf);
        let color = mix(fillColor, vec3f(0), borderMask);

        return vec4f(color, 1.0);
      }
    `,
  });

  const lineBindGroup = device.createBindGroup({
    layout: drawLines.getBindGroupLayout(1),
    entries: [
      { binding: 0, resource: { buffer: stateBuffer } },
      { binding: 1, resource: { buffer: projViewBuffer } },
      { binding: 2, resource: { buffer: lineUniformBuffer } }
    ]
  });

  // Depth texture
  let depthTexture = device.createTexture({
    size: [canvas.width, canvas.height],
    format: 'depth24plus',
    usage: GPUTextureUsage.RENDER_ATTACHMENT
  });

  // Animation loop
  let animationId: number;
  const startTime = performance.now();

  function render(time: number) {
    // Recreate depth texture if needed
    if (depthTexture.width !== canvas.width || depthTexture.height !== canvas.height) {
      depthTexture.destroy();
      depthTexture = device.createTexture({
        size: [canvas.width, canvas.height],
        format: 'depth24plus',
        usage: GPUTextureUsage.RENDER_ATTACHMENT
      });
    }

    const elapsed = (time - startTime) * 0.001;
    const encoder = device.createCommandEncoder();

    // Simulation step
    const srcStep = currentStep;
    const dstStep = (currentStep + 1) % trailLength;

    const simUniforms = new Float32Array([dt, sigma, rho, beta]);
    const simUniformsU32 = new Uint32Array([srcStep, dstStep, trailLength, particleCount]);
    device.queue.writeBuffer(simUniformBuffer, 0, simUniforms);
    device.queue.writeBuffer(simUniformBuffer, 16, simUniformsU32);

    const computePass = encoder.beginComputePass();
    computePass.setPipeline(computePipeline);
    computePass.setBindGroup(0, computeBindGroup);
    computePass.dispatchWorkgroups(Math.ceil(particleCount / 64));
    computePass.end();

    currentStep = dstStep;

    // Update camera - slow rotation around Y axis
    const cameraAngle = elapsed * 0.15;
    const cameraDistance = 3.5;
    const cameraHeight = 0.5;
    const eye: [number, number, number] = [
      cameraDistance * Math.cos(cameraAngle),
      cameraHeight,
      cameraDistance * Math.sin(cameraAngle)
    ];
    const center: [number, number, number] = [0, 0, 0];
    const up: [number, number, number] = [0, 1, 0];

    mat4.lookAt(viewMatrix, eye, center, up);
    const aspect = canvas.width / canvas.height;
    mat4.perspective(projMatrix, Math.PI / 4, aspect, 0.1, 100);
    mat4.multiply(projViewMatrix, projMatrix, viewMatrix);
    device.queue.writeBuffer(projViewBuffer, 0, new Float32Array(projViewMatrix));

    // Update line uniforms
    const lineUniforms = new Uint32Array([
      (currentStep + 1) % trailLength, // stepOffset (oldest data)
      trailLength,
      particleCount
    ]);
    device.queue.writeBuffer(lineUniformBuffer, 0, lineUniforms);

    // Render
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

    const totalVertexCount = particleCount * (trailLength + 1);
    drawLines.draw(pass, {
      vertexCount: totalVertexCount,
      resolution: [canvas.width, canvas.height]
    }, [lineBindGroup]);

    pass.end();
    device.queue.submit([encoder.finish()]);

    animationId = requestAnimationFrame(render);
  }

  animationId = requestAnimationFrame(render);

  return {
    render,
    destroy: () => {
      cancelAnimationFrame(animationId);
      drawLines.destroy();
      stateBuffer.destroy();
      simUniformBuffer.destroy();
      projViewBuffer.destroy();
      lineUniformBuffer.destroy();
      depthTexture.destroy();
    }
  };
}
