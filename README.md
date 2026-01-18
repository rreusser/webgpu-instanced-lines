# WebGPU Lines

High-performance, flexible GPU-accelerated line rendering for WebGPU. This is a direct port of [regl-gpu-lines](https://github.com/rreusser/regl-gpu-lines) to WebGPU. The focus is on speed and customizability rather than sophisticated stroke expansion algorithms.

For background on GPU line rendering, see Matt DesLauriers' [Drawing Lines is Hard](https://mattdesl.svbtle.com/drawing-lines-is-hard) and Rye Terrell's [Instanced Line Rendering](https://wwwtyro.net/2019/11/18/instanced-lines.html).

## Installation

```bash
npm install webgpu-lines
```

## Usage

```javascript
import { createGPULines } from 'webgpu-lines';

const gpuLines = createGPULines(device, {
  format: canvasFormat,
  join: 'round',
  cap: 'round',
  vertexShaderBody: /* wgsl */`
    @group(1) @binding(0) var<storage, read> positions: array<vec4f>;

    struct Vertex {
      position: vec4f,
      width: f32,
    }

    fn getVertex(index: u32) -> Vertex {
      return Vertex(positions[index], 10.0);
    }
  `,
  fragmentShaderBody: /* wgsl */`
    fn getColor(lineCoord: vec2f) -> vec4f {
      return vec4f(0.2, 0.5, 0.9, 1.0);
    }
  `
});

// In render loop:
gpuLines.draw(pass, {
  vertexCount: numPoints,
  width: 20,
  resolution: [canvas.width, canvas.height]
}, [dataBindGroup]);
```

## How It Works

The renderer uses **instanced rendering** with triangle strips. For a line with N points, it draws N-1 instances, where each instance renders one line segment plus half of the join geometry on each end. End caps are simply joins stretched around to form a cap.

The geometry is carefully generated to optimize for high-performance rendering without the full rigor of stroke expansion algorithms, which handle self-intersection more carefully. The `lineCoord` varying is constructed so that `length(lineCoord)` gives consistent radial distance from the line center across both segments and caps, permitting uniform stroke widths.

### Features
- Instanced rendering with triangle strips
- Screen-projected lines using a custom vertex function that can read geometry from buffers, textures, or procedural computation
- Bevel, miter, and round joins
- Round, square, and butt end caps
- Line breaks via `w = 0` sentinel value
- A `lineCoord` varying that can be used to construct SDF stroke outlines with anti-aliasing

### Limitations

- The library does not handle self-intersecting lines.
- Rapidly varying line widths render incorrectly.
- World-space line widths require custom work in the vertex shader function.

## API Reference

See [docs/API.md](docs/API.md) for full API documentation.

## Examples

See the [examples](examples/) directory for working examples. Each demonstrates a different feature:

- **basic** - Simple sine wave with round joins and caps
- **closed-loop** - Seven-sided star (closed path)
- **variable-width** - Per-vertex width with cosine function
- **border** - SDF border effect with mouse interaction
- **dash** - Dashing with cumulative distance tracking
- **multiple** - Multiple separate lines with line breaks
- **depth** - Blended closed loop with transparency

## License

MIT
