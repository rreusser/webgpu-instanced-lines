# WebGPU Instanced Lines API Reference

## `createGPULines(device, options)`

Creates a new line renderer instance.

**Parameters:**
- `device` - WebGPU device
- `options` - Configuration object (see below)

**Returns:** Line renderer object with `draw()`, `getBindGroupLayout()`, and `destroy()` methods.

## Options

### `join`

Controls how line segments are connected at vertices. Options are `'bevel'`, `'miter'`, and `'round'`.

| `join: 'bevel'` | `join: 'miter'` | `join: 'round'` |
|:---:|:---:|:---:|
| <img src="images/join-bevel.png" width="200"> | <img src="images/join-miter.png" width="200"> | <img src="images/join-round.png" width="200"> |

### `cap`

Controls how line endpoints are rendered. Options are `'round'`, `'square'`, and `'none'`.

| `cap: 'round'` | `cap: 'square'` | `cap: 'none'` |
|:---:|:---:|:---:|
| <img src="images/cap-round.png" width="200"> | <img src="images/cap-square.png" width="200"> | <img src="images/cap-none.png" width="200"> |

### `miterLimit`

When using `join: 'miter'`, this controls when sharp angles fall back to bevel joins. Lower values create more bevels. Higher values allow longer miter points. Default is `4`. Can be overridden at draw-time.

| `miterLimit: 1` | `miterLimit: 4` | `miterLimit: 10` |
|:---:|:---:|:---:|
| <img src="images/miter-1.png" width="200"> | <img src="images/miter-4.png" width="200"> | <img src="images/miter-10.png" width="200"> |

### `joinResolution` and `capResolution`

Control the number of triangles used for round joins and caps. Higher values create smoother curves. Default is `8`. Can be overridden at draw-time (up to the max resolution).

### `maxJoinResolution` and `maxCapResolution`

Maximum resolution values that can be used at draw-time. These determine vertex buffer allocation at init-time. Default is `16`. Set higher if you need finer resolution at draw-time; set lower to reduce vertex count per instance.

| `joinResolution: 2` | `joinResolution: 4` | `joinResolution: 16` |
|:---:|:---:|:---:|
| <img src="images/res-2.png" width="200"> | <img src="images/res-4.png" width="200"> | <img src="images/res-16.png" width="200"> |

### Line Breaks

Insert a point with `w = 0` (or `NaN` for any coordinate) to create a line break. This splits the line into separate segments, each with its own end caps.

| Continuous line | With line break (`w: 0`) |
|:---:|:---:|
| <img src="images/continuous.png" width="200"> | <img src="images/with-break.png" width="200"> |

## Custom Shaders

The library supports custom WGSL shaders for advanced rendering effects. Provide shader code via the `fragmentShaderBody` and `vertexShaderBody` options.

### `fragmentShaderBody`

The fragment shader controls how lines are colored. Your code must define a `getColor` function.

```wgsl
fn getColor(lineCoord: vec2f) -> vec4f {
  // Return RGBA color (0-1 range)
  return vec4f(0.2, 0.5, 0.9, 1.0);
}
```

The `lineCoord` parameter provides spatial information about the current fragment (see below).

Any fields in your `Vertex` struct beyond `position` and `width` become varyings, interpolated across the line and passed as additional parameters to `getColor`. For example, if your struct includes `dist: f32`, your function signature becomes `fn getColor(lineCoord: vec2f, dist: f32) -> vec4f`.

If your shader code references `instanceID`, the library will automatically pass two additional parameters, `instanceID: f32` (segment index, negative for end caps) and `triStripCoord: vec2f` (triangle strip vertex coordinates for wireframe visualization).

### `lineCoord` Values

| Component | Segments/Joins | Caps | Description |
|-----------|----------------|------|-------------|
| `lineCoord.x` | 0 | sin(θ) × sign | Always 0 for segments. Varies around the semicircle for caps. |
| `lineCoord.y` | -1 to 1 | cos(θ) × sign | Position across the line. 0 at center, ±1 at edges. |

The `lineCoord` values are designed for SDF (signed distance field) rendering. `length(lineCoord)` gives radial distance from line center (0 at center, 1 at edge).

| `lineCoord.x` (0 on segments, varies in caps) | `lineCoord.y` (across line) |
|:---:|:---:|
| <img src="images/lc-x.png" width="200"> | <img src="images/lc-y.png" width="200"> |

### Example Shaders

Cross-line gradient:
```wgsl
fn getColor(lineCoord: vec2f) -> vec4f {
  let t = lineCoord.y * 0.5 + 0.5;
  let top = vec3f(1.0, 0.4, 0.2);
  let bottom = vec3f(0.2, 0.4, 1.0);
  return vec4f(mix(bottom, top, t), 1.0);
}
```

