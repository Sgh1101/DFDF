// Legacy Alpha schematic reader. Tile entities are parsed as data, never executed.
const zlib = require('node:zlib');
const MAX_CELLS = 32 * 1024 * 1024;
function readSchematic(input) {
  const b = zlib.gunzipSync(input, { maxOutputLength: 96 * 1024 * 1024 });
  let p = 0, tags = 0;
  const take = n => { if (!Number.isSafeInteger(n) || n < 0 || p + n > b.length) throw Error('Truncated NBT'); const s = p; p += n; return s; };
  const byte = () => b.readUInt8(take(1));
  const int = () => b.readInt32BE(take(4));
  const str = () => { const n = b.readUInt16BE(take(2)); return b.toString('utf8', take(n), p); };
  function value(t, depth = 0) {
    if (++tags > 2000000 || depth > 32) throw Error('NBT limit');
    switch (t) {
      case 1: return b.readInt8(take(1));
      case 2: return b.readInt16BE(take(2));
      case 3: return int();
      case 4: return b.readBigInt64BE(take(8));
      case 5: return b.readFloatBE(take(4));
      case 6: return b.readDoubleBE(take(8));
      case 7: { const n = int(); const s = take(n); return b.subarray(s, s+n); }
      case 8: return str();
      case 9: { const type = byte(), n = int(); if (n < 0 || n > 1000000 || (!type && n)) throw Error('Invalid NBT list'); return Array.from({ length:n }, () => value(type, depth+1)); }
      case 10: { const o = Object.create(null); for (;;) { const type = byte(); if (!type) return o; const name = str(); o[name] = value(type, depth+1); } }
      case 11: case 12: { const n = int(); const s = take(n * (t === 11 ? 4 : 8)); return b.subarray(s,p); }
      default: throw Error('Unsupported NBT tag ' + t);
    }
  }
  if (byte() !== 10 || str() !== 'Schematic') throw Error('Expected Schematic root');
  const root = value(10);
  const dims = [root.Width, root.Height, root.Length];
  if (dims.some(n => !Number.isInteger(n) || n < 1 || n > 1024)) throw Error('Invalid dimensions');
  const n = dims.reduce((a,c) => a*c,1);
  if (n > MAX_CELLS || root.Materials !== 'Alpha' || root.Blocks?.length !== n || root.Data?.length !== n || (root.AddBlocks && root.AddBlocks.length !== Math.ceil(n/2))) throw Error('Invalid Alpha block arrays');
  const ids = new Uint16Array(n);
  for (let i=0;i<n;i++) ids[i] = root.Blocks[i] | (root.AddBlocks ? ((root.AddBlocks[i>>1] >> ((i&1)*4)) & 15) << 8 : 0);
  return { width:dims[0], height:dims[1], length:dims[2], ids, data:root.Data };
}

