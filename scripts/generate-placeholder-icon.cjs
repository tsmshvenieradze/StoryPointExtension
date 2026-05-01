// scripts/generate-placeholder-icon.cjs
// Generates a 128x128 transparent PNG without external image tools.
// Uses Node's built-in zlib + a hand-rolled minimal PNG writer (no deps).

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const W = 128, H = 128;

function crc32(buf) {
  let c, table = [];
  for (let n = 0; n < 256; n++) {
    c = n;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    table[n] = c >>> 0;
  }
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) crc = (table[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8)) >>> 0;
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crc]);
}

const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(W, 0);     // width
ihdr.writeUInt32BE(H, 4);     // height
ihdr[8] = 8;                  // bit depth
ihdr[9] = 6;                  // RGBA
ihdr[10] = 0;                 // compression
ihdr[11] = 0;                 // filter
ihdr[12] = 0;                 // interlace

// Each row: 1 filter byte (0 = None) + W*4 bytes of RGBA (all zero = transparent)
const row = Buffer.alloc(1 + W * 4); // already zero-filled
const raw = Buffer.alloc(H * row.length);
for (let y = 0; y < H; y++) row.copy(raw, y * row.length);

const idatData = zlib.deflateSync(raw);

const png = Buffer.concat([
  sig,
  chunk('IHDR', ihdr),
  chunk('IDAT', idatData),
  chunk('IEND', Buffer.alloc(0)),
]);

const outDir = path.resolve(__dirname, '..', 'images');
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, 'icon.png'), png);
console.log('wrote images/icon.png (' + png.length + ' bytes)');
