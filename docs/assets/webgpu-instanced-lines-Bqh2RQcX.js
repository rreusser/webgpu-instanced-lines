function ae(t,i){const l=i?new RegExp(`struct\\s+${i}\\s*\\{([^}]+)\\}`,"s"):/struct\s+(\w+)\s*\{([^}]+)\}/s,n=t.match(l);if(!n)return[];const u=i?n[1]:n[2],r=[],x=/(\w+)\s*:\s*([\w<>]+)\s*,?/g;let s;for(;(s=x.exec(u))!==null;)r.push({name:s[1].trim(),type:s[2].trim()});return r}function le(t,i){const l=new RegExp(`fn\\s+${i}\\s*\\([^)]*\\)\\s*->\\s*(\\w+)`,"s"),n=t.match(l);return n?n[1]:null}function me(t,i){const{vertexShaderBody:l,fragmentShaderBody:n,format:u,vertexFunction:r="getVertex",positionField:x="position",widthField:s="width",join:d="bevel",joinResolution:h=8,maxJoinResolution:C=16,miterLimit:a=4,cap:c="round",capResolution:K=8,maxCapResolution:w=16,blend:G=null,depthFormat:V=null}=i,B=le(l,r);if(!B)throw new Error(`Could not find vertex function '${r}' in vertexShaderBody`);const R=ae(l,B);if(R.length===0)throw new Error(`Could not parse struct '${B}' in vertexShaderBody`);const F=R.findIndex(e=>e.name===x);if(F===-1)throw new Error(`Position field '${x}' not found in struct '${B}'`);const T=R.findIndex(e=>e.name===s);if(T===-1)throw new Error(`Width field '${s}' not found in struct '${B}'. The vertex struct must include a width field.`);const D=R.filter((e,p)=>p!==F&&p!==T),I=d==="round",z=d==="bevel",b=z?0:a,Q=c!=="none";let $;c==="none"?$=1:c==="square"?$=3:$=K;let A;c==="none"?A=1:c==="square"?A=3:A=w;const Z=I?C*2:2,ee=A*2,J=c==="square"?[2,2/Math.sqrt(3)]:[1,1],te=(Math.max(ee,Z)+3)*2,S=I?h*2:2,_=$*2,ie=ue({userCode:l,vertexFunction:r,returnType:B,positionField:x,widthField:s,varyings:D,isRound:I}),ne=de({userCode:n,varyings:D});D.length+1;const re=t.createShaderModule({label:"gpu-lines-vertex",code:ie}),oe=t.createShaderModule({label:"gpu-lines-fragment",code:ne});t.createBindGroupLayout({label:"gpu-lines-uniforms",entries:[{binding:0,visibility:GPUShaderStage.VERTEX|GPUShaderStage.FRAGMENT,buffer:{type:"uniform"}}]});const q={label:"gpu-lines",layout:"auto",vertex:{module:re,entryPoint:"vertexMain"},fragment:{module:oe,entryPoint:"fragmentMain",targets:[G?{format:u,blend:G}:{format:u}]},primitive:{topology:"triangle-strip",stripIndexFormat:void 0}};V&&(q.depthStencil={format:V,depthWriteEnabled:!0,depthCompare:"less"});const L=t.createRenderPipeline(q),M=t.createBuffer({label:"gpu-lines-uniforms",size:48,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST}),se=t.createBindGroup({layout:L.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:M}}]}),U=new ArrayBuffer(48),o=new Float32Array(U),j=new Uint32Array(U);o[2]=_,o[3]=S,o[4]=b*b,j[5]=I?1:0,j[7]=Q?1:0,o[8]=J[0],o[9]=J[1],o[10]=1;let k=-1,N=-1,Y=-1,H=_,W=S,O=b*b,P=1,X=!1;return{getBindGroupLayout(e){return L.getBindGroupLayout(e)},updateUniforms(e){const{vertexCount:p,resolution:f}=e;let g=_;if(c==="round"&&e.capResolution!==void 0){const E=Math.min(e.capResolution,w);e.capResolution>w&&console.warn(`capResolution ${e.capResolution} exceeds maxCapResolution ${w}, clamping to ${w}`),g=E*2}let y=S;if(I&&e.joinResolution!==void 0){const E=Math.min(e.joinResolution,C);e.joinResolution>C&&console.warn(`joinResolution ${e.joinResolution} exceeds maxJoinResolution ${C}, clamping to ${C}`),y=E*2}let v=O;!z&&e.miterLimit!==void 0&&(v=e.miterLimit*e.miterLimit);const m=e.width!==void 0?e.width:P;(!X||p!==k||f[0]!==N||f[1]!==Y||g!==H||y!==W||v!==O||m!==P)&&(o[0]=f[0],o[1]=f[1],o[2]=g,o[3]=y,o[4]=v,j[6]=p,o[10]=m,t.queue.writeBuffer(M,0,U),k=p,N=f[0],Y=f[1],H=g,W=y,O=v,P=m,X=!0)},draw(e,p,f=[]){const{vertexCount:g,skipUniformUpdate:y}=p;y||this.updateUniforms(p);const v=Math.max(0,g-1);if(v>0){e.setPipeline(L),e.setBindGroup(0,se);for(let m=0;m<f.length;m++)e.setBindGroup(m+1,f[m]);e.draw(te,v)}},destroy(){M.destroy()}}}function ue({userCode:t,vertexFunction:i,returnType:l,positionField:n,widthField:u,varyings:r,isRound:x}){const s=r.map((a,c)=>`  @location(${c+1}) ${a.name}: ${a.type},`).join(`
`),d=r.length+1,h=r.map(a=>`  let ${a.name} = mix(vertexB.${a.name}, vertexC.${a.name}, clamp(useC, 0.0, 1.0));`).join(`
`),C=r.map(a=>`  output.${a.name} = ${a.name};`).join(`
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
  width: f32,
}

@group(0) @binding(0) var<uniform> uniforms: Uniforms;

// Vertex output (library + user varyings + debug varyings)
struct VertexOutput {
  @builtin(position) position: vec4f,
  @location(0) lineCoord: vec2f,
${s}
  @location(${d}) instanceID: f32,
  @location(${d+1}) triStripCoord: vec2f,
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
  let width = select(vertexB.${u}, vertexC.${u}, mirror);
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
${h}

  output.position = pos;
  output.lineCoord = lineCoord;
${C}

  // Debug varyings: instanceID and triStripCoord
  // instanceID: segment index (negative for caps to distinguish them)
  // Note: isStartCap and isEndCap were computed before the mirror swap
  output.instanceID = select(f32(instanceIndex), -0.5, isStartCap || isEndCap);

  // triStripCoord: encodes position in the triangle strip for wireframe rendering
  // x: vertex pair index (0, 1, 2, ...), y: top (1) or bottom (0) of strip
  output.triStripCoord = vec2f(floor(f32(vertexIndex) * 0.5), f32(vertexIndex % 2u));

  return output;
}
`}function de({userCode:t,varyings:i}){const l=i.map((d,h)=>`  @location(${h+1}) ${d.name}: ${d.type},`).join(`
`),n=i.length+1,u=i.map(d=>`input.${d.name}`).join(", "),r=u?`, ${u}`:"",s=/\binstanceID\b/.test(t)?", input.instanceID, input.triStripCoord":"";return`
// Library uniforms (shared with vertex shader)
struct Uniforms {
  resolution: vec2f,
  vertCnt2: vec2f,
  miterLimit: f32,
  isRound: u32,
  pointCount: u32,
  insertCaps: u32,
  capScale: vec2f,
  width: f32,
}

@group(0) @binding(0) var<uniform> uniforms: Uniforms;

struct FragmentInput {
  @location(0) lineCoord: vec2f,
${l}
  @location(${n}) instanceID: f32,
  @location(${n+1}) triStripCoord: vec2f,
}

${t}

@fragment
fn fragmentMain(input: FragmentInput) -> @location(0) vec4f {
  return getColor(input.lineCoord${r}${s});
}
`}export{me as createGPULines};
