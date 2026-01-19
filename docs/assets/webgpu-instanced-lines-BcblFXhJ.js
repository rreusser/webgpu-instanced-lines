function ne(t,i){const a=i?new RegExp(`struct\\s+${i}\\s*\\{([^}]+)\\}`,"s"):/struct\s+(\w+)\s*\{([^}]+)\}/s,n=t.match(a);if(!n)return[];const l=i?n[1]:n[2],r=[],f=/(\w+)\s*:\s*([\w<>]+)\s*,?/g;let o;for(;(o=f.exec(l))!==null;)r.push({name:o[1].trim(),type:o[2].trim()});return r}function re(t,i){const a=new RegExp(`fn\\s+${i}\\s*\\([^)]*\\)\\s*->\\s*(\\w+)`,"s"),n=t.match(a);return n?n[1]:null}function de(t,i){const{vertexShaderBody:a,fragmentShaderBody:n,format:l,vertexFunction:r="getVertex",positionField:f="position",widthField:o="width",join:u="bevel",joinResolution:w=8,maxJoinResolution:m=16,miterLimit:s=4,cap:x="round",capResolution:ae=8,maxCapResolution:y=16,blend:P=null,depthFormat:E=null,cullMode:W="none"}=i,v=re(a,r);if(!v)throw new Error(`Could not find vertex function '${r}' in vertexShaderBody`);const I=ne(a,v);if(I.length===0)throw new Error(`Could not parse struct '${v}' in vertexShaderBody`);const G=I.findIndex(e=>e.name===f);if(G===-1)throw new Error(`Position field '${f}' not found in struct '${v}'`);const V=I.findIndex(e=>e.name===o);if(V===-1)throw new Error(`Width field '${o}' not found in struct '${v}'. The vertex struct must include a width field.`);const S=I.filter((e,p)=>p!==G&&p!==V),b=u==="round",F=u==="bevel",R=F?0:s,X=x!=="butt";let $;x==="butt"?$=1:x==="square"?$=3:$=y;const A=b?m*2:2,D=$*2,T=x==="square"?[2,2/Math.sqrt(3)]:[1,1],K=(Math.max(D,A)+3)*2,Q=oe({userCode:a,vertexFunction:r,returnType:v,positionField:f,widthField:o,varyings:S,isRound:b}),Z=se({userCode:n,varyings:S});S.length+1;const ee=t.createShaderModule({label:"gpu-lines-vertex",code:Q}),te=t.createShaderModule({label:"gpu-lines-fragment",code:Z});t.createBindGroupLayout({label:"gpu-lines-uniforms",entries:[{binding:0,visibility:GPUShaderStage.VERTEX|GPUShaderStage.FRAGMENT,buffer:{type:"uniform"}}]});const z={label:"gpu-lines",layout:"auto",vertex:{module:ee,entryPoint:"vertexMain"},fragment:{module:te,entryPoint:"fragmentMain",targets:[P?{format:l,blend:P}:{format:l}]},primitive:{topology:"triangle-strip",stripIndexFormat:void 0,cullMode:W}};E&&(z.depthStencil={format:E,depthWriteEnabled:!0,depthCompare:"less"});const M=t.createRenderPipeline(z),L=t.createBuffer({label:"gpu-lines-uniforms",size:40,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST}),ie=t.createBindGroup({layout:M.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:L}}]}),_=new ArrayBuffer(40),d=new Float32Array(_),U=new Uint32Array(_);d[2]=D,d[3]=A,d[4]=R*R,U[5]=b?1:0,U[7]=X?1:0,d[8]=T[0],d[9]=T[1];let J=-1,k=-1,q=-1,N=D,Y=A,j=R*R,H=!1;return{getBindGroupLayout(e){return M.getBindGroupLayout(e)},updateUniforms(e){const{vertexCount:p,resolution:c}=e;let B=D;if(x==="round"&&e.capResolution!==void 0){const O=Math.min(e.capResolution,y);e.capResolution>y&&console.warn(`capResolution ${e.capResolution} exceeds maxCapResolution ${y}, clamping to ${y}`),B=O*2}let g=A;if(b&&e.joinResolution!==void 0){const O=Math.min(e.joinResolution,m);e.joinResolution>m&&console.warn(`joinResolution ${e.joinResolution} exceeds maxJoinResolution ${m}, clamping to ${m}`),g=O*2}let C=j;!F&&e.miterLimit!==void 0&&(C=e.miterLimit*e.miterLimit),(!H||p!==J||c[0]!==k||c[1]!==q||B!==N||g!==Y||C!==j)&&(d[0]=c[0],d[1]=c[1],d[2]=B,d[3]=g,d[4]=C,U[6]=p,t.queue.writeBuffer(L,0,_),J=p,k=c[0],q=c[1],N=B,Y=g,j=C,H=!0)},draw(e,p,c=[]){const{vertexCount:B,skipUniformUpdate:g}=p;g||this.updateUniforms(p);const C=Math.max(0,B-1);if(C>0){e.setPipeline(M),e.setBindGroup(0,ie);for(let h=0;h<c.length;h++)e.setBindGroup(h+1,c[h]);e.draw(K,C)}},destroy(){L.destroy()}}}function oe({userCode:t,vertexFunction:i,returnType:a,positionField:n,widthField:l,varyings:r,isRound:f}){const o=r.map((s,x)=>`  @location(${x+1}) ${s.name}: ${s.type},`).join(`
`),u=r.length+1,w=r.map(s=>`  let ${s.name} = mix(vertexB.${s.name}, vertexC.${s.name}, clamp(useC, 0.0, 1.0));`).join(`
`),m=r.map(s=>`  output.${s.name} = ${s.name};`).join(`
`);return`
// Library uniforms
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

// Vertex output (library + user varyings + debug varyings)
struct VertexOutput {
  @builtin(position) position: vec4f,
  @location(0) lineCoord: vec2f,
${o}
  @location(${u}) instanceID: f32,
  @location(${u+1}) triStripCoord: vec2f,
}

// User-provided code (bindings, structs, vertex function)
${t}

// Check if position is invalid (line break)
fn invalid(p: vec4f) -> bool {
  return p.w == 0.0 || p.x != p.x;
}

@vertex
fn vertexMain(
  @builtin(vertex_index) vertexIndex: u32,
  @builtin(instance_index) instanceIndex: u32
) -> VertexOutput {
  var output: VertexOutput;

  let pi = 3.141592653589793;
  let tol = 1e-4;
  let N = i32(uniforms.pointCount);

  // Instance i draws segment i → (i+1)
  let A_idx = i32(instanceIndex) - 1;
  let B_idx = i32(instanceIndex);
  let C_idx = i32(instanceIndex) + 1;
  let D_idx = i32(instanceIndex) + 2;

  // Call user's vertex function for each point in the window
  let vertexA = ${i}(u32(clamp(A_idx, 0, N - 1)));
  let vertexB = ${i}(u32(B_idx));
  let vertexC = ${i}(u32(C_idx));
  let vertexD = ${i}(u32(clamp(D_idx, 0, N - 1)));

  // Extract positions
  var pA = vertexA.${n};
  var pB = vertexB.${n};
  var pC = vertexC.${n};
  var pD = vertexD.${n};

  // Determine invalid states
  let aOutOfBounds = A_idx < 0;
  let dOutOfBounds = D_idx >= N;
  var aInvalid = aOutOfBounds || invalid(pA);
  var dInvalid = dOutOfBounds || invalid(pD);
  let bInvalid = invalid(pB);
  let cInvalid = invalid(pC);

  // Initialize output
  var lineCoord = vec2f(0.0);
  output.position = pB;

  // Skip degenerate segments
  if (bInvalid || cInvalid) {
    output.lineCoord = lineCoord;
    return output;
  }

  // Vertex counts for each half
  let capRes = uniforms.vertCnt2.x;
  let joinRes = uniforms.vertCnt2.y;
  let resB = select(joinRes, capRes, aInvalid && uniforms.insertCaps == 1u);
  let resC = select(joinRes, capRes, dInvalid && uniforms.insertCaps == 1u);
  let vB = resB + 3.0;
  let vC = resC + 3.0;
  let vTotal = vB + vC;

  // Determine if mirrored half
  let index = f32(vertexIndex);
  let mirror = index >= vB;

  // Perspective correction
  let pw = select(pB.w, pC.w, mirror);

  // Convert to screen-pixel coordinates
  let wA = select(pA.w, pB.w, aInvalid);
  let wD = select(pD.w, pC.w, dInvalid);
  pA = vec4f(vec3f(pA.xy * uniforms.resolution, pA.z) / wA, 1.0);
  pB = vec4f(vec3f(pB.xy * uniforms.resolution, pB.z) / pB.w, 1.0);
  pC = vec4f(vec3f(pC.xy * uniforms.resolution, pC.z) / pC.w, 1.0);
  pD = vec4f(vec3f(pD.xy * uniforms.resolution, pD.z) / wD, 1.0);

  // Depth check
  if (max(abs(pB.z), abs(pC.z)) > 1.0) {
    output.lineCoord = lineCoord;
    return output;
  }

  // Compute cap status before mirror swap (for debug varyings)
  let isStartCap = aInvalid && uniforms.insertCaps == 1u;
  let isEndCap = dInvalid && uniforms.insertCaps == 1u;

  // Swap for mirrored half
  if (mirror) {
    let tmp = pC; pC = pB; pB = tmp;
    let tmp2 = pD; pD = pA; pA = tmp2;
    let tmpInv = dInvalid; dInvalid = aInvalid; aInvalid = tmpInv;
  }

  // Handle caps/joins
  let isCap = aInvalid && uniforms.insertCaps == 1u;

  if (aInvalid) {
    if (uniforms.insertCaps == 1u) {
      pA = pC;
    } else {
      pA = 2.0 * pB - pC;
    }
  }
  if (dInvalid) {
    pD = 2.0 * pC - pB;
  }

  // Tangent and normal vectors
  var tBC = pC.xy - pB.xy;
  let lBC = length(tBC);
  if (lBC > 0.0) { tBC = tBC / lBC; }
  let nBC = vec2f(-tBC.y, tBC.x);

  var tAB = pB.xy - pA.xy;
  let lAB = length(tAB);
  if (lAB > 0.0) { tAB = tAB / lAB; }
  let nAB = vec2f(-tAB.y, tAB.x);

  var tCD = pD.xy - pC.xy;
  let lCD = length(tCD);
  if (lCD > 0.0) { tCD = tCD / lCD; }

  // Angle at B
  let cosB = clamp(dot(tAB, tBC), -1.0, 1.0);

  // Direction
  let mirrorSign = select(1.0, -1.0, mirror);
  var dirB = -dot(tBC, nAB);
  let bCollinear = abs(dirB) < tol;
  let bIsHairpin = bCollinear && cosB < 0.0;
  dirB = select(sign(dirB), -mirrorSign, bCollinear);

  // Miter vector
  var miter = select(0.5 * (nAB + nBC) * dirB, -tBC, bIsHairpin);

  // Join index
  var i = select(index, vTotal - index, mirror);
  let res = select(resB, resC, mirror);
  i = i - max(0.0, select(resB, resC, mirror) - res);
  i = i + select(0.0, -1.0, dirB < 0.0);
  i = i - select(0.0, 1.0, mirror);
  i = max(0.0, i);

  // Basis vectors
  var xBasis = tBC;
  var yBasis = nBC * dirB;
  var xy = vec2f(0.0);

  lineCoord.y = dirB * mirrorSign;

  // Get width from vertex struct (computed per-vertex)
  let width = select(vertexB.${l}, vertexC.${l}, mirror);
  let roundOrCap = uniforms.isRound == 1u || isCap;

  if (i == res + 1.0) {
    // Interior miter point
    let m = select((tAB.x * tBC.y - tAB.y * tBC.x) / (1.0 + cosB), 0.0, cosB <= -0.9999);
    xy = vec2f(min(abs(m), min(lBC, lAB) / width), -1.0);
    lineCoord.y = -lineCoord.y;
  } else {
    // Join/cap geometry
    let m2 = dot(miter, miter);
    let lm = sqrt(m2);
    if (lm > 0.0) {
      yBasis = miter / lm;
      xBasis = dirB * vec2f(yBasis.y, -yBasis.x);
    }
    let isBevel = 1.0 > uniforms.miterLimit * m2;

    if (i % 2.0 == 0.0) {
      if (roundOrCap || i != 0.0) {
        let t = clamp(i, 0.0, res) / res;
        let capMult = select(1.0, 2.0, isCap);
        let theta = -0.5 * (acos(cosB) * t - pi) * capMult;
        xy = vec2f(cos(theta), sin(theta));

        if (isCap) {
          if (xy.y > 0.001) {
            xy = xy * uniforms.capScale;
          }
          let prevLineCoordY = lineCoord.y;
          lineCoord.x = xy.y * prevLineCoordY;
          lineCoord.y = xy.x * prevLineCoordY;
        }
      } else {
        yBasis = select(miter, vec2f(0.0), bIsHairpin);
        xy.y = select(1.0 / m2, 1.0, isBevel);
      }
    } else {
      lineCoord.y = 0.0;
      if (isBevel && !roundOrCap) {
        xy.y = -1.0 + sqrt((1.0 + cosB) * 0.5);
      }
    }
  }

  // Final position
  let dP = mat2x2f(xBasis, yBasis) * xy;
  let dx = dot(dP, tBC) * mirrorSign;

  // For segments/joins, lineCoord.x stays at 0 (initialized above)
  // For caps, lineCoord.x was set in the cap geometry block

  var pos = pB;
  pos.x = pos.x + width * dP.x;
  pos.y = pos.y + width * dP.y;
  pos.x = pos.x / uniforms.resolution.x;
  pos.y = pos.y / uniforms.resolution.y;
  pos = pos * pw;

  // Interpolation factor for varyings
  let useC = select(0.0, 1.0, mirror) + dx * (width / lBC);

  // Interpolate user varyings
${w}

  output.position = pos;
  output.lineCoord = lineCoord;
${m}

  // Debug varyings: instanceID and triStripCoord
  // instanceID: segment index (negative for caps to distinguish them)
  // Note: isStartCap and isEndCap were computed before the mirror swap
  output.instanceID = select(f32(instanceIndex), -0.5, isStartCap || isEndCap);

  // triStripCoord: encodes position in the triangle strip for wireframe rendering
  // x: vertex pair index (0, 1, 2, ...), y: top (1) or bottom (0) of strip
  output.triStripCoord = vec2f(floor(f32(vertexIndex) * 0.5), f32(vertexIndex % 2u));

  return output;
}
`}function se({userCode:t,varyings:i}){const a=i.map((u,w)=>`  @location(${w+1}) ${u.name}: ${u.type},`).join(`
`),n=i.length+1,l=i.map(u=>`input.${u.name}`).join(", "),r=l?`, ${l}`:"",o=/\binstanceID\b/.test(t)?", input.instanceID, input.triStripCoord":"";return`
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
  @location(0) lineCoord: vec2f,
${a}
  @location(${n}) instanceID: f32,
  @location(${n+1}) triStripCoord: vec2f,
}

${t}

@fragment
fn fragmentMain(input: FragmentInput) -> @location(0) vec4f {
  return getColor(input.lineCoord${r}${o});
}
`}export{de as createGPULines};
