# API Reference

## `createGPULines(device, options)`

Creates a new line renderer instance.

**Parameters:**
- `device` - WebGPU device
- `options` - Configuration object (see below)

**Returns:** Line renderer object with `draw()`, `getBindGroupLayout()`, and `destroy()` methods.

## Options

### `join`

Controls how line segments are connected at vertices. Options are `'bevel'`, `'miter'`, and `'round'`.

### `cap`

Controls how line endpoints are rendered. Options are `'round'`, `'square'`, and `'butt'`.

### `miterLimit`

When using `join: 'miter'`, this controls when sharp angles fall back to bevel joins. Lower values create more bevels. Higher values allow longer miter points. Default is `4`.

### `joinResolution` and `capResolution`

Control the number of triangles used for round joins and caps. Higher values create smoother curves. Default is `8`.

### Line Breaks

Insert a point with `w = 0` (or `NaN` for any coordinate) to create a line break. This splits the line into separate segments, each with its own end caps.

## Custom Shaders

The library supports custom WGSL shaders for advanced rendering effects. Provide shader code via the `fragmentShaderBody` and `vertexShaderBody` options.

The library parses your `Vertex` struct to identify the position, width, and varying fields automatically. The library reserves `@group(0)` for its internal uniforms; your shader code should use `@group(1)` and higher for your own data.

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

If your shader code references `instanceID`, the library will automatically pass two additional parameters, `instanceID: f32` (segment index, negative for end caps) and `triStripCoord: vec2f` (triangle strip vertex coordinates for wireframe visualization). These are useful for debug views showing the internal triangle strip structure.

### `lineCoord` Values

| Component | Segments/Joins | Caps | Description |
|-----------|----------------|------|-------------|
| `lineCoord.x` | 0 | sin(θ) × sign | Always 0 for segments. Varies around the semicircle for caps. |
| `lineCoord.y` | -1 to 1 | cos(θ) × sign | Position across the line. 0 at center, ±1 at edges. |

The `lineCoord` values are designed for SDF (signed distance field) rendering. `length(lineCoord)` gives radial distance from line center (0 at center, 1 at edge). For segments, `length(lineCoord) = abs(lineCoord.y)` since x=0. For caps, `length(lineCoord) = 1` on the outer edge (unit circle).

Note that `lineCoord.x` does NOT provide distance along the line. To implement dashes, add a cumulative distance field to your `Vertex` struct. It will be interpolated and passed to `getColor` as an extra parameter. See the interactive demo's "Stripes" option for an example.

### Example Shaders

Solid color with edge darkening.
```wgsl
fn getColor(lineCoord: vec2f) -> vec4f {
  let edge = 1.0 - 0.3 * abs(lineCoord.y);
  return vec4f(0.2 * edge, 0.5 * edge, 0.9 * edge, 1.0);
}
```

Cross-line stripes using `lineCoord.y`.
```wgsl
fn getColor(lineCoord: vec2f) -> vec4f {
  let stripe = step(0.0, lineCoord.y);
  return vec4f(stripe * 0.2, 0.5, 0.9 - stripe * 0.4, 1.0);
}
```

SDF stroke with anti-aliasing.
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

When using transparency or `discard`, enable alpha blending.
```javascript
createGPULines(device, {
  colorTargets: {
    format: canvasFormat,
    blend: {
      color: { srcFactor: 'src-alpha', dstFactor: 'one-minus-src-alpha', operation: 'add' },
      alpha: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha', operation: 'add' }
    }
  }
});
```

### `vertexShaderBody`

The vertex shader body defines how line positions and per-vertex data are computed. You provide bind group declarations (group 1+) for your data, a struct defining the vertex output, and a vertex function that returns the struct given a point index.

The `position` field is a `vec4f` in clip space: `x` and `y` range from -1 to 1, `z` is depth, and `w` must be non-zero for valid points (0 or NaN signals a line break).

```wgsl
@group(1) @binding(0) var<storage, read> positions: array<vec4f>;
@group(1) @binding(1) var<uniform> viewMatrix: mat4x4f;

struct Vertex {
  position: vec4f,  // Clip-space position (w must be non-zero; w=0 or NaN for line breaks)
  width: f32,       // Line width in pixels
  // Additional fields become varyings passed to fragment shader
}

fn getVertex(index: u32) -> Vertex {
  let p = positions[index];
  let projected = viewMatrix * vec4f(p.xyz, 1.0);
  return Vertex(vec4f(projected.xyz, p.w * projected.w), 20.0);
}
```

Your `getVertex` function can read from any source (buffers, textures, procedural) and transform to clip space however you like.

Options for customization include `vertexFunction` (name of your vertex function, default `'getVertex'`), `positionField` (name of position field in struct, default `'position'`), and `widthField` (name of width field in struct, default `'width'`).

Available library uniforms are `uniforms.resolution` (canvas resolution in pixels) and `uniforms.pointCount` (number of points).

## Drawing

### `gpuLines.draw(pass, props, bindGroups)`

Draws lines in a render pass. The `props` object includes `vertexCount` (number of points in the line) and `resolution` (canvas resolution as `[width, height]`). The `bindGroups` parameter is an array of user bind groups for groups 1, 2, etc.

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

