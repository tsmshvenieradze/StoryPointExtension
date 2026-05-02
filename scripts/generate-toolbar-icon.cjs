// scripts/generate-toolbar-icon.cjs
// Generates images/toolbar-icon.png (16x16 RGBA) with a small calculator glyph.
// Marketplace rejects SVG icons; this script emits raw PNG bytes via the same
// CRC32 + chunk construction used by scripts/generate-placeholder-icon.cjs.
//
// Run via: node scripts/generate-toolbar-icon.cjs

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const W = 16;
const H = 16;

// 16x16 pixel map: '#' = opaque calculator pixel, '.' = transparent.
// Calculator outline + display strip + 3x3 button grid.
const PIXELS = [
  '................', //  0
  '..############..', //  1  top border
  '.#............#.', //  2
  '.#.##########.#.', //  3  display top
  '.#.#........#.#.', //  4  display
  '.#.##########.#.', //  5  display bottom
  '.#............#.', //  6
  '.#.##.##.##.#.#.', //  7  buttons row 1
  '.#............#.', //  8
  '.#.##.##.##.#.#.', //  9  buttons row 2
  '.#............#.', // 10
  '.#.##.##.##.#.#.', // 11  buttons row 3
  '.#............#.', // 12
  '.#............#.', // 13
  '..############..', // 14  bottom border
  '................', // 15
];

// Dark gray — visible on both light and dark ADO themes.
// Phase 5 may replace with a branded SVG-converted-to-PNG.
const ICON_R = 0x33;
const ICON_G = 0x33;
const ICON_B = 0x33;

function buildRgbaScanlines() {
  // PNG scanline format: each row prefixed by a 1-byte filter (0 = None).
  const stride = 1 + W * 4;
  const buf = Buffer.alloc(stride * H);
  for (let y = 0; y < H; y++) {
    const row = PIXELS[y];
    if (row.length !== W) {
      throw new Error(`Row ${y} has length ${row.length}, expected ${W}`);
    }
    const off = y * stride;
    buf[off] = 0;
    for (let x = 0; x < W; x++) {
      const px = off + 1 + x * 4;
      if (row[x] === '#') {
        buf[px] = ICON_R;
        buf[px + 1] = ICON_G;
        buf[px + 2] = ICON_B;
        buf[px + 3] = 0xff;
      } else {
        buf[px] = 0;
        buf[px + 1] = 0;
        buf[px + 2] = 0;
        buf[px + 3] = 0;
      }
    }
  }
  return buf;
}

const CRC_TABLE = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  CRC_TABLE[n] = c;
}

function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}

function buildPng() {
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(W, 0);
  ihdr.writeUInt32BE(H, 4);
  ihdr[8] = 8;   // bit depth
  ihdr[9] = 6;   // color type RGBA
  ihdr[10] = 0;  // compression
  ihdr[11] = 0;  // filter
  ihdr[12] = 0;  // interlace
  const idat = zlib.deflateSync(buildRgbaScanlines());
  return Buffer.concat([
    sig,
    chunk('IHDR', ihdr),
    chunk('IDAT', idat),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const out = path.join(__dirname, '..', 'images', 'toolbar-icon.png');
fs.writeFileSync(out, buildPng());
console.log(`Generated ${out} (${W}x${H} RGBA, ${fs.statSync(out).size} bytes)`);
