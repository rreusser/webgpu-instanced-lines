function K(e,t){const a=t?new RegExp(`struct\\s+${t}\\s*\\{([^}]+)\\}`,"s"):/struct\s+(\w+)\s*\{([^}]+)\}/s,n=e.match(a);if(!n)return[];const l=t?n[1]:n[2],r=[],c=/(\w+)\s*:\s*([\w<>]+)\s*,?/g;let s;for(;(s=c.exec(l))!==null;)r.push({name:s[1].trim(),type:s[2].trim()});return r}function Q(e,t){const a=new RegExp(`fn\\s+${t}\\s*\\([^)]*\\)\\s*->\\s*(\\w+)`,"s"),n=e.match(a);return n?n[1]:null}function ie(e,t){const{vertexShaderBody:a,fragmentShaderBody:n,format:l,vertexFunction:r="getVertex",positionField:c="position",widthField:s="width",join:u="bevel",joinResolution:v=8,miterLimit:y=4,cap:i="round",capResolution:g=8,blend:$=null,depthFormat:S=null}=t,m=Q(a,r);if(!m)throw new Error(`Could not find vertex function '${r}' in vertexShaderBody`);const x=K(a,m);if(x.length===0)throw new Error(`Could not parse struct '${m}' in vertexShaderBody`);const R=x.findIndex(o=>o.name===c);if(R===-1)throw new Error(`Position field '${c}' not found in struct '${m}'`);const U=x.findIndex(o=>o.name===s);if(U===-1)throw new Error(`Width field '${s}' not found in struct '${m}'. The vertex struct must include a width field.`);const h=x.filter((o,p)=>p!==R&&p!==U),w=u==="round",z=u==="bevel",_=w?v*2:2,M=z?0:y,k=i!=="none";let C;i==="none"?C=1:i==="square"?C=3:C=g;const O=C*2,P=i==="square"?[2,2/Math.sqrt(3)]:[1,1],q=(Math.max(O,_)+3)*2,N=Z({userCode:a,vertexFunction:r,returnType:m,positionField:c,widthField:s,varyings:h,isRound:w}),Y=ee({userCode:n,varyings:h});h.length+1;const H=e.createShaderModule({label:"gpu-lines-vertex",code:N}),W=e.createShaderModule({label:"gpu-lines-fragment",code:Y});e.createBindGroupLayout({label:"gpu-lines-uniforms",entries:[{binding:0,visibility:GPUShaderStage.VERTEX|GPUShaderStage.FRAGMENT,buffer:{type:"uniform"}}]});const L={label:"gpu-lines",layout:"auto",vertex:{module:H,entryPoint:"vertexMain"},fragment:{module:W,entryPoint:"fragmentMain",targets:[$?{format:l,blend:$}:{format:l}]},primitive:{topology:"triangle-strip",stripIndexFormat:void 0}};S&&(L.depthStencil={format:S,depthWriteEnabled:!0,depthCompare:"less"});const I=e.createRenderPipeline(L),b=e.createBuffer({label:"gpu-lines-uniforms",size:40,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST}),J=e.createBindGroup({layout:I.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:b}}]}),A=new ArrayBuffer(40),f=new Float32Array(A),D=new Uint32Array(A);f[2]=O,f[3]=_,f[4]=M*M,D[5]=w?1:0,D[7]=k?1:0,f[8]=P[0],f[9]=P[1];let E=-1,G=-1,j=-1,V=!1;return{getBindGroupLayout(o){return I.getBindGroupLayout(o)},updateUniforms(o){const{vertexCount:p,resolution:d}=o;(!V||p!==E||d[0]!==G||d[1]!==j)&&(f[0]=d[0],f[1]=d[1],D[6]=p,e.queue.writeBuffer(b,0,A),E=p,G=d[0],j=d[1],V=!0)},draw(o,p,d=[]){const{vertexCount:F,skipUniformUpdate:X}=p;X||this.updateUniforms(p);const T=Math.max(0,F-1);if(T>0){o.setPipeline(I),o.setBindGroup(0,J);for(let B=0;B<d.length;B++)o.setBindGroup(B+1,d[B]);o.draw(q,T)}},destroy(){b.destroy()}}}function Z({userCode:e,vertexFunction:t,returnType:a,positionField:n,widthField:l,varyings:r,isRound:c}){const s=r.map((i,g)=>`  @location(${g+1}) ${i.name}: ${i.type},`).join(`
`),u=r.length+1,v=r.map(i=>`  let ${i.name} = mix(vertexB.${i.name}, vertexC.${i.name}, clamp(useC, 0.0, 1.0));`).join(`
`),y=r.map(i=>`  output.${i.name} = ${i.name};`).join(`
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
${s}
  @location(${u}) instanceID: f32,
  @location(${u+1}) triStripCoord: vec2f,
}

// User-provided code (bindings, structs, vertex function)
${e}

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
  let vertexA = ${t}(u32(clamp(A_idx, 0, N - 1)));
  let vertexB = ${t}(u32(B_idx));
  let vertexC = ${t}(u32(C_idx));
  let vertexD = ${t}(u32(clamp(D_idx, 0, N - 1)));

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
${v}

  output.position = pos;
  output.lineCoord = lineCoord;
${y}

  // Debug varyings: instanceID and triStripCoord
  // instanceID: segment index (negative for caps to distinguish them)
  // Note: isStartCap and isEndCap were computed before the mirror swap
  output.instanceID = select(f32(instanceIndex), -0.5, isStartCap || isEndCap);

  // triStripCoord: encodes position in the triangle strip for wireframe rendering
  // x: vertex pair index (0, 1, 2, ...), y: top (1) or bottom (0) of strip
  output.triStripCoord = vec2f(floor(f32(vertexIndex) * 0.5), f32(vertexIndex % 2u));

  return output;
}
`}function ee({userCode:e,varyings:t}){const a=t.map((u,v)=>`  @location(${v+1}) ${u.name}: ${u.type},`).join(`
`),n=t.length+1,l=t.map(u=>`input.${u.name}`).join(", "),r=l?`, ${l}`:"",s=/\binstanceID\b/.test(e)?", input.instanceID, input.triStripCoord":"";return`
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

${e}

@fragment
fn fragmentMain(input: FragmentInput) -> @location(0) vec4f {
  return getColor(input.lineCoord${r}${s});
}
`}export{ie as createGPULines};
