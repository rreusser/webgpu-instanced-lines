/**
 * WebGPU GPU Lines - Instanced line rendering for WebGPU
 */

/** Join style for line corners */
export type JoinType = 'bevel' | 'miter' | 'round';

/** Cap style for line endpoints */
export type CapType = 'round' | 'square' | 'butt';

/** Face culling mode */
export type CullMode = 'none' | 'front' | 'back';

/** Options for creating a GPU lines renderer */
export interface GPULinesOptions {
  /** WGSL code with struct definition and vertex function */
  vertexShaderBody: string;
  /** WGSL code for fragment output (getColor function) */
  fragmentShaderBody: string;
  /** Output texture format */
  format: GPUTextureFormat;
  /** Name of user's vertex function (default: 'getVertex') */
  vertexFunction?: string;
  /** Name of position field in vertex struct (default: 'position') */
  positionField?: string;
  /** Name of width field in vertex struct (default: 'width') */
  widthField?: string;
  /** Join type: 'bevel', 'miter', or 'round' (default: 'bevel') */
  join?: JoinType;
  /** Max/default resolution for round joins (default: 16) */
  maxJoinResolution?: number;
  /** Default miter limit before switching to bevel (default: 4) */
  miterLimit?: number;
  /** Cap type: 'round', 'square', or 'butt' (default: 'round') */
  cap?: CapType;
  /** Max/default resolution for round caps (default: 16) */
  maxCapResolution?: number;
  /** Optional blend state for alpha blending */
  blend?: GPUBlendState;
  /** Optional depth format for depth testing (e.g., 'depth24plus') */
  depthFormat?: GPUTextureFormat;
  /** Face culling mode: 'none', 'front', or 'back' (default: 'none') */
  cullMode?: CullMode;
}

/** Properties for updating uniforms */
export interface UpdateUniformsProps {
  /** Number of vertices in the line */
  vertexCount: number;
  /** [width, height] of render target in pixels */
  resolution: [number, number];
  /** Override miter limit (only for 'miter' or 'round' joins) */
  miterLimit?: number;
  /** Use lower join resolution for optimization (defaults to maxJoinResolution) */
  joinResolution?: number;
  /** Use lower cap resolution for optimization (defaults to maxCapResolution) */
  capResolution?: number;
}

/** Properties for drawing lines */
export interface DrawProps extends UpdateUniformsProps {
  /** Skip uniform update (call updateUniforms first) */
  skipUniformUpdate?: boolean;
}

/** GPU lines renderer instance */
export interface GPULines {
  /**
   * Get bind group layout for user's data (group 1, 2, etc.)
   * @param index - Bind group index (1+)
   */
  getBindGroupLayout(index: number): GPUBindGroupLayout;

  /**
   * Update uniforms before the render pass begins.
   * Call this before beginRenderPass() to avoid writes during the pass.
   */
  updateUniforms(props: UpdateUniformsProps): void;

  /**
   * Draw lines in a render pass
   * @param pass - Render pass encoder
   * @param props - Draw properties
   * @param bindGroups - User bind groups for groups 1, 2, etc.
   */
  draw(pass: GPURenderPassEncoder, props: DrawProps, bindGroups?: GPUBindGroup[]): void;

  /** Destroy GPU resources */
  destroy(): void;
}

/**
 * Create a WebGPU lines renderer
 * @param device - WebGPU device
 * @param options - Configuration options
 */
export function createGPULines(device: GPUDevice, options: GPULinesOptions): GPULines;
