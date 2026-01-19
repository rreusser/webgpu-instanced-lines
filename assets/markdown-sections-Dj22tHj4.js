function u(l,h,o=0){const r=l.split(`
`);let e=!1,c=0;const t=[];for(const s of r){const n=s.match(/^(#{1,6})\s+(.+)$/);if(n){const i=n[1].length,f=n[2].trim();if(e){if(i<=c)break}else if(f===h&&(o===0||i===o)){e=!0,c=i;continue}}e&&t.push(s)}for(;t.length&&t[0].trim()==="";)t.shift();for(;t.length&&t[t.length-1].trim()==="";)t.pop();return t.join(`
`)}function a(l,h,o=0){const r=l.split(`
`);let e=!1,c=0;const t=[];for(const s of r){const n=s.match(/^(#{1,6})\s+(.+)$/);if(n){const i=n[1].length,f=n[2].trim();if(e){if(i<=c)break}else if(f===h&&(o===0||i===o)){e=!0,c=i,t.push(s);continue}}e&&t.push(s)}for(;t.length&&t[t.length-1].trim()==="";)t.pop();return t.join(`
`)}export{u as getSection,a as getSectionWithHeading};