SDF stroke with anti-aliasing:
```wgsl
fn linearstep(a: f32, b: f32, x: f32) -> f32 {
  return clamp((x - a) / (b - a), 0.0, 1.0);
}
fn getColor(lineCoord: vec2f) -> vec4f {
  let width = 20.0;
  let strokeWidth = 4.0;
  let sdf = 0.5 * width * length(lineCoord);
  let aa = linearstep(width * 0.5, width * 0.5 - 1.0, sdf);
  let strokeMask = linearstep(
    width * 0.5 - strokeWidth - 0.5,
    width * 0.5 - strokeWidth + 0.5, sdf);
  let fillColor = vec3f(0.4, 0.7, 1.0);
  let strokeColor = vec3f(0.1, 0.3, 0.6);
  let color = mix(fillColor, strokeColor, strokeMask);
  return vec4f(color, aa);
}
```

| Cross-line stripes | Cross-line gradient | SDF stroke |
|:---:|:---:|:---:|
| <img src="images/stripes.png" width="200"> | <img src="images/gradient.png" width="200"> | <img src="images/sdf-stroke.png" width="200"> |

When using transparency or `discard`, enable alpha blending:
```javascript
createGPULines(device, {
  blend: {
    color: { srcFactor: 'src-alpha', dstFactor: 'one-minus-src-alpha', operation: 'add' },
    alpha: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha', operation: 'add' }
  }
});
```

### `vertexShaderBody`

The vertex shader body defines how line positions and per-vertex data are computed. You provide bind group declarations (group 1+) for your data, a struct defining the vertex output, and a vertex function that returns the struct given a point index.

```wgsl
@group(1) @binding(0) var<storage, read> positions: array<vec4f>;
@group(1) @binding(1) var<uniform> viewMatrix: mat4x4f;

struct Vertex {
  position: vec4f,  // Required, clip-space position (w component controls line breaks)
  width: f32,       // Required, line width in pixels
  // Additional fields become varyings passed to fragment shader
}

fn getVertex(index: u32) -> Vertex {
  let p = positions[index];
  let projected = viewMatrix * vec4f(p.xyz, 1.0);
  return Vertex(vec4f(projected.xyz, p.w * projected.w), 20.0);
}
```

Options for customization include `vertexFunction` (name of your vertex function, default `'getVertex'`), `positionField` (name of position field in struct, default `'position'`), and `widthField` (name of width field in struct, default `'width'`).

Available library uniforms are `uniforms.resolution` (canvas resolution in pixels) and `uniforms.pointCount` (number of points).

## Drawing

### `gpuLines.draw(pass, props, bindGroups)`

Draws lines in a render pass. The `bindGroups` parameter is an array of user bind groups for groups 1, 2, etc.

**Props:**
- `vertexCount` - Number of points in the line
- `resolution` - Canvas resolution as `[width, height]`
- `miterLimit` (optional) - Override miter limit at draw-time (only for `join: 'miter'` or `join: 'round'`)
- `joinResolution` (optional) - Override join resolution at draw-time (only for `join: 'round'`, clamped to `maxJoinResolution`)
- `capResolution` (optional) - Override cap resolution at draw-time (only for `cap: 'round'`, clamped to `maxCapResolution`)

### `gpuLines.getBindGroupLayout(index)`

Returns the bind group layout for the specified group index. Use this to create bind groups for your data.

```javascript
const dataBindGroup = device.createBindGroup({
  layout: gpuLines.getBindGroupLayout(1),
  entries: [
    { binding: 0, resource: { buffer: positionBuffer } },
    { binding: 1, resource: { buffer: viewMatrixBuffer } }
  ]
});

const pass = encoder.beginRenderPass({ ... });
gpuLines.draw(pass, {
  vertexCount: points.length,
  resolution: [canvas.width, canvas.height]
}, [dataBindGroup]);
pass.end();
```

## Position Data Format

Your vertex function returns a `vec4f` position. The `x` and `y` components are position in clip space (-1 to 1), `z` is depth, and `w` should be `1` for valid points or `0` (or NaN for any component) for line breaks.

```javascript
const positions = new Float32Array([
  x0, y0, z0, w0,  // Point 0
  x1, y1, z1, w1,  // Point 1
  // ...
]);

const buffer = device.createBuffer({
  size: positions.byteLength,
  usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
});
device.queue.writeBuffer(buffer, 0, positions);
```

Your `getVertex` function can read from any source (buffers, textures, procedural) and transform to clip space however you like.