const AIR = new Set([0,36,90,119,217]);
const PLANTS = new Set([6,30,31,32,37,38,39,40,50,51,55,59,63,65,68,69,70,72,75,76,77,83,104,105,106,111,115,127,131,132,140,141,142,143,175,176,177,198]);
const STAIRS = new Set([53,67,108,109,114,128,134,135,136,156,163,164,180,203]);
const SLABS = new Set([44,126,182,205]);
const DOORS = new Set([64,71,193,194,195,196,197]);
const FENCES = new Set([85,113,188,189,190,191,192]);
const PANES = new Set([101,102,160]);
const CUBE = [0,0,0,16,16,16];
function blockShape(id, data, neighbor = () => 0, lowerData = 0) {
  if (AIR.has(id)) return { boxes:[], solid:false, kind:'empty' };
  if (STAIRS.has(id)) {
    const upside = !!(data&4), base = [0,upside?8:0,0,16,upside?16:8,16];
    const step = [0,upside?0:8,0,16,upside?8:16,16];
    if ((data&3) === 0) step[0]=8;
    if ((data&3) === 1) step[3]=8;
    if ((data&3) === 2) step[2]=8;
    if ((data&3) === 3) step[5]=8;
    return { boxes:[base,step], solid:true, kind:'stairs' };
  }
  if (SLABS.has(id)) return { boxes:[[0,data&8?8:0,0,16,data&8?16:8,16]], solid:true, kind:'slab' };
  if (id === 78) return { boxes:[[0,0,0,16,((data&7)+1)*2,16]], solid:true, kind:'snow' };
  if (id === 171) return { boxes:[[0,0,0,16,1,16]], solid:true, kind:'carpet' };
  if (id === 96 || id === 167) {
    const box = data&4 ? [[0,0,0,16,16,3],[0,0,13,16,16,16],[13,0,0,16,16,16],[0,0,0,3,16,16]][data&3] : [0,data&8?13:0,0,16,data&8?16:3,16];
    return { boxes:[box], solid:true, kind:'trapdoor' };
  }
  if (DOORS.has(id)) {
    const d = data&8 ? lowerData : data;
    // Static door leaf; interactive/redstone state is not imported.
    const rot = ((d&3) + ((d&4)?1:0)) & 3;
    return { boxes:[[[0,0,0,3,16,16],[0,0,0,16,16,3],[13,0,0,16,16,16],[0,0,13,16,16,16]][rot]], solid:true, kind:'door' };
  }
  if (PANES.has(id) || FENCES.has(id) || id===139) {
    const thick = PANES.has(id)?2:id===139?8:4, lo=8-thick/2, hi=8+thick/2;
    const boxes = [[lo,0,lo,hi,16,hi]];
    for (const [dx,dz,dir] of [[-1,0,0],[1,0,1],[0,-1,2],[0,1,3]]) if (neighbor(dx,dz)) boxes.push(dir===0?[0,0,lo,lo,16,hi]:dir===1?[hi,0,lo,16,16,hi]:dir===2?[lo,0,0,hi,16,lo]:[lo,0,hi,hi,16,16]);
    return { boxes, solid:true, kind:'rail' };
  }
  if (PLANTS.has(id)) return { boxes:[[5,0,5,11,id===31||id===175?13:7,11]], solid:false, kind:'decoration' };
  if ([8,9,10,11].includes(id)) return { boxes:[[0,0,0,16,14,16]], solid:false, kind:'liquid' };
  if (id===60) return { boxes:[[0,0,0,16,15,16]], solid:true, kind:'farmland' };
  if (id===88) return { boxes:[[0,0,0,16,14,16]], solid:true, kind:'soul-sand' };
  if ([54,130,146].includes(id)) return { boxes:[[1,0,1,15,14,15]], solid:true, kind:'chest' };
  if ([92,116,117,118,120,145,151,154,178].includes(id)) return { boxes:[[1,0,1,15,id===151||id===178?6:12,15]], solid:true, kind:'prop' };
  return { boxes:[CUBE], solid:true, kind:'cube' };
}
const DYE = [0xe3dfd5,0xc86e31,0xa75aac,0x6d9bbe,0xd8bc46,0x759c42,0xc67a96,0x4a4b50,0x999992,0x448b95,0x7955a1,0x414e85,0x77563a,0x56723c,0x9b4034,0x292b31];
function blockColor(id,d) {
  if ([35,95,159,160,171,251,252].includes(id)) return DYE[d&15];
  if (id===1) return [0x8d8a83,0xa38678,0xb9aaa4,0xb0afa1,0xd0cdbd,0x737d79,0x9ba29b][Math.min(d&7,6)];
  if ([2,18,31,106,161,175].includes(id)) return 0x67834f;
  if (id===3 || id===60) return 0x897058;
  if ([5,17,53,85,125,126,134,135,136,162,163,164].includes(id)) return [0xb49a6c,0x8a6848,0xd2c39a,0x9a7862,0xb27b51,0x5c463b][d&3];
  if ([45,108].includes(id)) return 0xa86550;
  if ([98,109,43,44,67,4,139].includes(id)) return 0x92958c;
  if ([155,156].includes(id)) return 0xe3dfcc;
  if ([172,179,181,182,180].includes(id)) return 0xba7558;
  if ([12,24,128].includes(id)) return 0xd6c394;
  if (id===133) return 0x57a481;
  if ([173,49].includes(id)) return 0x363b40;
  if ([112,113,114].includes(id)) return 0x613c3c;
  if ([206,203,205].includes(id)) return 0x977e9d;
  if (id===216) return 0xd8d3ba;
  if ([71,101,167].includes(id)) return 0x8c9390;
  if ([20,102].includes(id)) return 0xa6d1d3;
  if ([8,9].includes(id)) return 0x518ba7;
  if ([10,11,50,51,89,124,169].includes(id)) return 0xdab36a;
  if ([78,80].includes(id)) return 0xe9ece8;
  return 0x9a9181;
}
module.exports = { readSchematic, blockShape, blockColor, STAIRS, SLABS };
