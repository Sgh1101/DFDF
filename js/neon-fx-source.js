// Generated numeric/vertex port of Seafle Neon 1.0.0-release (NoSound).
// Source JAR SHA256: 384bb3cbb1bf5858493f6b8598b684c1f27433fdb5b06a987f286bd68780bd8e
// Regenerate using scripts/port-neon-effects.py; see docs/NEON_AGENT.md.
(function(root){'use strict';
let nowMs=0, state={opaque:false,texture:null}, vertices=[], batches=[], wallStripes=()=>{},groundProbe=(x,z,y)=>y;
class Vec {
 constructor(x=0,y=0,z=0){if(typeof x==='object'){this.x=x.x;this.y=x.y;this.z=x.z;}else{this.x=x;this.y=y;this.z=z;}}
 set(x,y,z){this.x=x;this.y=y;this.z=z;return this;}
 cross(v){const {x,y,z}=this;return this.set(y*v.z-z*v.y,z*v.x-x*v.z,x*v.y-y*v.x);}
 lengthSquared(){return this.x*this.x+this.y*this.y+this.z*this.z;}
 normalize(){const l=Math.sqrt(this.lengthSquared())||1;return this.mul(1/l);}
 mul(v){this.x*=v;this.y*=v;this.z*=v;return this;}
}
class WallGeom {
 constructor(w,dx,dz,px,pz,len){Object.assign(this,{w,dirX:dx,dirZ:dz,perpX:px,perpZ:pz,lenXZ:len});}
 worldX(s){return this.w.startX+(this.w.endX-this.w.startX)*s;}
 worldZ(s){return this.w.startZ+(this.w.endZ-this.w.startZ)*s;}
 worldY(r,h){return this.w.startY+h*r;}
}
const buf={method_1328(){vertices=[];},method_22918(m,x,y,z){this.p=[x,y,z];this.uv=[0,0];return this;},method_22913(u,v){this.uv=[u,v];return this;},method_22915(r,g,b,a){this.c=[r,g,b,a];return this;},method_1344(){vertices.push([...this.p,...this.c,...this.uv]);}};
const tess={method_1349(){return buf;},method_1350(){batches.push({opaque:state.opaque,texture:state.texture,vertices});vertices=[];}};
function begin(ms,probe){nowMs=ms;batches=[];state.opaque=false;state.texture=null;wallStripes=probe||(()=>{});}
const LUMP_COUNTS = [8, 14, 22, 30, 40];
const LUMP_WIDTHS = [0.16, 0.09, 0.05, 0.028, 0.015];
const LUMP_HEIGHTS = [0.95, 0.85, 0.72, 0.55, 0.4];
const LUMP_SPEEDS = [0.45, 0.75, 1.2, 1.75, 2.4];
const LUMP_SIGMA_SCALE = [0.85, 0.72, 0.6, 0.5, 0.4];
const LUMP_ALIVE_POW = [0.4, 0.55, 0.8, 1.1, 1.45];
const LUMP_WIDTH_VAR = [1.0, 0.85, 0.7, 0.55, 0.45];
const LUMP_HEIGHT_VAR = [0.65, 0.6, 0.55, 0.5, 0.45];
const LUMP_TIP_SHARPEN = [1.6, 1.9, 2.2, 2.6, 3.0];
const LUMP_OCTAVES = 3;
const F = {

curlAlpha(rf,sf,t) {
        let intensity;
        let rfFlow = rf + t * 0.28;
        let streakCount = 5;
        let minDist = 1.0;
        for (let i = 0; i < streakCount; ++i) {
            let baseSf = (i + 0.5) / streakCount;
            let phase = i * 1.31;
            let shift = Math.sin(rfFlow * 7.0 + phase) * 0.045 + Math.sin(rfFlow * 13.0 + phase * 2.1) * 0.02;
            let streakSf = baseSf + shift;
            let dist = Math.abs(sf - streakSf);
            if (!(dist < minDist)) continue;
            minDist = dist;
        }
        let streakHalfWidth = 0.012;
        if (minDist < streakHalfWidth) {
            intensity = 1.0 - minDist / streakHalfWidth;
            intensity = Math.pow(intensity, 0.7);
        } else {
            let outerWidth = streakHalfWidth * 2.5;
            if (minDist < outerWidth) {
                let u = (minDist - streakHalfWidth) / (outerWidth - streakHalfWidth);
                intensity = (1.0 - u) * 0.35;
            } else {
                intensity = 0.0;
            }
        }
        let rfEnv = rf < 0.08 ? rf / 0.08 : (rf < 0.7 ? 1.0 : 1.0 - (rf - 0.7) / 0.3);
        rfEnv = Math.max(0.0, rfEnv);
        return intensity * 0.75 * rfEnv;
    },

evaluateLump(sf,t,lumpIdx,oct,widthBase,heightBase,speed,sigmaScale,alivePow,widthVar,heightVar) {
        let phaseT = t * speed + lumpIdx * 0.13 + oct * 1.7;
        let cycleIdx = Math.floor(phaseT);
        let cycleFrac = (phaseT - cycleIdx);
        let alive = Math.sin(cycleFrac * Math.PI);
        if ((alive = Math.pow(alive, alivePow)) < 0.02) {
            return 0.0;
        }
        let seed = lumpIdx * 47 + oct * 971 + cycleIdx * 13;
        let rCenter = F.hashN(seed, 900.0 + oct);
        let rWidth = F.hashN(seed + 991, 901.0 + oct);
        let rHeight = F.hashN(seed + 1783, 902.0 + oct);
        let center = rCenter;
        let width = widthBase * (0.4 + rWidth * widthVar);
        let height = heightBase * (0.3 + rHeight * heightVar) * alive;
        let sigma = width * sigmaScale;
        let d = sf - center;
        return F.gaussianBumpValue(d, sigma) * height;
    },

gaussianBumpValue(d,sigma) {
        if (sigma < 0.001) {
            sigma = 0.001;
        }
        let x = d / sigma;
        return Math.exp(-0.5 * x * x);
    },

hashN(x,seed) {
        let v = Math.sin(x * 127.1 + seed * 311.7) * 43758.5453;
        v -= Math.floor(v);
        return v;
    },

lerp(a,b,t) {
        return a + (b - a) * t;
    },

mainBodyColor(rf,sf,t) {
        let a;
        let b;
        let g;
        let r;
        let flow = Math.sin(sf * 12.0 + t * 2.5) * 0.04;
        let shifted = Math.max(0.0, Math.min(1.0, rf + flow));
        if (shifted < 0.03) {
            r = 1.0;
            g = 1.0;
            b = 0.95;
            a = 1.0;
        } else if (shifted < 0.15) {
            let u = (shifted - 0.03) / 0.12;
            r = F.lerp(1.0, 1.0, u);
            g = F.lerp(1.0, 0.86, u);
            b = F.lerp(0.95, 0.24, u);
            a = 1.0;
        } else if (shifted < 0.3) {
            let u = (shifted - 0.15) / 0.15;
            r = F.lerp(1.0, 0.47, u);
            g = F.lerp(0.86, 0.86, u);
            b = F.lerp(0.24, 0.94, u);
            a = F.lerp(1.0, 0.98, u);
        } else if (shifted < 0.55) {
            let u = (shifted - 0.3) / 0.25;
            r = F.lerp(0.47, 0.24, u);
            g = F.lerp(0.86, 0.75, u);
            b = F.lerp(0.94, 0.94, u);
            a = 0.97;
        } else if (shifted < 0.85) {
            let u = (shifted - 0.55) / 0.3;
            r = F.lerp(0.24, 0.08, u);
            g = F.lerp(0.75, 0.22, u);
            b = F.lerp(0.94, 0.65, u);
            a = F.lerp(0.97, 0.92, u);
        } else {
            let u = (shifted - 0.85) / 0.15;
            r = F.lerp(0.08, 0.02, u);
            g = F.lerp(0.22, 0.06, u);
            b = F.lerp(0.65, 0.35, u);
            a = F.lerp(0.92, 0.0, u * u);
        }
        return [r, g, b, a];
    },

mistAlpha(rf) {
        let centered = Math.sin(rf * Math.PI);
        return 0.12 * centered;
    },

renderL11_TopDarkBand(m,g,t,alphaMul) {


        buf.method_1328(0, 0);
        let segs = 24;
        for (let s = 0; s < segs; ++s) {
            let sf0 = s / segs;
            let sf1 = (s + 1) / segs;
            let x0 = g.worldX(sf0);
            let z0 = g.worldZ(sf0);
            let x1 = g.worldX(sf1);
            let z1 = g.worldZ(sf1);
            let top0 = F.topSilhouette(sf0, t);
            let top1 = F.topSilhouette(sf1, t);
            let h0 = g.w.height * (0.5 + top0 * 0.55);
            let h1 = g.w.height * (0.5 + top1 * 0.55);
            let y0Top = g.w.startY + h0;
            let y1Top = g.w.startY + h1;
            let y0Band = y0Top - g.w.height * 0.08;
            let y1Band = y1Top - g.w.height * 0.08;
            let aTop = 0.0;
            let aBand = 0.45 * alphaMul;
            buf.method_22918(m, x1, y1Top, z1).method_22915(0.02, 0.1, 0.55, aTop).method_1344();
            buf.method_22918(m, x0, y0Top, z0).method_22915(0.02, 0.1, 0.55, aTop).method_1344();
            buf.method_22918(m, x0, y0Band, z0).method_22915(0.02, 0.1, 0.55, aBand).method_1344();
            buf.method_22918(m, x1, y1Band, z1).method_22915(0.02, 0.1, 0.55, aBand).method_1344();
        }
        tess.method_1350();
    },

renderL1_MainBody(m,g,t,alphaMul) {
        state.opaque=true;



        buf.method_1328(0, 0);
        let segs = 24;
        let rows = 10;
        for (let s = 0; s < segs; ++s) {
            let sf0 = s / segs;
            let sf1 = (s + 1) / segs;
            let x0 = g.worldX(sf0);
            let z0 = g.worldZ(sf0);
            let x1 = g.worldX(sf1);
            let z1 = g.worldZ(sf1);
            let rise0 = F.wallRiseProgress(g.w, sf0);
            let rise1 = F.wallRiseProgress(g.w, sf1);
            if (rise0 <= 0.0 && rise1 <= 0.0) continue;
            let top0 = F.topSilhouette(sf0, t);
            let top1 = F.topSilhouette(sf1, t);
            let h0 = g.w.height * (0.5 + top0 * 0.55) * rise0;
            let h1 = g.w.height * (0.5 + top1 * 0.55) * rise1;
            for (let r = 0; r < rows; ++r) {
                let rf0 = r / rows;
                let rf1 = (r + 1) / rows;
                let y00 = g.worldY(rf0, h0);
                let y10 = g.worldY(rf1, h0);
                let y01 = g.worldY(rf0, h1);
                let y11 = g.worldY(rf1, h1);
                let c00 = F.mainBodyColor(rf0, sf0, t);
                let c10 = F.mainBodyColor(rf1, sf0, t);
                let c01 = F.mainBodyColor(rf0, sf1, t);
                let c11 = F.mainBodyColor(rf1, sf1, t);
                buf.method_22918(m, x1, y11, z1).method_22915(c11[0], c11[1], c11[2], 1.0).method_1344();
                buf.method_22918(m, x0, y10, z0).method_22915(c10[0], c10[1], c10[2], 1.0).method_1344();
                buf.method_22918(m, x0, y00, z0).method_22915(c00[0], c00[1], c00[2], 1.0).method_1344();
                buf.method_22918(m, x1, y01, z1).method_22915(c01[0], c01[1], c01[2], 1.0).method_1344();
                buf.method_22918(m, x1, y01, z1).method_22915(c01[0], c01[1], c01[2], 1.0).method_1344();
                buf.method_22918(m, x0, y00, z0).method_22915(c00[0], c00[1], c00[2], 1.0).method_1344();
                buf.method_22918(m, x0, y10, z0).method_22915(c10[0], c10[1], c10[2], 1.0).method_1344();
                buf.method_22918(m, x1, y11, z1).method_22915(c11[0], c11[1], c11[2], 1.0).method_1344();
            }
        }
        tess.method_1350();
        state.opaque=false;


    },

renderL2_InternalCurl(m,g,t,alphaMul) {


        buf.method_1328(0, 0);
        let segs = 24;
        let rows = 10;
        for (let s = 0; s < segs; ++s) {
            let sf0 = s / segs;
            let sf1 = (s + 1) / segs;
            let x0 = g.worldX(sf0);
            let z0 = g.worldZ(sf0);
            let x1 = g.worldX(sf1);
            let z1 = g.worldZ(sf1);
            let top0 = F.topSilhouette(sf0, t);
            let top1 = F.topSilhouette(sf1, t);
            let h0 = g.w.height * (0.5 + top0 * 0.55);
            let h1 = g.w.height * (0.5 + top1 * 0.55);
            for (let r = 0; r < rows; ++r) {
                let rf0 = r / rows;
                let rf1 = (r + 1) / rows;
                let y00 = g.worldY(rf0, h0);
                let y10 = g.worldY(rf1, h0);
                let y01 = g.worldY(rf0, h1);
                let y11 = g.worldY(rf1, h1);
                let a00 = F.curlAlpha(rf0, sf0, t) * alphaMul;
                let a10 = F.curlAlpha(rf1, sf0, t) * alphaMul;
                let a01 = F.curlAlpha(rf0, sf1, t) * alphaMul;
                let a11 = F.curlAlpha(rf1, sf1, t) * alphaMul;
                buf.method_22918(m, x1, y11, z1).method_22915(0.6, 0.9, 1.0, a11).method_1344();
                buf.method_22918(m, x0, y10, z0).method_22915(0.6, 0.9, 1.0, a10).method_1344();
                buf.method_22918(m, x0, y00, z0).method_22915(0.6, 0.9, 1.0, a00).method_1344();
                buf.method_22918(m, x1, y01, z1).method_22915(0.6, 0.9, 1.0, a01).method_1344();
            }
        }
        tess.method_1350();
    },

renderL3_FrontMist(m,g,t,alphaMul) {
        let mistOffset = 0.08;
        for (let side = 0; side < 2; ++side) {
            let sideSign = side == 0 ? 1.0 : -1.0;


            buf.method_1328(0, 0);
            let segs = 12;
            let rows = 5;
            for (let s = 0; s < segs; ++s) {
                let sf0 = s / segs;
                let sf1 = (s + 1) / segs;
                let x0 = g.worldX(sf0) + g.perpX * mistOffset * sideSign;
                let z0 = g.worldZ(sf0) + g.perpZ * mistOffset * sideSign;
                let x1 = g.worldX(sf1) + g.perpX * mistOffset * sideSign;
                let z1 = g.worldZ(sf1) + g.perpZ * mistOffset * sideSign;
                let h = g.w.height * 0.85;
                for (let r = 0; r < rows; ++r) {
                    let rf0 = r / rows;
                    let rf1 = (r + 1) / rows;
                    let y00 = g.w.startY + (h * rf0);
                    let y10 = g.w.startY + (h * rf1);
                    let pulse = 0.5 + 0.5 * Math.sin(sf0 * 8.0 + t * 1.5);
                    let aBase = F.mistAlpha(rf0) * pulse;
                    let aTop = F.mistAlpha(rf1) * pulse;
                    let aFinal0 = aBase * alphaMul;
                    let aFinal1 = aTop * alphaMul;
                    buf.method_22918(m, x1, y10, z1).method_22915(0.2, 0.55, 1.0, aFinal1).method_1344();
                    buf.method_22918(m, x0, y10, z0).method_22915(0.2, 0.55, 1.0, aFinal1).method_1344();
                    buf.method_22918(m, x0, y00, z0).method_22915(0.2, 0.55, 1.0, aFinal0).method_1344();
                    buf.method_22918(m, x1, y00, z1).method_22915(0.2, 0.55, 1.0, aFinal0).method_1344();
                }
            }
            tess.method_1350();
        }
    },

renderL5_BottomSmallFlames(m,g,t,alphaMul) {
        let flameCount = Math.max(6, Math.trunc(g.lenXZ * 5.0));


        buf.method_1328(0, 0);
        for (let i = 0; i < flameCount; ++i) {
            let cB;
            let cG;
            let cR;
            let cycle;
            let cycleT;
            let lifeDur = 0.3 + F.hashN(i * 47, 500.0) * 0.4;
            let birthOff = F.hashN(i * 31, 501.0) * 0.6;
            let age = t - birthOff;
            if (age < 0.0 || (cycleT = age - (cycle = Math.trunc(age / (lifeDur + 0.1))) * (lifeDur + 0.1)) >= lifeDur) continue;
            let lifeF = cycleT / lifeDur;
            let seedMix = i * 100 + cycle;
            let rSf = F.hashN(seedMix * 29, 502.0);
            let rSize = F.hashN(seedMix * 41, 503.0);
            let rColor = F.hashN(seedMix * 71, 504.0);
            let envelope = lifeF < 0.15 ? 1.0 - Math.exp(-6.0 * lifeF / 0.15) : (lifeF < 0.7 ? 1.0 : Math.exp(-4.0 * (lifeF - 0.7) / 0.3));
            let sfCenter = rSf;
            let bx = g.worldX(sfCenter);
            let bz = g.worldZ(sfCenter);
            let frontOff = 0.06 + rSize * 0.08;
            bx += g.perpX * frontOff;
            bz += g.perpZ * frontOff;
            let flameH = g.w.height * (0.05 + rSize * 0.14);
            let flameW = flameH * 0.4;
            let baseY = g.w.startY;
            let tipY = baseY + flameH;
            let bxL = bx - g.dirX * flameW * 0.5;
            let bzL = bz - g.dirZ * flameW * 0.5;
            let bxR = bx + g.dirX * flameW * 0.5;
            let bzR = bz + g.dirZ * flameW * 0.5;
            if (rColor < 0.33) {
                cR = 1.0;
                cG = 0.95;
                cB = 0.3;
            } else if (rColor < 0.66) {
                cR = 0.5;
                cG = 1.0;
                cB = 0.5;
            } else {
                cR = 0.35;
                cG = 0.9;
                cB = 1.0;
            }
            let aFinal = envelope * alphaMul * 0.85;
            buf.method_22918(m, bx, tipY, bz).method_22915(cR, cG, cB, 0.0).method_1344();
            buf.method_22918(m, bx, tipY, bz).method_22915(cR, cG, cB, aFinal * 0.5).method_1344();
            buf.method_22918(m, bxR, baseY, bzR).method_22915(cR, cG, cB, aFinal).method_1344();
            buf.method_22918(m, bxL, baseY, bzL).method_22915(cR, cG, cB, aFinal).method_1344();
        }
        tess.method_1350();
    },

renderL6_SideTendrils(m,g,t,alphaMul) {
        let tendrilCount = Math.max(4, Math.trunc(g.lenXZ * 2.0));


        buf.method_1328(0, 0);
        for (let i = 0; i < tendrilCount; ++i) {
            let rSf = F.hashN(i * 53, 600.0);
            let rH = F.hashN(i * 71, 601.0);
            let rL = F.hashN(i * 89, 602.0);
            let rPhase = F.hashN(i * 41, 603.0);
            let phaseT = t * 2.0 + rPhase * 6.28;
            let pulse = 0.5 + 0.5 * Math.sin(phaseT);
            let sfRoot = rSf;
            let sfTip = Math.max(0.0, Math.min(1.0, sfRoot + (rL - 0.5) * 0.08));
            let yRoot = g.w.height * (0.1 + rH * 0.4);
            let yTip = yRoot + g.w.height * 0.12 * pulse;
            let rx = g.worldX(sfRoot);
            let rz = g.worldZ(sfRoot);
            let tx = g.worldX(sfTip);
            let tz = g.worldZ(sfTip);
            let ryW = g.w.startY + yRoot;
            let tyW = g.w.startY + yTip;
            let frontOff = 0.04;
            tx += g.perpX * frontOff;
            tz += g.perpZ * frontOff;
            let thick = 0.03 + rH * 0.05;
            let rxL = (rx += g.perpX * frontOff) - g.dirX * thick;
            let rzL = (rz += g.perpZ * frontOff) - g.dirZ * thick;
            let rxR = rx + g.dirX * thick;
            let rzR = rz + g.dirZ * thick;
            let txL = tx - g.dirX * thick * 0.3;
            let tzL = tz - g.dirZ * thick * 0.3;
            let txR = tx + g.dirX * thick * 0.3;
            let tzR = tz + g.dirZ * thick * 0.3;
            let aRoot = 0.7 * pulse * alphaMul;
            let aTip = 0.0;
            buf.method_22918(m, txR, tyW, tzR).method_22915(0.35, 0.9, 1.0, aTip).method_1344();
            buf.method_22918(m, txL, tyW, tzL).method_22915(0.35, 0.9, 1.0, aTip).method_1344();
            buf.method_22918(m, rxL, ryW, rzL).method_22915(0.35, 0.9, 1.0, aRoot).method_1344();
            buf.method_22918(m, rxR, ryW, rzR).method_22915(0.35, 0.9, 1.0, aRoot).method_1344();
        }
        tess.method_1350();
    },

renderL7_FloorHotLine(m,g,t,alphaMul) {


        buf.method_1328(0, 0);
        let segs = 24;
        let thick = 0.08;
        let floorY = g.w.startY + 0.01;
        for (let s = 0; s < segs; ++s) {
            let sf0 = s / segs;
            let sf1 = (s + 1) / segs;
            let x0 = g.worldX(sf0);
            let z0 = g.worldZ(sf0);
            let x1 = g.worldX(sf1);
            let z1 = g.worldZ(sf1);
            let x0L = x0 - g.perpX * thick;
            let z0L = z0 - g.perpZ * thick;
            let x0R = x0 + g.perpX * thick;
            let z0R = z0 + g.perpZ * thick;
            let x1L = x1 - g.perpX * thick;
            let z1L = z1 - g.perpZ * thick;
            let x1R = x1 + g.perpX * thick;
            let z1R = z1 + g.perpZ * thick;
            let pulse = 0.85 + 0.15 * Math.sin(sf0 * 20.0 + t * 4.0);
            let aCenter = 0.85 * pulse * alphaMul;
            let aEdge = 0.0;
            buf.method_22918(m, x1, floorY, z1).method_22915(1.0, 1.0, 1.0, aCenter).method_1344();
            buf.method_22918(m, x1L, floorY, z1L).method_22915(1.0, 1.0, 1.0, aEdge).method_1344();
            buf.method_22918(m, x0L, floorY, z0L).method_22915(1.0, 1.0, 1.0, aEdge).method_1344();
            buf.method_22918(m, x0, floorY, z0).method_22915(1.0, 1.0, 1.0, aCenter).method_1344();
            buf.method_22918(m, x1R, floorY, z1R).method_22915(1.0, 1.0, 1.0, aEdge).method_1344();
            buf.method_22918(m, x1, floorY, z1).method_22915(1.0, 1.0, 1.0, aCenter).method_1344();
            buf.method_22918(m, x0, floorY, z0).method_22915(1.0, 1.0, 1.0, aCenter).method_1344();
            buf.method_22918(m, x0R, floorY, z0R).method_22915(1.0, 1.0, 1.0, aEdge).method_1344();
        }
        tess.method_1350();
    },

renderL8_InnerShimmer(m,g,t,alphaMul) {
        let shimmerCount = Math.max(6, Math.trunc(g.lenXZ * 6.0));


        buf.method_1328(0, 0);
        for (let i = 0; i < shimmerCount; ++i) {
            let cycle;
            let cycleT;
            let lifeDur = 0.15 + F.hashN(i * 37, 700.0) * 0.2;
            let birthOff = F.hashN(i * 71, 701.0) * 0.8;
            let age = t - birthOff;
            if (age < 0.0 || (cycleT = age - (cycle = Math.trunc(age / (lifeDur + 0.15))) * (lifeDur + 0.15)) >= lifeDur) continue;
            let lifeF = cycleT / lifeDur;
            let seedMix = i * 100 + cycle;
            let rSf = F.hashN(seedMix * 29, 702.0);
            let rRf = F.hashN(seedMix * 41, 703.0) * 0.7;
            let rSize = F.hashN(seedMix * 53, 704.0);
            let envelope = lifeF < 0.25 ? lifeF / 0.25 : 1.0 - (lifeF - 0.25) / 0.75;
            envelope = Math.max(0.0, envelope);
            let cx = g.worldX(rSf);
            let cz = g.worldZ(rSf);
            let cy = g.w.startY + (g.w.height * 0.72 * rRf);
            let size = 0.05 + rSize * 0.1;
            let aFinal = envelope * alphaMul * 0.85;
            let dx = g.dirX * size;
            let dz = g.dirZ * size;
            buf.method_22918(m, (cx + dx), (cy + size), (cz + dz)).method_22915(1.0, 1.0, 1.0, aFinal).method_1344();
            buf.method_22918(m, (cx - dx), (cy + size), (cz - dz)).method_22915(1.0, 1.0, 1.0, aFinal).method_1344();
            buf.method_22918(m, (cx - dx), (cy - size), (cz - dz)).method_22915(1.0, 1.0, 1.0, aFinal).method_1344();
            buf.method_22918(m, (cx + dx), (cy - size), (cz + dz)).method_22915(1.0, 1.0, 1.0, aFinal).method_1344();
        }
        tess.method_1350();
    },

renderSingleWall(m,w,t,alphaMul) {
        let dx = w.endX - w.startX;
        let dz = w.endZ - w.startZ;
        let lenXZ = Math.sqrt(dx * dx + dz * dz);
        if (lenXZ < 0.001) {
            return;
        }
        let dirX = dx / lenXZ;
        let dirZ = dz / lenXZ;
        let perpX = -dirZ;
        let perpZ = dirX;
        let geom = new WallGeom(w, dirX, dirZ, perpX, perpZ, lenXZ);
        F.renderL1_MainBody(m, geom, t, alphaMul);
        F.renderL2_InternalCurl(m, geom, t, alphaMul);
        F.renderL8_InnerShimmer(m, geom, t, alphaMul);
        F.renderL3_FrontMist(m, geom, t, alphaMul);
        F.renderL5_BottomSmallFlames(m, geom, t, alphaMul);
        F.renderL6_SideTendrils(m, geom, t, alphaMul);
        F.renderL11_TopDarkBand(m, geom, t, alphaMul);
        F.renderL7_FloorHotLine(m, geom, t, alphaMul);
    },

topSilhouette(sf,t) {
        let maxLump = 0.0;
        for (let oct = 0; oct < 3; ++oct) {
            let octContrib = F.topSilhouetteOctave(sf, t, oct);
            if (!(octContrib > maxLump)) continue;
            maxLump = octContrib;
        }
        return Math.max(0.0, Math.min(1.0, maxLump));
    },

topSilhouetteOctave(sf,t,oct) {
        let lumpCount = LUMP_COUNTS[oct];
        let widthBase = LUMP_WIDTHS[oct];
        let heightBase = LUMP_HEIGHTS[oct];
        let speed = LUMP_SPEEDS[oct];
        let sigmaScale = LUMP_SIGMA_SCALE[oct];
        let alivePow = LUMP_ALIVE_POW[oct];
        let widthVar = LUMP_WIDTH_VAR[oct];
        let heightVar = LUMP_HEIGHT_VAR[oct];
        let tipSharpen = LUMP_TIP_SHARPEN[oct];
        let maxLump = 0.0;
        for (let i = 0; i < lumpCount; ++i) {
            let lump = F.evaluateLump(sf, t, i, oct, widthBase, heightBase, speed, sigmaScale, alivePow, widthVar, heightVar);
            if (!(lump > maxLump)) continue;
            maxLump = lump;
        }
        if (maxLump > 0.0) {
            maxLump = Math.pow(maxLump, Math.min(tipSharpen * 0.4, 1.4));
        }
        return maxLump;
    },

wallRiseProgress(w,sf) {
        let riseP;
        let now = nowMs;
        let elapsedMs = now - w.spawnMs;
        let riseDuration = 280.0;
        if (elapsedMs < 0.0) {
            return 0.0;
        }
        if (elapsedMs >= riseDuration) {
            riseP = 1.0;
        } else {
            let p = (elapsedMs / riseDuration);
            riseP = 1.0 - (1.0 - p) * (1.0 - p) * (1.0 - p);
        }
        let totalLife = 4000.0;
        let fadeStart = totalLife - 800.0;
        let fadeSweepMs = 500.0;
        let fadeSpotMs = 300.0;
        let sfDelay = sf * fadeSweepMs;
        let fadeLocalT = elapsedMs - fadeStart - sfDelay;
        let fadeP = fadeLocalT < 0.0 ? 0.0 : (fadeLocalT >= fadeSpotMs ? 1.0 : (fadeLocalT / fadeSpotMs));
        fadeP = fadeP * fadeP * fadeP;
        return riseP * (1.0 - fadeP);
    },

};

const R = {

drawFilledDisk(m,cx,cy,cz,radius,r,g,b,alpha) {


        buf.method_1328(0, 0);
        let segs = 48;
        for (let i = 0; i < segs; ++i) {
            let a0 = i * Math.PI * 2.0 / segs;
            let a1 = (i + 1) * Math.PI * 2.0 / segs;
            let x0 = cx + Math.cos(a0) * radius;
            let z0 = cz + Math.sin(a0) * radius;
            let x1 = cx + Math.cos(a1) * radius;
            let z1 = cz + Math.sin(a1) * radius;
            buf.method_22918(m, x1, cy, z1).method_22915(r, g, b, alpha).method_1344();
            buf.method_22918(m, x0, cy, z0).method_22915(r, g, b, alpha).method_1344();
            buf.method_22918(m, cx, cy, cz).method_22915(r, g, b, alpha).method_1344();
            buf.method_22918(m, cx, cy, cz).method_22915(r, g, b, alpha).method_1344();
        }
        tess.method_1350();
    },

drawFlatLine(m,x0,y0,z0,x1,y1,z1,halfThick,r,g,b,alpha) {
        let dx = x1 - x0;
        let dz = z1 - z0;
        let dLen = Math.sqrt(dx * dx + dz * dz);
        if (dLen < 0.001) {
            dLen = 0.001;
        }
        let px = -dz / dLen * halfThick;
        let pz = dx / dLen * halfThick;


        buf.method_1328(0, 0);
        buf.method_22918(m, x1 + px, y1, z1 + pz).method_22915(r, g, b, 0.0).method_1344();
        buf.method_22918(m, x1 - px, y1, z1 - pz).method_22915(r, g, b, 0.0).method_1344();
        buf.method_22918(m, x0 - px, y0, z0 - pz).method_22915(r, g, b, alpha).method_1344();
        buf.method_22918(m, x0 + px, y0, z0 + pz).method_22915(r, g, b, alpha).method_1344();
        tess.method_1350();
    },

drawFlatRing(m,cx,cy,cz,radius,thickness,r,g,b,alpha) {


        buf.method_1328(0, 0);
        let segs = 48;
        for (let i = 0; i < segs; ++i) {
            let a0 = i * Math.PI * 2.0 / segs;
            let a1 = (i + 1) * Math.PI * 2.0 / segs;
            let rIn = radius - thickness;
            let rOut = radius + thickness;
            let x0i = cx + Math.cos(a0) * rIn;
            let z0i = cz + Math.sin(a0) * rIn;
            let x1i = cx + Math.cos(a1) * rIn;
            let z1i = cz + Math.sin(a1) * rIn;
            let x0o = cx + Math.cos(a0) * rOut;
            let z0o = cz + Math.sin(a0) * rOut;
            let x1o = cx + Math.cos(a1) * rOut;
            let z1o = cz + Math.sin(a1) * rOut;
            buf.method_22918(m, x1o, cy, z1o).method_22915(r, g, b, alpha).method_1344();
            buf.method_22918(m, x1i, cy, z1i).method_22915(r, g, b, alpha).method_1344();
            buf.method_22918(m, x0i, cy, z0i).method_22915(r, g, b, alpha).method_1344();
            buf.method_22918(m, x0o, cy, z0o).method_22915(r, g, b, alpha).method_1344();
        }
        tess.method_1350();
    },

drawFogPuff(m,cx,cy,cz,size,r,g,b,alpha) {


        buf.method_1328(0, 0);
        for (let face = 0; face < 3; ++face) {
            let ey;
            let ex;
            let dx = face == 0 ? size : 0.0;
            let dy = face == 1 ? size : 0.0;
            let dz = face == 2 ? size : 0.0;
            let f = ex = face == 0 ? 0.0 : size;
            let f2 = face == 1 ? 0.0 : (ey = face == 0 ? size : 0.0);
            let ez = face == 2 ? 0.0 : (face != 0 ? size : 0.0);
            let ax = 0.0;
            let ay = 0.0;
            let az = 0.0;
            let bx = 0.0;
            let by = 0.0;
            let bz = 0.0;
            switch (face) {
                case 0: {
                    ay = size;
                    bz = size;
                    break;
                }
                case 1: {
                    ax = size;
                    bz = size;
                    break;
                }
                case 2: {
                    ax = size;
                    by = size;
                }
            }
            buf.method_22918(m, cx + ax + bx, cy + ay + by, cz + az + bz).method_22915(r, g, b, 0.0).method_1344();
            buf.method_22918(m, cx - ax + bx, cy - ay + by, cz - az + bz).method_22915(r, g, b, 0.0).method_1344();
            buf.method_22918(m, cx - ax - bx, cy - ay - by, cz - az - bz).method_22915(r, g, b, 0.0).method_1344();
            buf.method_22918(m, cx + ax - bx, cy + ay - by, cz + az - bz).method_22915(r, g, b, 0.0).method_1344();
            buf.method_22918(m, cx + ax * 0.4, cy + ay * 0.4, cz + az * 0.4).method_22915(r, g, b, alpha).method_1344();
            buf.method_22918(m, cx - ax * 0.4, cy - ay * 0.4, cz - az * 0.4).method_22915(r, g, b, alpha).method_1344();
            buf.method_22918(m, cx - ax * 0.4 + bx * 0.3, cy - ay * 0.4 + by * 0.3, cz - az * 0.4 + bz * 0.3).method_22915(r, g, b, alpha).method_1344();
            buf.method_22918(m, cx + ax * 0.4 + bx * 0.3, cy + ay * 0.4 + by * 0.3, cz + az * 0.4 + bz * 0.3).method_22915(r, g, b, alpha).method_1344();
        }
        tess.method_1350();
    },

drawGlowBand(m,cx,cy,cz,radius,halfBand,rCore,gCore,bCore,aCore,rEdge,gEdge,bEdge,aEdge) {


        buf.method_1328(0, 0);
        let segs = 64;
        let rIn = Math.max(0.001, radius - halfBand);
        let rMid = radius;
        let rOut = radius + halfBand;
        for (let i = 0; i < segs; ++i) {
            let a0 = i * Math.PI * 2.0 / segs;
            let a1 = (i + 1) * Math.PI * 2.0 / segs;
            let cx0 = Math.cos(a0);
            let sz0 = Math.sin(a0);
            let cx1 = Math.cos(a1);
            let sz1 = Math.sin(a1);
            let x0i = cx + cx0 * rIn;
            let z0i = cz + sz0 * rIn;
            let x1i = cx + cx1 * rIn;
            let z1i = cz + sz1 * rIn;
            let x0m = cx + cx0 * rMid;
            let z0m = cz + sz0 * rMid;
            let x1m = cx + cx1 * rMid;
            let z1m = cz + sz1 * rMid;
            buf.method_22918(m, x1m, cy, z1m).method_22915(rCore, gCore, bCore, aCore).method_1344();
            buf.method_22918(m, x1i, cy, z1i).method_22915(rEdge, gEdge, bEdge, aEdge).method_1344();
            buf.method_22918(m, x0i, cy, z0i).method_22915(rEdge, gEdge, bEdge, aEdge).method_1344();
            buf.method_22918(m, x0m, cy, z0m).method_22915(rCore, gCore, bCore, aCore).method_1344();
            let x0o = cx + cx0 * rOut;
            let z0o = cz + sz0 * rOut;
            let x1o = cx + cx1 * rOut;
            let z1o = cz + sz1 * rOut;
            buf.method_22918(m, x1o, cy, z1o).method_22915(rEdge, gEdge, bEdge, aEdge).method_1344();
            buf.method_22918(m, x1m, cy, z1m).method_22915(rCore, gCore, bCore, aCore).method_1344();
            buf.method_22918(m, x0m, cy, z0m).method_22915(rCore, gCore, bCore, aCore).method_1344();
            buf.method_22918(m, x0o, cy, z0o).method_22915(rEdge, gEdge, bEdge, aEdge).method_1344();
        }
        tess.method_1350();
    },

drawRibbonPass(m,xs,ys,zs,camPos,halfThick,alphaMul,outer) {
        let n = 101;
        let perps = new Array(n);
        for (let i = 0; i < n; ++i) {
            let tan = i == 0 ? new Vec(xs[1] - xs[0], ys[1] - ys[0], zs[1] - zs[0]) : (i == n - 1 ? new Vec(xs[i] - xs[i - 1], ys[i] - ys[i - 1], zs[i] - zs[i - 1]) : new Vec(xs[i + 1] - xs[i - 1], ys[i + 1] - ys[i - 1], zs[i + 1] - zs[i - 1]));
            if (tan.lengthSquared() < 1.0E-8) {
                tan.set(1.0, 0.0, 0.0);
            }
            tan.normalize();
            let toCam = new Vec(camPos.x - xs[i], camPos.y - ys[i], camPos.z - zs[i]);
            if (toCam.lengthSquared() < 1.0E-8) {
                toCam.set(0.0, 0.0, 1.0);
            }
            toCam.normalize();
            let perp = new Vec(tan).cross(toCam);
            if (perp.lengthSquared() < 1.0E-8) {
                perp.set(0.0, 1.0, 0.0);
            }
            perp.normalize().mul(halfThick);
            perps[i] = perp;
        }


        buf.method_1328(0, 0);
        for (let i = 0; i < 100; ++i) {
            let f0 = i / 100.0;
            let f1 = (i + 1) / 100.0;
            let c0 = R.ribbonColor(f0, outer);
            let c1 = R.ribbonColor(f1, outer);
            let a0 = c0[3] * alphaMul;
            let a1 = c1[3] * alphaMul;
            let p0 = perps[i];
            let p1 = perps[i + 1];
            buf.method_22918(m, xs[i + 1] + p1.x, ys[i + 1] + p1.y, zs[i + 1] + p1.z).method_22915(c1[0], c1[1], c1[2], a1).method_1344();
            buf.method_22918(m, xs[i + 1] - p1.x, ys[i + 1] - p1.y, zs[i + 1] - p1.z).method_22915(c1[0], c1[1], c1[2], a1).method_1344();
            buf.method_22918(m, xs[i] - p0.x, ys[i] - p0.y, zs[i] - p0.z).method_22915(c0[0], c0[1], c0[2], a0).method_1344();
            buf.method_22918(m, xs[i] + p0.x, ys[i] + p0.y, zs[i] + p0.z).method_22915(c0[0], c0[1], c0[2], a0).method_1344();
        }
        tess.method_1350();
    },

drawUvSphere(m,cx,cy,cz,radiusXZ,aspectY,r,g,b,alpha) {


        buf.method_1328(0, 0);
        let radiusY = radiusXZ * aspectY;
        for (let i = 0; i < 14; ++i) {
            let phi0 = -1.5707963267948966 + i / 14.0 * Math.PI;
            let phi1 = -1.5707963267948966 + (i + 1) / 14.0 * Math.PI;
            let cosPhi0 = Math.cos(phi0);
            let cosPhi1 = Math.cos(phi1);
            let sinPhi0 = Math.sin(phi0);
            let sinPhi1 = Math.sin(phi1);
            for (let j = 0; j < 22; ++j) {
                let theta0 = j / 22.0 * Math.PI * 2.0;
                let theta1 = (j + 1) / 22.0 * Math.PI * 2.0;
                let cosT0 = Math.cos(theta0);
                let cosT1 = Math.cos(theta1);
                let sinT0 = Math.sin(theta0);
                let sinT1 = Math.sin(theta1);
                let x00 = cx + radiusXZ * cosPhi0 * cosT0;
                let y00 = cy + radiusY * sinPhi0;
                let z00 = cz + radiusXZ * cosPhi0 * sinT0;
                let x01 = cx + radiusXZ * cosPhi0 * cosT1;
                let y01 = cy + radiusY * sinPhi0;
                let z01 = cz + radiusXZ * cosPhi0 * sinT1;
                let x11 = cx + radiusXZ * cosPhi1 * cosT1;
                let y11 = cy + radiusY * sinPhi1;
                let z11 = cz + radiusXZ * cosPhi1 * sinT1;
                let x10 = cx + radiusXZ * cosPhi1 * cosT0;
                let y10 = cy + radiusY * sinPhi1;
                let z10 = cz + radiusXZ * cosPhi1 * sinT0;
                buf.method_22918(m, x11, y11, z11).method_22915(r, g, b, alpha).method_1344();
                buf.method_22918(m, x01, y01, z01).method_22915(r, g, b, alpha).method_1344();
                buf.method_22918(m, x00, y00, z00).method_22915(r, g, b, alpha).method_1344();
                buf.method_22918(m, x10, y10, z10).method_22915(r, g, b, alpha).method_1344();
            }
        }
        tess.method_1350();
    },

drawVerticalHaloCylinder(m,cx,cy,cz,radius,height,segs,rBot,gBot,bBot,aBot,rTop,gTop,bTop,aTop) {


        buf.method_1328(0, 0);
        for (let i = 0; i < segs; ++i) {
            let a0 = i * Math.PI * 2.0 / segs;
            let a1 = (i + 1) * Math.PI * 2.0 / segs;
            let x0 = cx + Math.cos(a0) * radius;
            let z0 = cz + Math.sin(a0) * radius;
            let x1 = cx + Math.cos(a1) * radius;
            let z1 = cz + Math.sin(a1) * radius;
            buf.method_22918(m, x0, cy + height, z0).method_22915(rTop, gTop, bTop, aTop).method_1344();
            buf.method_22918(m, x1, cy + height, z1).method_22915(rTop, gTop, bTop, aTop).method_1344();
            buf.method_22918(m, x1, cy, z1).method_22915(rBot, gBot, bBot, aBot).method_1344();
            buf.method_22918(m, x0, cy, z0).method_22915(rBot, gBot, bBot, aBot).method_1344();
            buf.method_22918(m, x1, cy + height, z1).method_22915(rTop, gTop, bTop, aTop).method_1344();
            buf.method_22918(m, x0, cy + height, z0).method_22915(rTop, gTop, bTop, aTop).method_1344();
            buf.method_22918(m, x0, cy, z0).method_22915(rBot, gBot, bBot, aBot).method_1344();
            buf.method_22918(m, x1, cy, z1).method_22915(rBot, gBot, bBot, aBot).method_1344();
        }
        tess.method_1350();
    },

drawVerticalSpark(m,cx,cy,cz,halfThick,height,r,g,b,alpha) {


        buf.method_1328(0, 0);
        buf.method_22918(m, cx + halfThick, cy + height, cz).method_22915(r, g, b, 0.0).method_1344();
        buf.method_22918(m, cx - halfThick, cy + height, cz).method_22915(r, g, b, 0.0).method_1344();
        buf.method_22918(m, cx - halfThick, cy, cz).method_22915(r, g, b, alpha).method_1344();
        buf.method_22918(m, cx + halfThick, cy, cz).method_22915(r, g, b, alpha).method_1344();
        buf.method_22918(m, cx, cy + height, cz + halfThick).method_22915(r, g, b, 0.0).method_1344();
        buf.method_22918(m, cx, cy + height, cz - halfThick).method_22915(r, g, b, 0.0).method_1344();
        buf.method_22918(m, cx, cy, cz - halfThick).method_22915(r, g, b, alpha).method_1344();
        buf.method_22918(m, cx, cy, cz + halfThick).method_22915(r, g, b, alpha).method_1344();
        tess.method_1350();
    },

drawWavyCylinderWall(m,cx,cy,cz,radius,maxHeight,segs,seed,rBot,gBot,bBot,aBot,rTop,gTop,bTop,aTop) {
        let i;


        buf.method_1328(0, 0);
        let heights = new Array(segs + 1).fill(0);
        let phase1 = R.hashL2(seed + 1) * 6.28;
        let phase2 = R.hashL2(seed + 2) * 6.28;
        for (i = 0; i <= segs; ++i) {
            let low = Math.sin(i * 0.35 + phase1) * 0.35 + 0.65;
            let mid = Math.sin(i * 0.85 + phase2) * 0.2;
            let hi = R.hashL2(seed + i * 31) * 0.25;
            heights[i] = Math.max(0.3, low + mid + hi) * maxHeight;
        }
        heights[segs] = heights[0];
        for (i = 0; i < segs; ++i) {
            let a0 = i * Math.PI * 2.0 / segs;
            let a1 = (i + 1) * Math.PI * 2.0 / segs;
            let x0 = cx + Math.cos(a0) * radius;
            let z0 = cz + Math.sin(a0) * radius;
            let x1 = cx + Math.cos(a1) * radius;
            let z1 = cz + Math.sin(a1) * radius;
            let h0 = heights[i];
            let h1 = heights[i + 1];
            buf.method_22918(m, x0, cy + h0, z0).method_22915(rTop, gTop, bTop, aTop).method_1344();
            buf.method_22918(m, x1, cy + h1, z1).method_22915(rTop, gTop, bTop, aTop).method_1344();
            buf.method_22918(m, x1, cy, z1).method_22915(rBot, gBot, bBot, aBot).method_1344();
            buf.method_22918(m, x0, cy, z0).method_22915(rBot, gBot, bBot, aBot).method_1344();
            buf.method_22918(m, x1, cy + h1, z1).method_22915(rTop, gTop, bTop, aTop).method_1344();
            buf.method_22918(m, x0, cy + h0, z0).method_22915(rTop, gTop, bTop, aTop).method_1344();
            buf.method_22918(m, x0, cy, z0).method_22915(rBot, gBot, bBot, aBot).method_1344();
            buf.method_22918(m, x1, cy, z1).method_22915(rBot, gBot, bBot, aBot).method_1344();
        }
        tess.method_1350();
    },

hashL2(x) {
        let v = Math.sin(x * 127.1) * 43758.5453;
        v -= Math.floor(v);
        return v;
    },

lerp(a,b,t) {
        return a + (b - a) * t;
    },

renderBolt(m,bolt,camPos) {
        let cx = bolt.x;
        let cy = bolt.y;
        let cz = bolt.z;
        let vLen = Math.sqrt(bolt.vx * bolt.vx + bolt.vy * bolt.vy + bolt.vz * bolt.vz);
        let dir = vLen > 0.001 ? new Vec((bolt.vx / vLen), (bolt.vy / vLen), (bolt.vz / vLen)) : new Vec(1.0, 0.0, 0.0);
        let worldUp = new Vec(0.0, 1.0, 0.0);
        if (Math.abs(dir.y) > 0.95) {
            worldUp.set(1.0, 0.0, 0.0);
        }
        let side = new Vec(dir).cross(worldUp).normalize();
        let peakUp = new Vec(side).cross(dir).normalize();
        R.renderTailRibbon(m, cx, cy, cz, dir, peakUp, camPos, bolt);
        R.renderHeadSphere(m, cx, cy, cz, dir, peakUp);
    },

renderCrackMark(m,c) {
        let cx = c.x;
        let cy = c.y + 0.02;
        let cz = c.z;
        let age = nowMs - c.spawnMs;
        let fade = age > 3500 ? Math.max(0.0, 1.0 - (age - 3500) / 500.0) : 1.0;
        let seed = c.spawnMs;


        buf.method_1328(0, 0);
        let crackCount = 8;
        for (let k = 0; k < crackCount; ++k) {
            let baseAng = (k * Math.PI * 2.0 / crackCount);
            let rSeed = R.hashL2(seed + k * 137);
            let ang = baseAng + (rSeed - 0.5) * 0.4;
            let rLen = R.hashL2(seed + k * 271);
            let len = 0.35 + rLen * 0.45;
            let segs = 4;
            let prevX = cx;
            let prevZ = cz;
            for (let i = 1; i <= segs; ++i) {
                let f = i / segs;
                let subLen = len * f;
                let jitter = (R.hashL2(seed + k * 41 + i * 13) - 0.5) * 0.15;
                let ix = cx + Math.cos(ang + jitter) * subLen;
                let iz = cz + Math.sin(ang + jitter) * subLen;
                let thick = 0.035 * (1.0 - f * 0.6);
                let dx = ix - prevX;
                let dz = iz - prevZ;
                let dLen = Math.sqrt(dx * dx + dz * dz);
                if (dLen < 0.001) {
                    dLen = 0.001;
                }
                let px = -dz / dLen * thick;
                let pz = dx / dLen * thick;
                buf.method_22918(m, ix + px, cy, iz + pz).method_22915(1.0, 0.92, 0.15, 0.85 * fade).method_1344();
                buf.method_22918(m, ix - px, cy, iz - pz).method_22915(1.0, 0.92, 0.15, 0.85 * fade).method_1344();
                buf.method_22918(m, prevX - px, cy, prevZ - pz).method_22915(1.0, 0.98, 0.35, 0.9 * fade).method_1344();
                buf.method_22918(m, prevX + px, cy, prevZ + pz).method_22915(1.0, 0.98, 0.35, 0.9 * fade).method_1344();
                prevX = ix;
                prevZ = iz;
            }
        }
        tess.method_1350();
    },

renderHeadSphere(m,cx,cy,cz,dir,peakUp) {
        R.drawUvSphere(m, cx, cy, cz, 0.465, 1.3, 1.0, 0.65, 0.08, 0.35);
        R.drawUvSphere(m, cx, cy, cz, 0.36, 1.3, 1.0, 0.78, 0.12, 0.6);
        R.drawUvSphere(m, cx, cy, cz, 0.3, 1.3, 1.0, 0.88, 0.2, 0.85);
        R.drawUvSphere(m, cx, cy, cz, 0.22500001, 1.3, 1.0, 0.95, 0.4, 0.95);
        R.drawUvSphere(m, cx, cy, cz, 0.15, 1.3, 1.0, 1.0, 0.65, 1.0);
        R.drawUvSphere(m, cx, cy, cz, 0.08400001, 1.3, 1.0, 1.0, 0.9, 1.0);
    },

renderPairExplosionPoint(m,dx,dy,dz,age) {
        let riseAge;
        let flashAge;
        let cx = dx;
        let cy = dy + 0.02;
        let cz = dz;
        if (age < 900) {
            let openT = Math.min(1.0, age / 100.0);
            let ringR = 3.5 * (0.15 + openT * 0.85);
            let alpha = 1.0;
            if (age > 700) {
                alpha *= Math.max(0.0, 1.0 - (age - 700) / 200.0);
            }
            R.drawFilledDisk(m, cx, cy + 0.001, cz, ringR, 0.35, 0.75, 1.0, 0.28 * alpha);
            let bandHalf = 0.4;
            R.drawGlowBand(m, cx, cy + 0.003, cz, ringR, bandHalf, 0.6, 0.92, 1.0, 0.9 * alpha, 0.2, 0.55, 1.0, 0.0);
            R.drawGlowBand(m, cx, cy + 0.0015, cz, ringR, bandHalf * 2.2, 0.3, 0.7, 1.0, 0.3 * alpha, 0.2, 0.55, 1.0, 0.0);
            let haloH = 2.2 * openT;
            R.drawVerticalHaloCylinder(m, cx, cy + 0.005, cz, ringR, haloH, 48, 0.35, 0.75, 1.0, 0.4 * alpha, 0.35, 0.75, 1.0, 0.0);
            R.drawVerticalHaloCylinder(m, cx, cy + 0.005, cz, ringR * 1.04, haloH * 0.7, 48, 0.3, 0.65, 1.0, 0.22 * alpha, 0.3, 0.65, 1.0, 0.0);
            R.drawVerticalHaloCylinder(m, cx, cy - 0.005, cz, ringR, -haloH, 48, 0.35, 0.75, 1.0, 0.4 * alpha, 0.35, 0.75, 1.0, 0.0);
            R.drawVerticalHaloCylinder(m, cx, cy - 0.005, cz, ringR * 1.04, -haloH * 0.7, 48, 0.3, 0.65, 1.0, 0.22 * alpha, 0.3, 0.65, 1.0, 0.0);
            R.drawWallStripes(m, cx, cy, cz, ringR, alpha, 3.5);
        }
        if (age >= 100 && age < 600) {
            let raw = (age - 100) / 500.0;
            let progress = 1.0 - (1.0 - raw) * (1.0 - raw);
            let yellowR = progress * 3.5;
            if (yellowR > 0.05) {
                let ringThick = Math.max(0.035, 0.0875);
                R.drawFlatRing(m, cx, cy + 0.007, cz, yellowR, ringThick, 1.0, 0.92, 0.15, 0.95);
                R.drawFlatRing(m, cx, cy + 0.009, cz, yellowR, ringThick * 0.4, 1.0, 1.0, 0.7, 1.0);
                R.drawGlowBand(m, cx, cy + 0.005, cz, yellowR, ringThick * 2.2, 1.0, 0.9, 0.25, 0.45, 1.0, 0.8, 0.1, 0.0);
            }
            if (raw > 0.7) {
                let ku = (raw - 0.7) / 0.3;
                R.drawGlowBand(m, cx, cy + 0.011, cz, yellowR, 3.5 * (0.05 + ku * 0.2), 1.0, 0.95, 0.3, 0.6 * ku, 1.0, 0.85, 0.1, 0.0);
            }
        }
        if ((flashAge = age - 690) >= 0 && flashAge < 140) {
            let it = flashAge / 140.0;
            let ia = 1.0 - it;
            let flashR = 3.5 * (0.8 + it * 1.4);
            R.drawGlowBand(m, cx, cy + 0.02, cz, flashR * 0.5, flashR, 1.0, 1.0, 1.0, 0.95 * ia, 1.0, 0.95, 0.6, 0.0);
            let waveR = 3.5 + it * 3.5;
            R.drawGlowBand(m, cx, cy + 0.017, cz, waveR, 0.55, 1.0, 0.95, 0.65, 0.85 * ia, 1.0, 0.75, 0.2, 0.0);
            R.drawGlowBand(m, cx, cy + 0.015, cz, waveR * 1.15, 0.35, 1.0, 1.0, 0.9, 0.55 * ia, 1.0, 0.85, 0.35, 0.0);
            R.drawVerticalHaloCylinder(m, cx, cy + 0.025, cz, 3.1499999, 3.5 * (0.4 + it * 0.6), 48, 1.0, 1.0, 0.95, 0.6 * ia, 1.0, 0.85, 0.3, 0.0);
            R.drawVerticalHaloCylinder(m, cx, cy - 0.025, cz, 3.1499999, -3.5 * (0.4 + it * 0.6), 48, 1.0, 1.0, 0.95, 0.6 * ia, 1.0, 0.85, 0.3, 0.0);
        }
        if (flashAge >= 0 && flashAge < 140) {
            let t = flashAge / 140.0;
            let seed = (cx * 1000.0) + (cz * 1000.0);
            let peak = t < 0.15 ? Math.sin((t / 0.15) * Math.PI * 0.5) : (t < 0.7 ? 1.0 : 1.0 - (t - 0.7) / 0.3);
            let alpha = t < 0.65 ? 1.0 : 1.0 - (t - 0.65) / 0.35;
            R.drawGlowBand(m, cx, cy + 0.008, cz, 1.4, 2.625, 1.0, 0.95, 0.2, 0.98 * alpha, 1.0, 0.85, 0.1, 0.0);
            R.drawGlowBand(m, cx, cy + 0.011, cz, 0.001, 1.5, 1.0, 1.0, 0.75, 0.98 * alpha, 1.0, 0.9, 0.15, 0.0);
            R.drawWavyCylinderWall(m, cx, cy + 0.005, cz, 3.5, 2.8 * peak, 128, seed, 1.0, 0.92, 0.12, alpha, 1.0, 1.0, 0.85, alpha * 0.9);
            R.drawWavyCylinderWall(m, cx, cy + 0.006, cz, 3.325, 2.5 * peak, 128, seed + 777, 1.0, 0.85, 0.1, alpha * 0.85, 1.0, 0.98, 0.65, alpha * 0.7);
            R.drawWavyCylinderWall(m, cx, cy - 0.005, cz, 3.5, -2.8 * peak, 128, seed, 1.0, 0.92, 0.12, alpha, 1.0, 1.0, 0.85, alpha * 0.9);
            R.drawWavyCylinderWall(m, cx, cy - 0.006, cz, 3.325, -2.5 * peak, 128, seed + 777, 1.0, 0.85, 0.1, alpha * 0.85, 1.0, 0.98, 0.65, alpha * 0.7);
            R.drawGlowBand(m, cx, cy + 0.01, cz, 3.5, 0.7, 1.0, 0.98, 0.55, alpha * 0.75, 1.0, 0.85, 0.1, 0.0);
            let cracks = 14;
            for (let k = 0; k < cracks; ++k) {
                let ang = k * (Math.PI * 2 / cracks) + R.hashL2(seed + k * 53) * 0.22;
                let len = 3.5 * (0.85 + R.hashL2(seed + k * 89) * 0.35);
                let prevX = cx;
                let prevZ = cz;
                let subs = 5;
                for (let i = 1; i <= subs; ++i) {
                    let f = i / subs;
                    let subLen = len * f;
                    let jit = (R.hashL2(seed + k * 41 + i * 13) - 0.5) * 0.24;
                    let ix = cx + Math.cos(ang + jit) * subLen;
                    let iz = cz + Math.sin(ang + jit) * subLen;
                    let thick = 0.048 * (1.0 - f * 0.5);
                    R.drawFlatLine(m, prevX, cy + 0.013, prevZ, ix, cy + 0.013, iz, thick, 0.45, 0.85, 1.0, alpha * 0.9);
                    prevX = ix;
                    prevZ = iz;
                }
            }
        }
        if ((riseAge = age - 690 - 140) >= 0 && riseAge < 100) {
            let t = riseAge / 100.0;
            let alpha = 1.0 - t;
            let seed = (cx * 2000.0) + (cz * 2000.0);
            let wispCount = 8;
            for (let k = 0; k < wispCount; ++k) {
                let ang = R.hashL2(seed + k * 41) * (Math.PI * 2);
                let rad = 3.5 * (0.4 + R.hashL2(seed + k * 61) * 0.9);
                let px = cx + Math.cos(ang) * rad;
                let pz = cz + Math.sin(ang) * rad;
                let py = cy + 0.3 + R.hashL2(seed + k * 83) * 1.2 + t * 0.6;
                let size = 0.4 + R.hashL2(seed + k * 101) * 0.35;
                R.drawFogPuff(m, px, py, pz, size, 0.98, 0.98, 0.98, alpha * 0.55);
            }
            let rays = 14;
            for (let k = 0; k < rays; ++k) {
                let rAng = R.hashL2(seed + k * 191) * (Math.PI * 2);
                let rRad = 3.5 * (0.3 + R.hashL2(seed + k * 211) * 0.8);
                let rHeight = 1.5 + R.hashL2(seed + k * 233) * 2.0;
                let sx = cx + Math.cos(rAng) * rRad;
                let sz = cz + Math.sin(rAng) * rRad;
                let rY = cy + 1.0 + t * rHeight;
                let thick = 0.06 * (1.0 - t * 0.5);
                R.drawVerticalSpark(m, sx, rY, sz, thick, 0.6, 0.35, 0.8, 1.0, alpha * 0.85);
            }
        }
    },

renderTailRibbon(m,cx,cy,cz,dir,peakUp,camPos,bolt) {
        let ms = nowMs;
        let t = ms / 60.0;
        let xs = new Array(101).fill(0);
        let ys = new Array(101).fill(0);
        let zs = new Array(101).fill(0);
        let frameStep = ms / 25;
        let peakVertCount = 7;
        let peakF = new Array(peakVertCount).fill(0);
        let peakOffset = new Array(peakVertCount).fill(0);
        peakF[0] = 0.0;
        peakOffset[0] = 0.0;
        for (let p = 0; p < 5; ++p) {
            peakF[p + 1] = (p + 0.5) / 5.0;
            let rSign = R.hashL2(bolt.id * 1000 + p * 137 + frameStep);
            let sign = rSign < 0.5 ? -1.0 : 1.0;
            let rAmp = R.hashL2(bolt.id * 2000 + p * 271 + frameStep);
            let ampMul = 0.7 + rAmp * 0.5;
            let peakScale = Math.max(0.4, 1.0 - p * 0.15);
            peakOffset[p + 1] = 0.55 * sign * ampMul * peakScale;
        }
        peakF[peakVertCount - 1] = 1.0;
        peakOffset[peakVertCount - 1] = 0.0;
        for (let i = 0; i <= 100; ++i) {
            let f = i / 100.0;
            let segIdx = 0;
            for (let p = 0; p < peakVertCount - 1; ++p) {
                if (!(f >= peakF[p]) || !(f <= peakF[p + 1])) continue;
                segIdx = p;
                break;
            }
            let t01 = (f - peakF[segIdx]) / Math.max(1.0E-4, peakF[segIdx + 1] - peakF[segIdx]);
            let offset = R.lerp(peakOffset[segIdx], peakOffset[segIdx + 1], t01);
            let baseX = cx - dir.x * (2.4 * f);
            let baseY = cy - dir.y * (2.4 * f);
            let baseZ = cz - dir.z * (2.4 * f);
            xs[i] = baseX + peakUp.x * offset;
            ys[i] = baseY + peakUp.y * offset;
            zs[i] = baseZ + peakUp.z * offset;
        }
        R.drawRibbonPass(m, xs, ys, zs, camPos, 0.18, 0.55, true);
        R.drawRibbonPass(m, xs, ys, zs, camPos, 0.09, 0.85, false);
        R.drawRibbonPass(m, xs, ys, zs, camPos, 0.04, 1.0, false);
    },

ribbonColor(f,outer) {
        let b;
        let g;
        let r;
        if (f < 0.15) {
            let u = f / 0.15;
            r = R.lerp(1.0, 1.0, u);
            g = R.lerp(1.0, 0.9, u);
            b = R.lerp(0.75, 0.2, u);
        } else if (f < 0.35) {
            let u = (f - 0.15) / 0.2;
            r = R.lerp(1.0, 0.55, u);
            g = R.lerp(0.9, 0.95, u);
            b = R.lerp(0.2, 0.55, u);
        } else if (f < 0.55) {
            let u = (f - 0.35) / 0.2;
            r = R.lerp(0.55, 0.25, u);
            g = R.lerp(0.95, 0.9, u);
            b = R.lerp(0.55, 0.95, u);
        } else if (f < 0.8) {
            let u = (f - 0.55) / 0.25;
            r = R.lerp(0.25, 0.15, u);
            g = R.lerp(0.9, 0.45, u);
            b = R.lerp(0.95, 1.0, u);
        } else {
            let u = (f - 0.8) / 0.2;
            r = R.lerp(0.15, 0.05, u);
            g = R.lerp(0.45, 0.18, u);
            b = R.lerp(1.0, 0.85, u);
        }
        let a = outer ? R.lerp(0.9, 0.35, f) : R.lerp(1.0, 0.7, f);
        return [r, g, b, a];
    },

drawWallStripes(m,...args){const extra=wallStripes(...args);if(extra)batches.push(...extra);},
};

const O = {

drawLaneSparks(m,orb,floorY) {
        let perpX = -orb.dirZ;
        let perpZ = orb.dirX;
        let sideOff = 1.2;
        let dux = orb.curX - orb.startX;
        let duz = orb.curZ - orb.startZ;
        let laneLen = Math.sqrt(dux * dux + duz * duz);
        if (laneLen < 0.5) {
            return;
        }
        let sparkCount = Math.trunc(laneLen / 0.8);
        if (sparkCount < 1) {
            return;
        }
        let frameStep = Math.floor(nowMs / 500);


        state.opaque=false;

        for (let side = -1; side <= 1; side += 2) {
            for (let i = 0; i < sparkCount; ++i) {
                let seed = orb.id * 10000 + i * 137 + side * 71 + frameStep;
                let rSkip = O.hashL(seed * 3);
                if (rSkip < 0.35) continue;
                let f = (i + 0.5) / sparkCount;
                let baseX = orb.startX + dux * f;
                let baseZ = orb.startZ + duz * f;
                let offX = perpX * sideOff * side;
                let offZ = perpZ * sideOff * side;
                let cx = (baseX + offX);
                let cz = (baseZ + offZ);
                let texIdx = Math.trunc(O.hashL(seed * 5) * 4.0);
                if (texIdx >= 4) {
                    texIdx = 3;
                }
                let size = 0.2 + O.hashL(seed * 7) * 0.2;
                let rot = O.hashL(seed * 11) * (Math.PI * 2);
                state.texture=texIdx;


                buf.method_1328(0, 0);
                let cos = Math.cos(rot);
                let sin = Math.sin(rot);
                let hs = size * 0.5;
                let corners = [[-hs, -hs, 0.0, 0.0], [hs, -hs, 1.0, 0.0], [hs, hs, 1.0, 1.0], [-hs, hs, 0.0, 1.0]];
                for (let j = 0; j < 4; ++j) {
                    let lx = corners[j][0];
                    let lz = corners[j][1];
                    let wx = cx + lx * cos - lz * sin;
                    let wz = cz + lx * sin + lz * cos;
                    buf.method_22918(m, wx, floorY + 0.01, wz).method_22913(corners[j][2], corners[j][3]).method_22915(1.0, 1.0, 1.0, 0.95).method_1344();
                }
                tess.method_1350();
            }
        }
        state.texture=null;

    },

drawOrbSparks(m,orb,cx,cy,cz) {
        let frameStep = Math.floor(nowMs / 200);
        let sparkCount = 6;


        state.opaque=false;

        for (let i = 0; i < sparkCount; ++i) {
            let seed = orb.id * 1000 + i * 41 + frameStep;
            let rSkip = O.hashL(seed * 3);
            if (rSkip < 0.55) continue;
            let rTheta = O.hashL(seed * 5) * (Math.PI * 2);
            let rPhi = (O.hashL(seed * 7) - 0.5) * Math.PI;
            let rDist = 0.6 + O.hashL(seed * 11) * 0.5;
            let sx = cx + Math.cos(rTheta) * Math.cos(rPhi) * rDist;
            let sy = cy + Math.sin(rPhi) * rDist;
            let sz = cz + Math.sin(rTheta) * Math.cos(rPhi) * rDist;
            let texIdx = Math.trunc(O.hashL(seed * 13) * 4.0);
            if (texIdx >= 4) {
                texIdx = 3;
            }
            let size = 0.25 + O.hashL(seed * 17) * 0.2;
            let rot = O.hashL(seed * 19) * (Math.PI * 2);
            state.texture=texIdx;


            buf.method_1328(0, 0);
            let cos = Math.cos(rot);
            let sin = Math.sin(rot);
            let hs = size * 0.5;
            let corners = [[-hs, -hs, 0.0, 0.0], [hs, -hs, 1.0, 0.0], [hs, hs, 1.0, 1.0], [-hs, hs, 0.0, 1.0]];
            for (let j = 0; j < 4; ++j) {
                let lx = corners[j][0];
                let ly = corners[j][1];
                let rx = lx * cos - ly * sin;
                let ry = lx * sin + ly * cos;
                buf.method_22918(m, sx + rx, sy + ry, sz).method_22913(corners[j][2], corners[j][3]).method_22915(1.0, 1.0, 1.0, 0.95).method_1344();
            }
            tess.method_1350();
        }
        state.texture=null;

    },

drawOrbSphere(m,orb) {
        let ey1;
        let ex1;
        let ey0;
        let ex0;
        let a1;
        let a0;
        let i;
        let cx = orb.curX;
        let cy = (orb.startY + 5.0);
        let cz = orb.curZ;
        let size = 0.18;
        O.drawOrbSparks(m, orb, cx, cy, cz);


        buf.method_1328(0, 0);
        let segs = 16;
        for (i = 0; i < segs; ++i) {
            a0 = i * Math.PI * 2.0 / segs;
            a1 = (i + 1) * Math.PI * 2.0 / segs;
            ex0 = cx + Math.cos(a0) * size * 1.5;
            ey0 = cy + Math.sin(a0) * size * 1.5;
            ex1 = cx + Math.cos(a1) * size * 1.5;
            ey1 = cy + Math.sin(a1) * size * 1.5;
            buf.method_22918(m, ex1, ey1, cz).method_22915(1.0, 0.85, 0.2, 0.0).method_1344();
            buf.method_22918(m, ex0, ey0, cz).method_22915(1.0, 0.85, 0.2, 0.0).method_1344();
            buf.method_22918(m, cx, cy, cz).method_22915(1.0, 0.95, 0.4, 0.55).method_1344();
            buf.method_22918(m, cx, cy, cz).method_22915(1.0, 0.95, 0.4, 0.55).method_1344();
        }
        for (i = 0; i < segs; ++i) {
            a0 = i * Math.PI * 2.0 / segs;
            a1 = (i + 1) * Math.PI * 2.0 / segs;
            ex0 = cx + Math.cos(a0) * size;
            ey0 = cy + Math.sin(a0) * size;
            ex1 = cx + Math.cos(a1) * size;
            ey1 = cy + Math.sin(a1) * size;
            buf.method_22918(m, ex1, ey1, cz).method_22915(1.0, 0.95, 0.55, 0.2).method_1344();
            buf.method_22918(m, ex0, ey0, cz).method_22915(1.0, 0.95, 0.55, 0.2).method_1344();
            buf.method_22918(m, cx, cy, cz).method_22915(1.0, 1.0, 0.85, 1.0).method_1344();
            buf.method_22918(m, cx, cy, cz).method_22915(1.0, 1.0, 0.85, 1.0).method_1344();
        }
        tess.method_1350();
    },

drawPreviewLanes(m,orb) {
        let perpX = -orb.dirZ;
        let perpZ = orb.dirX;
        let sideOff = 1.2;
        let dux = orb.curX - orb.startX;
        let duz = orb.curZ - orb.startZ;
        let laneLen = Math.sqrt(dux * dux + duz * duz);
        if (laneLen < 0.05) {
            return;
        }
        let segs = Math.max(3, Math.trunc(laneLen / 0.4));
        let world=null;
        let t = nowMs / 1000.0;


        buf.method_1328(0, 0);
        for (let side = -1; side <= 1; side += 2) {
            let i;
            let xs = new Array(segs + 1).fill(0);
            let zs = new Array(segs + 1).fill(0);
            let ys = new Array(segs + 1).fill(0);
            for (i = 0; i <= segs; ++i) {
                let f = i / segs;
                let baseX = orb.startX + dux * f;
                let baseZ = orb.startZ + duz * f;
                let offX = perpX * sideOff * side;
                let offZ = perpZ * sideOff * side;
                let jitter = Math.sin(f * Math.PI * 18.0 + t * 3.0 + side * 1.3) * 0.025;
                let px = (baseX + offX + perpX * (jitter += Math.sin(f * Math.PI * 34.0 + t * 5.0 + side * 0.7) * 0.012));
                let pz = (baseZ + offZ + perpZ * jitter);
                xs[i] = px;
                zs[i] = pz;
                ys[i] = (O.sampleGroundY(world, px, pz, orb.startY) + 0.03);
            }
            for (i = 0; i < segs; ++i) {
                let dx = xs[i + 1] - xs[i];
                let dz = zs[i + 1] - zs[i];
                let len = Math.sqrt(dx * dx + dz * dz);
                if (len < 0.001) continue;
                let pxN = -dz / len;
                let pzN = dx / len;
                let y0 = ys[i];
                let y1 = ys[i + 1];
                let thickH = 0.04;
                let phx = pxN * thickH;
                let phz = pzN * thickH;
                buf.method_22918(m, xs[i + 1] + phx, y1, zs[i + 1] + phz).method_22915(0.3, 0.65, 1.0, 0.55).method_1344();
                buf.method_22918(m, xs[i + 1] - phx, y1, zs[i + 1] - phz).method_22915(0.3, 0.65, 1.0, 0.55).method_1344();
                buf.method_22918(m, xs[i] - phx, y0, zs[i] - phz).method_22915(0.3, 0.65, 1.0, 0.55).method_1344();
                buf.method_22918(m, xs[i] + phx, y0, zs[i] + phz).method_22915(0.3, 0.65, 1.0, 0.55).method_1344();
                let thickC = 0.014;
                let pcx = pxN * thickC;
                let pcz = pzN * thickC;
                buf.method_22918(m, xs[i + 1] + pcx, y1 + 0.001, zs[i + 1] + pcz).method_22915(0.8, 0.98, 1.0, 0.95).method_1344();
                buf.method_22918(m, xs[i + 1] - pcx, y1 + 0.001, zs[i + 1] - pcz).method_22915(0.8, 0.98, 1.0, 0.95).method_1344();
                buf.method_22918(m, xs[i] - pcx, y0 + 0.001, zs[i] - pcz).method_22915(0.8, 0.98, 1.0, 0.95).method_1344();
                buf.method_22918(m, xs[i] + pcx, y0 + 0.001, zs[i] + pcz).method_22915(0.8, 0.98, 1.0, 0.95).method_1344();
            }
        }
        tess.method_1350();
        O.drawLaneSparks(m, orb, (orb.startY + 0.03));
    },

hashL(x) {
        let v = Math.sin(x * 127.1) * 43758.5453;
        v -= Math.floor(v);
        return v;
    },

sampleGroundY(world,x,z,y){return groundProbe(x,z,y);},
};
const api={
 lane(w,age,t=age){begin(age*1000);F.renderSingleWall(null,{...w,spawnMs:0},t,age<.4?age/.4:age>3.4?Math.max(0,(4-age)/.6):1);return batches;},
 bolt(b,time,cam){begin(time*1000);R.renderBolt(null,b,new Vec(cam));return batches;},
 shock(p,age,probe){begin(age*1000,probe);R.renderCrackMark(null,{...p,spawnMs:0});R.renderPairExplosionPoint(null,p.x,p.y,p.z,age*1000);return batches;},
 preview(o,age,ground){begin(age*1000);groundProbe=ground||((x,z,y)=>y);O.drawPreviewLanes(null,o);O.drawOrbSphere(null,o);return batches.map(b=>({...b,additive:true}));},
 color:F.mainBodyColor, silhouette:F.topSilhouette, ribbon:R.ribbonColor,
};
if(typeof module==='object'&&module.exports)module.exports=api;else root.NEON_FX_SOURCE=api;
})(typeof window==='object'?window:globalThis);
