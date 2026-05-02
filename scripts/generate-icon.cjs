// scripts/generate-icon.cjs
// Generates the Marketplace listing icon (128×128 PNG) — calculator silhouette.
// Pure Node + zlib; no external deps. Writes images/icon.png.

const fs = require("fs");
const path = require("path");
const zlib = require("zlib");

const W = 128, H = 128;

// Color palette — Azure-DevOps-flavored blue.
const BG = [33, 120, 213, 255];        // Calculator body — #2178D5
const SCREEN = [232, 244, 252, 255];   // Display — soft light blue
const BUTTON = [255, 255, 255, 255];   // Buttons — white
const BUTTON_ACCENT = [255, 196, 67, 255]; // Apply key — amber

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
  const typeBuf = Buffer.from(type, "ascii");
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crc]);
}

// Build the 128×128 RGBA canvas as a flat byte array.
const pixels = new Uint8Array(W * H * 4);

function setPixel(x, y, [r, g, b, a]) {
  if (x < 0 || y < 0 || x >= W || y >= H) return;
  const i = (y * W + x) * 4;
  pixels[i] = r; pixels[i + 1] = g; pixels[i + 2] = b; pixels[i + 3] = a;
}

function fillRect(x, y, w, h, color) {
  for (let dy = 0; dy < h; dy++) {
    for (let dx = 0; dx < w; dx++) {
      setPixel(x + dx, y + dy, color);
    }
  }
}

// Rounded-corner rectangle (4-px corner radius for crispness at this size).
function fillRoundedRect(x, y, w, h, color, r = 6) {
  for (let dy = 0; dy < h; dy++) {
    for (let dx = 0; dx < w; dx++) {
      const px = x + dx, py = y + dy;
      // Determine if we're inside the corner cut zones.
      let inside = true;
      if (dx < r && dy < r) inside = (r - dx) ** 2 + (r - dy) ** 2 < r * r;
      else if (dx >= w - r && dy < r) inside = (dx - (w - r - 1)) ** 2 + (r - dy) ** 2 < r * r;
      else if (dx < r && dy >= h - r) inside = (r - dx) ** 2 + (dy - (h - r - 1)) ** 2 < r * r;
      else if (dx >= w - r && dy >= h - r) inside = (dx - (w - r - 1)) ** 2 + (dy - (h - r - 1)) ** 2 < r * r;
      if (inside) setPixel(px, py, color);
    }
  }
}

// 1. Calculator body — full canvas, blue, rounded.
fillRoundedRect(0, 0, W, H, BG, 12);

// 2. Display screen — top portion (~25% of height).
const SCREEN_X = 16, SCREEN_Y = 16, SCREEN_W = W - 32, SCREEN_H = 32;
fillRoundedRect(SCREEN_X, SCREEN_Y, SCREEN_W, SCREEN_H, SCREEN, 4);

// 3. Button grid — 4 cols × 3 rows below the screen.
const GRID_TOP = SCREEN_Y + SCREEN_H + 8;     // y = 56
const GRID_LEFT = 16;
const GRID_RIGHT = W - 16;
const GRID_BOTTOM = H - 16;
const COLS = 4, ROWS = 3;
const GAP = 4;
const KEY_W = Math.floor((GRID_RIGHT - GRID_LEFT - (COLS - 1) * GAP) / COLS);
const KEY_H = Math.floor((GRID_BOTTOM - GRID_TOP - (ROWS - 1) * GAP) / ROWS);

for (let row = 0; row < ROWS; row++) {
  for (let col = 0; col < COLS; col++) {
    const x = GRID_LEFT + col * (KEY_W + GAP);
    const y = GRID_TOP + row * (KEY_H + GAP);
    // Make the bottom-right key (the "=" / Apply key) the accent color.
    const isApplyKey = (row === ROWS - 1) && (col === COLS - 1);
    fillRoundedRect(x, y, KEY_W, KEY_H, isApplyKey ? BUTTON_ACCENT : BUTTON, 3);
  }
}

// 4. "SP" text on the screen — render as simple geometric shapes.
//    Each glyph is hand-drawn with rectangles.
function drawS(x, y) {
  // Stylized "S" — three horizontal bars connected by alternating vertical bars.
  fillRect(x, y, 8, 2, BG);             // top
  fillRect(x, y + 6, 8, 2, BG);         // middle
  fillRect(x, y + 12, 8, 2, BG);        // bottom
  fillRect(x, y + 2, 2, 4, BG);         // upper-left vertical
  fillRect(x + 6, y + 8, 2, 4, BG);     // lower-right vertical
}

function drawP(x, y) {
  // "P" — left vertical bar with a closed top half.
  fillRect(x, y, 2, 14, BG);            // left vertical
  fillRect(x, y, 8, 2, BG);             // top
  fillRect(x, y + 6, 8, 2, BG);         // middle
  fillRect(x + 6, y + 2, 2, 4, BG);     // upper-right vertical
}

// Center "SP" on the screen (8+4+8 = 20px wide; centered at SCREEN_X + (SCREEN_W-20)/2).
const TEXT_X = SCREEN_X + Math.floor((SCREEN_W - 20) / 2);
const TEXT_Y = SCREEN_Y + Math.floor((SCREEN_H - 14) / 2);
drawS(TEXT_X, TEXT_Y);
drawP(TEXT_X + 12, TEXT_Y);

// --- Encode as PNG ---

// IHDR
const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(W, 0);
ihdr.writeUInt32BE(H, 4);
ihdr[8] = 8;       // bit depth
ihdr[9] = 6;       // color type = RGBA
ihdr[10] = 0;      // compression
ihdr[11] = 0;      // filter
ihdr[12] = 0;      // interlace

// IDAT — prepend filter byte (0 = None) per scanline.
const raw = Buffer.alloc(H * (1 + W * 4));
for (let y = 0; y < H; y++) {
  raw[y * (1 + W * 4)] = 0; // filter type
  for (let x = 0; x < W; x++) {
    const src = (y * W + x) * 4;
    const dst = y * (1 + W * 4) + 1 + x * 4;
    raw[dst]     = pixels[src];
    raw[dst + 1] = pixels[src + 1];
    raw[dst + 2] = pixels[src + 2];
    raw[dst + 3] = pixels[src + 3];
  }
}
const idat = zlib.deflateSync(raw);

const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const png = Buffer.concat([
  sig,
  chunk("IHDR", ihdr),
  chunk("IDAT", idat),
  chunk("IEND", Buffer.alloc(0)),
]);

const outPath = path.join(__dirname, "..", "images", "icon.png");
fs.writeFileSync(outPath, png);
console.log(`Wrote ${outPath} — ${png.length} bytes (was 143 bytes placeholder)`);
