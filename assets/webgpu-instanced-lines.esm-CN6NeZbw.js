function oe(n,t){const o=t?new RegExp(`struct\\s+${t}\\s*\\{([^}]+)\\}`,"s"):/struct\s+(\w+)\s*\{([^}]+)\}/s,r=n.match(o);if(!r)return[];const s=t?r[1]:r[2],l=[],f=/(\w+)\s*:\s*([\w<>]+)\s*,?/g;let i;for(;(i=f.exec(s))!==null;)l.push({name:i[1].trim(),type:i[2].trim()});return l}function re(n,t){const o=new RegExp(`fn\\s+${t}\\s*\\([^)]*\\)\\s*->\\s*(\\w+)`,"s"),r=n.match(o);return r?r[1]:null}function ce(n,t){const{vertexShaderBody:o,fragmentShaderBody:r,colorTargets:s,depthStencil:l,multisample:f,primitive:i,vertexFunction:d="getVertex",positionField:m="position",widthField:a="width",join:b="miter",maxJoinResolution:x=8,miterLimit:J=4,cap:C="square",maxCapResolution:y=8,clampIndices:X=!0}=t,H=Array.isArray(s)?s:[s];i?.topology!==void 0&&i.topology!=="triangle-strip"&&console.warn(`gpu-lines: primitive.topology is "${i.topology}". This library is designed for 'triangle-strip' and may not render correctly.`),i?.stripIndexFormat!==void 0&&console.warn("gpu-lines: primitive.stripIndexFormat is set but this library does not use indexed drawing.");const B=re(o,d);if(!B)throw new Error(`Could not find vertex function '${d}' in vertexShaderBody`);const D=oe(o,B);if(D.length===0)throw new Error(`Could not parse struct '${B}' in vertexShaderBody`);const P=D.findIndex(e=>e.name===m);if(P===-1)throw new Error(`Position field '${m}' not found in struct '${B}'`);const U=D.findIndex(e=>e.name===a);if(U===-1)throw new Error(`Width field '${a}' not found in struct '${B}'. The vertex struct must include a width field.`);const W=D.filter((e,p)=>p!==P&&p!==U),$=b==="round",N=b==="bevel",A=N?0:J,K=C!=="butt";let j;C==="butt"?j=1:C==="square"?j=3:j=y;const I=$?x*2:2,S=j*2,k=C==="square"?[2,2/Math.sqrt(3)]:[1,1],Q=(Math.max(S,I)+3)*2,Z=se({userCode:o,vertexFunction:d,positionField:m,widthField:a,varyings:W,clampIndices:X}),ee=ae({userCode:r,varyings:W}),te=n.createShaderModule({label:"gpu-lines-vertex",code:Z}),ie=n.createShaderModule({label:"gpu-lines-fragment",code:ee}),R={label:"gpu-lines",layout:"auto",vertex:{module:te,entryPoint:"vertexMain"},fragment:{module:ie,entryPoint:"fragmentMain",targets:H},primitive:{topology:i?.topology??"triangle-strip",stripIndexFormat:i?.stripIndexFormat,cullMode:i?.cullMode??"none",frontFace:i?.frontFace??"ccw",unclippedDepth:i?.unclippedDepth??!1}};l&&(R.depthStencil=l),f&&(R.multisample=f);const T=n.createRenderPipeline(R),_=n.createBuffer({label:"gpu-lines-uniforms",size:40,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST}),ne=n.createBindGroup({layout:T.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:_}}]}),F=new ArrayBuffer(40),c=new Float32Array(F),M=new Uint32Array(F);c[2]=S,c[3]=I,c[4]=A*A,M[5]=$?1:0,M[7]=K?1:0,c[8]=k[0],c[9]=k[1];let E=-1,z=-1,q=-1,V=S,G=I,L=A*A,Y=!1;return{getBindGroupLayout(e){return T.getBindGroupLayout(e)},updateUniforms(e){const{vertexCount:p,resolution:u}=e;let g=S;if(C==="round"&&e.capResolution!==void 0){const O=Math.min(e.capResolution,y);e.capResolution>y&&console.warn(`capResolution ${e.capResolution} exceeds maxCapResolution ${y}, clamping to ${y}`),g=O*2}let v=I;if($&&e.joinResolution!==void 0){const O=Math.min(e.joinResolution,x);e.joinResolution>x&&console.warn(`joinResolution ${e.joinResolution} exceeds maxJoinResolution ${x}, clamping to ${x}`),v=O*2}let h=L;!N&&e.miterLimit!==void 0&&(h=e.miterLimit*e.miterLimit),(!Y||p!==E||u[0]!==z||u[1]!==q||g!==V||v!==G||h!==L)&&(c[0]=u[0],c[1]=u[1],c[2]=g,c[3]=v,c[4]=h,M[6]=p,n.queue.writeBuffer(_,0,F),E=p,z=u[0],q=u[1],V=g,G=v,L=h,Y=!0)},draw(e,p,u=[]){const{vertexCount:g,skipUniformUpdate:v}=p;v||this.updateUniforms(p);const h=Math.max(0,g-1);if(h>0){e.setPipeline(T),e.setBindGroup(0,ne);for(let w=0;w<u.length;w++)e.setBindGroup(w+1,u[w]);e.draw(Q,h)}},destroy(){_.destroy()}}}function se({userCode:n,vertexFunction:t,positionField:o,widthField:r,varyings:s,clampIndices:l}){const f=s.map((a,b)=>`  @location(${b+1}) ${a.name}: ${a.type},`).join(`
`),i=s.length+1,d=s.map(a=>`  let ${a.name} = mix(vertexB.${a.name}, vertexC.${a.name}, clamp(useC, 0.0, 1.0));`).join(`
`),m=s.map(a=>`  output.${a.name} = ${a.name};`).join(`
`);return`
//------------------------------------------------------------------------------
// GPU Lines Vertex Shader
//------------------------------------------------------------------------------
//
// This shader implements instanced line rendering with high-quality joins and caps.
// Each instance renders one line segment from point B to point C, along with half
// of the join at each end. The geometry is generated as a triangle strip.
//
// - 4-point window: A (previous), B (start), C (end), D (next)
// - Each instance covers: half of join at B + segment B→C + half of join at C
// - The triangle strip is divided into two halves that "mirror" each other
// - User provides a vertex function to compute position, width, and varyings
//
// Geometry layout:
// The triangle strip alternates between "outer" points (on the line boundary)
// and "inner" points (at the center of the join fan). For joins, vertices are
// arranged as a fan that smoothly transitions between incoming and outgoing
// segment directions.
//
//------------------------------------------------------------------------------

// Library uniforms
struct Uniforms {
  // Viewport resolution in pixels (width, height)
  resolution: vec2f,
  // Vertex count per half: (cap resolution * 2, join resolution * 2)
  // Controls the tessellation level for round caps and round joins
  vertCnt2: vec2f,
  // Squared miter limit - when miter length² exceeds this, use bevel join instead
  miterLimit: f32,
  // Whether to use round joins (1) or miter/bevel joins (0)
  isRound: u32,
  // Total number of points in the line
  pointCount: u32,
  // Whether to insert end caps (1) or leave line ends open (0)
  insertCaps: u32,
  // Scale factor for square caps: stretches the round cap geometry into a square
  capScale: vec2f,
}

@group(0) @binding(0) var<uniform> uniforms: Uniforms;

// Vertex output - passed to fragment shader for rendering
struct VertexOutput {
  // Clip-space position
  @builtin(position) position: vec4f,
  // Line coordinate for SDF-based rendering:
  //   x: signed distance into cap (-1 to 0 for start caps, 0 to +1 for end caps, 0 for segments/joins)
  //   y: signed distance from line center (-1 at edge, 0 at center, 1 at opposite edge)
  // Note: The sign of x indicates which cap (start vs end), sign of y indicates which side of the line
  @location(0) lineCoord: vec2f,
${f}
  // Debug varyings for visualization and debugging:
  // instanceID: Segment index (negative for cap vertices to distinguish them)
  @location(${i}) instanceID: f32,
  // triStripCoord: Position within triangle strip (x: pair index, y: top=1/bottom=0)
  @location(${i+1}) triStripCoord: vec2f,
}

// User-provided code (bindings, structs, vertex function)
${n}

// Check if a position represents a line break (NaN or w=0 signals invalid point)
fn invalid(p: vec4f) -> bool {
  return p.w == 0.0 || p.x != p.x;  // p.x != p.x is a NaN check
}

@vertex
fn vertexMain(
  @builtin(vertex_index) vertexIndex: u32,    // Which vertex within the triangle strip (0 to vertexCount-1)
  @builtin(instance_index) instanceIndex: u32  // Which line segment we're drawing
) -> VertexOutput {
  var output: VertexOutput;

  let pi = 3.141592653589793;
  let tol = 1e-4;  // Tolerance for collinearity detection
  let N = i32(uniforms.pointCount);  // Total points in the polyline

  //----------------------------------------------------------------------------
  // Compute indices for the 4-point window: A → B → C → D
  //----------------------------------------------------------------------------
  // Instance i draws the segment from point i to point i+1 (B to C).
  // We also need the previous point A (for the incoming join) and
  // the next point D (for the outgoing join).
  //
  //    A -----> B =======> C -----> D
  //           (start)   (end)
  //           segment being drawn
  //
  let A_idx = i32(instanceIndex) - 1;   // Previous point (for incoming tangent)
  let B_idx = i32(instanceIndex);       // Start of segment
  let C_idx = i32(instanceIndex) + 1;   // End of segment
  let D_idx = i32(instanceIndex) + 2;   // Next point (for outgoing tangent)

  //----------------------------------------------------------------------------
  // Fetch vertex data for all four points in the window
  //----------------------------------------------------------------------------
  // Call user's vertex function for each point in the window.
${l?`  // Clamp out-of-bounds indices so we can still read valid data (we'll mark them invalid below).
  let vertexA = ${t}(u32(clamp(A_idx, 0, N - 1)));
  let vertexB = ${t}(u32(B_idx));
  let vertexC = ${t}(u32(C_idx));
  let vertexD = ${t}(u32(clamp(D_idx, 0, N - 1)));`:`  // Pass raw indices (may be negative or >= N) - user handles wrapping/validation.
  let vertexA = ${t}(A_idx);
  let vertexB = ${t}(B_idx);
  let vertexC = ${t}(C_idx);
  let vertexD = ${t}(D_idx);`}

  // Extract positions from user vertex data
  var pA = vertexA.${o};
  var pB = vertexB.${o};
  var pC = vertexC.${o};
  var pD = vertexD.${o};

  //----------------------------------------------------------------------------
  // Determine which points are invalid (out of bounds or explicitly marked)
  //----------------------------------------------------------------------------
  // A point is invalid if it's outside the polyline bounds or if the user
  // marked it invalid (w=0 or NaN). Invalid endpoints A or D indicate line
  // ends where caps should be drawn instead of joins.
${l?`  // With clampIndices, out-of-bounds indices trigger automatic end caps.
  let aOutOfBounds = A_idx < 0;
  let dOutOfBounds = D_idx >= N;`:`  // Without clampIndices, user handles bounds - only check for invalid positions.
  let aOutOfBounds = false;
  let dOutOfBounds = false;`}
  var aInvalid = aOutOfBounds || invalid(pA);
  var dInvalid = dOutOfBounds || invalid(pD);
  let bInvalid = invalid(pB);
  let cInvalid = invalid(pC);

  // Initialize output with sensible default
  var lineCoord = vec2f(0.0);
  output.position = pB;  // Default to segment start for early returns

  // Skip degenerate segments - if either endpoint is invalid, there's no segment to draw
  if (bInvalid || cInvalid) {
    output.lineCoord = lineCoord;
    return output;
  }

  //----------------------------------------------------------------------------
  // Compute vertex allocation for this instance's triangle strip
  //----------------------------------------------------------------------------
  // Each half of the triangle strip (B-side and C-side) needs vertices for:
  //   - The join/cap geometry fan (resolution varies based on cap vs join)
  //   - 3 extra vertices: one miter point + one segment vertex pair + connection
  //
  // The total vertex count = vB + vC where each half is (resolution + 3).
  let capRes = uniforms.vertCnt2.x;   // 2 × cap resolution (for round caps)
  let joinRes = uniforms.vertCnt2.y;  // 2 × join resolution (for round joins)

  // Choose cap resolution for line ends, join resolution for interior points
  let resB = select(joinRes, capRes, aInvalid && uniforms.insertCaps == 1u);
  let resC = select(joinRes, capRes, dInvalid && uniforms.insertCaps == 1u);
  let vB = resB + 3.0;   // Vertices for B-side (start) half
  let vC = resC + 3.0;   // Vertices for C-side (end) half
  let vTotal = vB + vC;  // Total vertices in this instance's triangle strip

  //----------------------------------------------------------------------------
  // Determine which half of the strip we're computing
  //----------------------------------------------------------------------------
  // The triangle strip is split into two halves that "mirror" each other:
  //   - First half (vertices 0 to vB-1): processes B-side join/cap + half segment
  //   - Second half (vertices vB to end): processes C-side join/cap + half segment
  //
  // When mirror is true, we swap B↔C and A↔D to reuse the same geometry logic.
  let index = f32(vertexIndex);
  let mirror = index >= vB;

  // Save the perspective w-component for the appropriate endpoint
  // (will be used to restore perspective-correct position at the end)
  let pw = select(pB.w, pC.w, mirror);

  //----------------------------------------------------------------------------
  // Convert from NDC to screen-pixel coordinates
  //----------------------------------------------------------------------------
  // All line width calculations happen in pixel space for consistent appearance.
  // We multiply xy by resolution to get pixel coordinates, then divide by w
  // for perspective correction. The z is preserved for depth testing.
  //
  // For invalid endpoints, use the w from the valid neighbor to avoid div-by-zero.
  let wA = select(pA.w, pB.w, aInvalid);
  let wD = select(pD.w, pC.w, dInvalid);
  pA = vec4f(vec3f(pA.xy * uniforms.resolution, pA.z) / wA, 1.0);
  pB = vec4f(vec3f(pB.xy * uniforms.resolution, pB.z) / pB.w, 1.0);
  pC = vec4f(vec3f(pC.xy * uniforms.resolution, pC.z) / pC.w, 1.0);
  pD = vec4f(vec3f(pD.xy * uniforms.resolution, pD.z) / wD, 1.0);

  // Depth culling: skip segments entirely outside the view frustum
  if (max(abs(pB.z), abs(pC.z)) > 1.0) {
    output.lineCoord = lineCoord;
    return output;
  }

  // Compute cap status before mirror swap (for debug varyings - used later)
  let isStartCap = aInvalid && uniforms.insertCaps == 1u;
  let isEndCap = dInvalid && uniforms.insertCaps == 1u;

  //----------------------------------------------------------------------------
  // Mirror swap: reverse perspective for second half of triangle strip
  //----------------------------------------------------------------------------
  // We reuse the same geometry computation for both halves
  // of the triangle strip by swapping the point labels. When mirrored:
  //   - B becomes C, C becomes B (swap segment endpoints)
  //   - A becomes D, D becomes A (swap the neighboring points)
  //   - aInvalid/dInvalid swap accordingly
  // After swapping, we always compute geometry relative to "B" (the near end).
  if (mirror) {
    let tmp = pC; pC = pB; pB = tmp;
    let tmp2 = pD; pD = pA; pA = tmp2;
    let tmpInv = dInvalid; dInvalid = aInvalid; aInvalid = tmpInv;
  }

  //----------------------------------------------------------------------------
  // Handle end caps vs interior joins
  //----------------------------------------------------------------------------
  // After mirroring, if A is invalid, we're at a line end. There are two options:
  //   - Insert cap: reflect A to the opposite side of B (pA = pC) to create
  //     a 180° turn, which naturally produces a semicircular cap
  //   - No cap (butt end): extrapolate A beyond B (pA = 2B - C) to create
  //     a straight continuation, resulting in a flat end
  //
  // Similarly for D if invalid (though D typically just needs extrapolation
  // for join calculations).
  let isCap = aInvalid && uniforms.insertCaps == 1u;

  if (aInvalid) {
    if (uniforms.insertCaps == 1u) {
      // Cap: mirror A across B to produce 180° turn geometry
      pA = pC;
    } else {
      // Butt end: extrapolate A beyond B for flat termination
      pA = 2.0 * pB - pC;
    }
  }
  if (dInvalid) {
    // Always extrapolate D - we only draw half the join at C, so we just
    // need a reasonable tangent direction
    pD = 2.0 * pC - pB;
  }

  //----------------------------------------------------------------------------
  // Compute tangent and normal vectors for all segments
  //----------------------------------------------------------------------------
  // tXY = unit tangent vector from point X to point Y
  // nXY = unit normal vector (90° CCW rotation of tangent)
  // lXY = length of segment XY in pixels
  //
  //         nAB ↑         nBC ↑         nCD ↑
  //              \\             \\             \\
  //    A ------> B ==========> C ------> D
  //         tAB           tBC          tCD
  //
  var tBC = pC.xy - pB.xy;
  let lBC = length(tBC);
  if (lBC > 0.0) { tBC = tBC / lBC; }
  let nBC = vec2f(-tBC.y, tBC.x);  // 90° CCW rotation

  var tAB = pB.xy - pA.xy;
  let lAB = length(tAB);
  if (lAB > 0.0) { tAB = tAB / lAB; }
  let nAB = vec2f(-tAB.y, tAB.x);

  var tCD = pD.xy - pC.xy;
  let lCD = length(tCD);
  if (lCD > 0.0) { tCD = tCD / lCD; }

  // Compute the turning angle at B (between incoming and outgoing tangents)
  // cosB = cos(π - turning_angle) = -cos(turning_angle)
  // Clamped to [-1, 1] for numerical safety when taking arccos later
  let cosB = clamp(dot(tAB, tBC), -1.0, 1.0);

  //----------------------------------------------------------------------------
  // Determine the turn direction at vertex B
  //----------------------------------------------------------------------------
  // dirB indicates which side of the line the outer join should be on:
  //   +1 = outer join is on the left (CCW turn from A→B to B→C)
  //   -1 = outer join is on the right (CW turn)
  //
  // We compute this as -dot(tBC, nAB), which is the cross product (in 2D).
  // This gives us sin(angle) between the tangent vectors.
  //
  // Edge cases:
  //   - Collinear segments: dirB ≈ 0, use mirrorSign for consistent winding
  //   - Hairpin turn (180°): collinear but pointing opposite directions
  //
  let mirrorSign = select(1.0, -1.0, mirror);  // -1 for mirrored half, +1 otherwise
  var dirB = -dot(tBC, nAB);  // Cross product: positive if CCW turn
  let bCollinear = abs(dirB) < tol;  // Nearly straight - handle specially
  let bIsHairpin = bCollinear && cosB < 0.0;  // 180° turn (antiparallel tangents)
  // For collinear segments, use mirrorSign to ensure consistent winding
  dirB = select(sign(dirB), -mirrorSign, bCollinear);

  //----------------------------------------------------------------------------
  // Compute the miter vector at B
  //----------------------------------------------------------------------------
  // The miter vector bisects the angle between the incoming and outgoing normals,
  // pointing toward the OUTSIDE of the turn (where join geometry fills the gap).
  //
  //              A                      nAB always points "left" of segment
  //              |                      nBC always points "left" of segment
  //         nAB ←|                      miter = average, flipped by dirB to
  //              |   ↖ miter                   point toward outside of turn
  //              B---------→ C
  //                   ↑
  //                  nBC
  //
  // For hairpin turns (180°), use -tBC as miter (perpendicular to the "fold")
  var miter = select(0.5 * (nAB + nBC) * dirB, -tBC, bIsHairpin);

  //----------------------------------------------------------------------------
  // Compute the join vertex index within the triangle strip
  //----------------------------------------------------------------------------
  // The triangle strip is a fan that sweeps from one side of the join to the other.
  // We need to map the raw vertex index to a "join index" i that counts from 0.
  //
  // For the mirrored half, we count backwards from the end of the strip.
  // Then we apply several adjustments:
  //   1. Shift unused vertices to negative (they become degenerate triangles)
  //   2. Adjust for turn direction (maintains consistent winding)
  //   3. Offset mirrored vertices to connect properly at the midpoint
  //
  var i = select(index, vTotal - index, mirror);  // Reverse for mirrored half
  let res = select(resB, resC, mirror);  // Resolution for this half
  i = i - max(0.0, select(resB, resC, mirror) - res);  // Shift unused vertices negative
  i = i + select(0.0, -1.0, dirB < 0.0);  // Adjust for turn direction
  i = i - select(0.0, 1.0, mirror);  // Connect halves at midpoint
  i = max(0.0, i);  // Clamp to 0 - excess vertices become degenerate triangles

  //----------------------------------------------------------------------------
  // Initialize basis vectors for vertex positioning
  //----------------------------------------------------------------------------
  // The vertex position is computed as: position = B + width * (xBasis, yBasis) · xy
  // where xy is a 2D coordinate in the local join coordinate system:
  //   x = position along tangent (for miter extension)
  //   y = position along normal (for line width)
  //
  // Default basis: x along segment tangent, y along normal (pointing outward based on dirB)
  var xBasis = tBC;
  var yBasis = nBC * dirB;
  var xy = vec2f(0.0);  // Will be computed below based on vertex type

  // lineCoord.y tracks signed distance from center: ±1 at edges, 0 at center
  lineCoord.y = dirB * mirrorSign;

  // Get line width from the appropriate vertex (B for first half, C for mirrored half)
  let width = select(vertexB.${r}, vertexC.${r}, mirror);
  let roundOrCap = uniforms.isRound == 1u || isCap;

  //----------------------------------------------------------------------------
  // Generate join/cap geometry based on vertex index
  //----------------------------------------------------------------------------
  // The triangle strip alternates between "outer" vertices (on the line boundary)
  // and "center" vertices (at the join center). The pattern is:
  //
  //   outer[0] -- outer[2] -- outer[4] -- ... (even indices)
  //        \\    /    \\    /    \\    /
  //     center[1] - center[3] - center[5] ... (odd indices)
  //
  // Special vertex: i == res + 1 is the interior miter point (for sharp inner corners)
  //
  if (i == res + 1.0) {
    //--------------------------------------------------------------------------
    // Interior miter point: the sharp inner corner of the join
    //--------------------------------------------------------------------------
    // This vertex sits on the inner side of the join, where the two line edges
    // would intersect if extended. It completes the triangle fan.
    //
    // The miter extension is: m = sin(angle) / (1 + cos(angle)) = tan(angle/2)
    // We clamp it to avoid extending beyond the adjacent segment lengths.
    let m = select((tAB.x * tBC.y - tAB.y * tBC.x) / (1.0 + cosB), 0.0, cosB <= -0.9999);
    xy = vec2f(min(abs(m), min(lBC, lAB) / width), -1.0);
    lineCoord.y = -lineCoord.y;  // Flip sign for inner side
  } else {
    //--------------------------------------------------------------------------
    // Join/cap fan geometry
    //--------------------------------------------------------------------------
    // For joins and caps, we switch to a miter-aligned coordinate system:
    //   yBasis = normalized miter direction (outward)
    //   xBasis = perpendicular to miter (along the join "fold")
    //
    let m2 = dot(miter, miter);  // Squared miter length
    let lm = sqrt(m2);
    if (lm > 0.0) {
      yBasis = miter / lm;
      xBasis = dirB * vec2f(yBasis.y, -yBasis.x);
    }

    // Determine if we should use bevel (miter too long) or miter join
    // isBevel is true when 1 > miterLimit * m²  (m² inversely related to miter length)
    let isBevel = 1.0 > uniforms.miterLimit * m2;

    if (i % 2.0 == 0.0) {
      //------------------------------------------------------------------------
      // Even vertices: outer edge of the line/join
      //------------------------------------------------------------------------
      if (roundOrCap || i != 0.0) {
        //----------------------------------------------------------------------
        // Round join/cap: compute point on the arc
        //----------------------------------------------------------------------
        // Sweep from one side of the join to the other along an arc.
        // t goes from 0 to 1 as we traverse the join.
        // theta is the angle around the arc (0 = one edge, π = opposite edge)
        //
        // For caps: sweep full 180° (capMult = 2)
        // For joins: sweep the turning angle (capMult = 1)
        let t = clamp(i, 0.0, res) / res;
        let capMult = select(1.0, 2.0, isCap);
        let theta = -0.5 * (acos(cosB) * t - pi) * capMult;
        xy = vec2f(cos(theta), sin(theta));

        if (isCap) {
          // For square caps, scale the round geometry to form a square
          // (but leave the y=0 point unaffected to maintain connection)
          if (xy.y > 0.001) {
            xy = xy * uniforms.capScale;
          }
          // For caps, lineCoord encodes position within the cap for SDF rendering
          // lineCoord.x sign indicates cap direction:
          //   Start cap (negative-facing): -1 at tip to 0 at body
          //   End cap (positive-facing): 0 at body to +1 at tip
          let prevLineCoordY = lineCoord.y;
          lineCoord.x = select(-xy.y, xy.y, mirror);
          lineCoord.y = xy.x * prevLineCoordY;
        }
      } else {
        //----------------------------------------------------------------------
        // Miter join: first vertex (i=0) uses miter extension
        //----------------------------------------------------------------------
        // For sharp joins, extend to the miter point instead of using an arc.
        // The miter length is 1/m² (in normalized coordinates).
        // If bevel mode: just use 1 (no extension, creates bevel cut)
        yBasis = select(miter, vec2f(0.0), bIsHairpin);
        xy.y = select(1.0 / m2, 1.0, isBevel);
      }
    } else {
      //------------------------------------------------------------------------
      // Odd vertices: center of the join fan
      //------------------------------------------------------------------------
      // These vertices are at the center of the line (on the neutral axis)
      lineCoord.y = 0.0;

      // For bevel joins, offset the center vertex slightly inward to make
      // the bevel SDF work correctly (creates a flat cut appearance)
      if (isBevel && !roundOrCap) {
        xy.y = -1.0 + sqrt((1.0 + cosB) * 0.5);
      }
    }
  }

  //----------------------------------------------------------------------------
  // Compute final vertex position
  //----------------------------------------------------------------------------
  // Transform from local join coordinates (xy) to pixel offset (dP) using basis
  // dP = xBasis * xy.x + yBasis * xy.y
  let dP = mat2x2f(xBasis, yBasis) * xy;

  // Compute how far along the segment this vertex projects (for varying interpolation)
  // dx is the signed projection of dP onto the tangent direction
  let dx = dot(dP, tBC) * mirrorSign;

  // Note: lineCoord.x stays at 0 for segments/joins (initialized at start)
  // For caps, lineCoord.x was set in the cap geometry block above

  // Apply the position offset and convert back to NDC
  var pos = pB;
  pos.x = pos.x + width * dP.x;  // Add width-scaled offset in pixels
  pos.y = pos.y + width * dP.y;
  pos.x = pos.x / uniforms.resolution.x;  // Convert back to NDC
  pos.y = pos.y / uniforms.resolution.y;
  pos = pos * pw;  // Restore perspective (multiply by saved w)

  //----------------------------------------------------------------------------
  // Interpolate varyings between B and C
  //----------------------------------------------------------------------------
  // useC is the interpolation factor: 0 = use B's values, 1 = use C's values
  // For the mirrored half, we start at C (useC = 1) and subtract the offset
  // The dx term accounts for join geometry extending beyond the segment
  let useC = select(0.0, 1.0, mirror) + dx * (width / lBC);

  // Interpolate user varyings
${d}

  //----------------------------------------------------------------------------
  // Populate output structure
  //----------------------------------------------------------------------------
  output.position = pos;
  output.lineCoord = lineCoord;
${m}

  // Debug varyings for visualization and wireframe rendering
  // instanceID: segment index, or negative (-index - 1) for cap vertices
  // This encoding preserves alternation while indicating cap status
  // Note: isStartCap and isEndCap were computed before the mirror swap
  output.instanceID = select(f32(instanceIndex), -f32(instanceIndex) - 1.0, isStartCap || isEndCap);

  // triStripCoord: encodes position within the triangle strip
  //   x: which pair of vertices (0, 1, 2, ...)
  //   y: top (1) or bottom (0) of the strip
  // Useful for wireframe rendering and debugging strip connectivity
  output.triStripCoord = vec2f(floor(f32(vertexIndex) * 0.5), f32(vertexIndex % 2u));

  return output;
}
`}function ae({userCode:n,varyings:t}){const o=t.map((d,m)=>`  @location(${m+1}) ${d.name}: ${d.type},`).join(`
`),r=t.length+1,s=t.map(d=>`input.${d.name}`).join(", "),l=s?`, ${s}`:"",i=/\binstanceID\b/.test(n)?", input.instanceID, input.triStripCoord":"";return`
//------------------------------------------------------------------------------
// GPU Lines Fragment Shader
//------------------------------------------------------------------------------
//
// The fragment shader receives interpolated line coordinates and user varyings,
// then calls the user-provided getColor() function to compute the final color.
//
// Inputs:
//   lineCoord.x: for caps, signed distance into cap (-1 to 0 for start caps, 0 to +1 for end caps); 0 for segments/joins
//   lineCoord.y: signed distance from line center (-1 to 1, edges at ±1)
//
// These coordinates can be used to implement:
//   - Anti-aliasing using SDF (signed distance field)
//   - Round vs square cap appearance
//   - Dashed lines (using lineCoord.x for cap position)
//
//------------------------------------------------------------------------------

// Library uniforms (shared with vertex shader)
struct Uniforms {
  resolution: vec2f,
  vertCnt2: vec2f,
  miterLimit: f32,
  isRound: u32,
  pointCount: u32,
  insertCaps: u32,
  capScale: vec2f,
}

@group(0) @binding(0) var<uniform> uniforms: Uniforms;

struct FragmentInput {
  // Line coordinate for SDF-based effects
  @location(0) lineCoord: vec2f,
${o}
  // Debug: segment index (negative for caps)
  @location(${r}) instanceID: f32,
  // Debug: position in triangle strip (for wireframe)
  @location(${r+1}) triStripCoord: vec2f,
}

${n}

@fragment
fn fragmentMain(input: FragmentInput) -> @location(0) vec4f {
  return getColor(input.lineCoord${l}${i});
}
`}export{ce as createGPULines};
