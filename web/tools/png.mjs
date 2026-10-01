// A dependency-free 8-bit PNG reader and writer, enough for the atlas and the HUD's kit sprites.
import zlib from 'node:zlib';
import fs from 'node:fs';

export function decodePng(file) {
  const b = fs.readFileSync(file);
  let p = 8, w, h, ct;
  const idat = [];
  while (p < b.length) {
    const len = b.readUInt32BE(p), type = b.toString('ascii', p + 4, p + 8);
    if (type === 'IHDR') { w = b.readUInt32BE(p + 8); h = b.readUInt32BE(p + 12); ct = b[p + 17]; if (b[p + 16] !== 8 || b[p + 18] || b[p + 20]) throw new Error('unsupported PNG ' + file); }
    if (type === 'IDAT') idat.push(b.subarray(p + 8, p + 8 + len));
    p += 12 + len;
  }
  const bpp = { 6: 4, 2: 3, 0: 1, 4: 2 }[ct];
  if (!bpp) throw new Error('unsupported PNG colour type ' + ct);
  const raw = zlib.inflateSync(Buffer.concat(idat)), stride = w * bpp, px = Buffer.alloc(h * stride);
  for (let y = 0; y < h; y++) {
    const f = raw[y * (stride + 1)];
    for (let x = 0; x < stride; x++) {
      const r = raw[y * (stride + 1) + 1 + x], a = x >= bpp ? px[y * stride + x - bpp] : 0, u = y ? px[(y - 1) * stride + x] : 0, c = x >= bpp && y ? px[(y - 1) * stride + x - bpp] : 0;
      let v = r;
      if (f === 1) v = r + a; else if (f === 2) v = r + u; else if (f === 3) v = r + ((a + u) >> 1);
      else if (f === 4) { const q = a + u - c, pa = Math.abs(q - a), pb = Math.abs(q - u), pc = Math.abs(q - c); v = r + (pa <= pb && pa <= pc ? a : pb <= pc ? u : c); }
      px[y * stride + x] = v & 255;
    }
  }
  const data = Buffer.alloc(w * h * 4);
  for (let i = 0; i < w * h; i++) {
    const o = i * bpp;
    data.set(ct === 6 ? px.subarray(o, o + 4) : ct === 2 ? [px[o], px[o + 1], px[o + 2], 255] : [px[o], px[o], px[o], ct === 4 ? px[o + 1] : 255], i * 4);
  }
  return { w, h, data };
}

const crcTable = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
const crc = buf => { let c = ~0; for (const x of buf) c = crcTable[(c ^ x) & 255] ^ (c >>> 8); return ~c >>> 0; };
const chunk = (type, data) => { const b = Buffer.alloc(12 + data.length); b.writeUInt32BE(data.length, 0); b.write(type, 4, 'ascii'); data.copy(b, 8); b.writeUInt32BE(crc(b.subarray(4, 8 + data.length)), 8 + data.length); return b; };

export function encodePng({ w, h, data }, file) {
  const head = Buffer.alloc(13);
  head.writeUInt32BE(w, 0); head.writeUInt32BE(h, 4); head[8] = 8; head[9] = 6;
  const raw = Buffer.alloc(h * (w * 4 + 1));
  for (let y = 0; y < h; y++) data.copy(raw, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4);
  fs.writeFileSync(file, Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', head), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]));
}
