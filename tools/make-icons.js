// Genera los iconos de la PWA sin dependencias (codificador PNG mínimo con zlib de Node).
// Uso: node tools/make-icons.js

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const OUT = path.join(__dirname, '..', 'icons');
const FROM = [0x4f, 0x8d, 0xf0]; // azul, arriba a la izquierda
const TO = [0x7a, 0x55, 0xe0]; // violeta, abajo a la derecha
const WHITE = [255, 255, 255];

const crcTable = new Uint32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}
function encodePNG(size, rgba) {
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y += 1) {
    raw[y * (size * 4 + 1)] = 0;
    rgba.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// Distancia con signo a un cuadrado redondeado centrado en (cx, cy)
function sdRoundRect(px, py, cx, cy, half, r) {
  const qx = Math.abs(px - cx) - (half - r);
  const qy = Math.abs(py - cy) - (half - r);
  return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - r;
}
function sdSegment(px, py, ax, ay, bx, by) {
  const abx = bx - ax; const aby = by - ay;
  const t = Math.max(0, Math.min(1, ((px - ax) * abx + (py - ay) * aby) / (abx * abx + aby * aby)));
  return Math.hypot(px - (ax + abx * t), py - (ay + aby * t));
}
function cubic(p0, p1, p2, p3, steps = 14) {
  const pts = [];
  for (let i = 0; i <= steps; i += 1) {
    const t = i / steps; const u = 1 - t;
    pts.push([0, 1].map((k) => u * u * u * p0[k] + 3 * u * u * t * p1[k] + 3 * u * t * t * p2[k] + t * t * t * p3[k]));
  }
  return pts;
}

// El logo, en las mismas coordenadas que el símbolo #logo de index.html (lienzo de 48 × 32).
const MOUNTAIN = [[3, 22], [15, 9], [21, 15], [29, 4], [45, 21]];
const WAVE = [
  ...cubic([15, 28], [20, 23.5], [25, 23.5], [30, 27]),
  ...cubic([30, 27], [35, 30.5], [40, 30], [45, 26.5]),
];
const LOGO_CENTER = [24, 17.25];

// Icono: cuadrado redondeado con degradado y la línea de montaña en blanco. maskable = fondo a sangre.
function drawIcon(size, { maskable = false } = {}) {
  const rgba = Buffer.alloc(size * size * 4);
  const half = maskable ? size / 2 + 2 : size * 0.5;
  const radius = maskable ? 0 : size * 0.23;
  const unit = (size * (maskable ? 0.5 : 0.64)) / 42; // el logo mide 42 de ancho
  const place = ([x, y]) => [size / 2 + (x - LOGO_CENTER[0]) * unit, size / 2 + (y - LOGO_CENTER[1]) * unit];
  const lines = [
    { pts: MOUNTAIN.map(place), width: 3.6 * unit, alpha: 1 },
    { pts: WAVE.map(place), width: 3.1 * unit, alpha: 0.72 },
  ];
  const SS = 4; // supermuestreo
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      let bg = 0; let fg = 0;
      for (let sy = 0; sy < SS; sy += 1) {
        for (let sx = 0; sx < SS; sx += 1) {
          const px = x + (sx + 0.5) / SS; const py = y + (sy + 0.5) / SS;
          if (sdRoundRect(px, py, size / 2, size / 2, half, radius) <= 0) bg += 1;
          let a = 0;
          for (const line of lines) {
            let d = Infinity;
            for (let i = 0; i < line.pts.length - 1; i += 1) d = Math.min(d, sdSegment(px, py, ...line.pts[i], ...line.pts[i + 1]));
            if (d <= line.width / 2) a = Math.max(a, line.alpha);
          }
          fg += a;
        }
      }
      const a = bg / (SS * SS); const f = fg / (SS * SS);
      const g = Math.max(0, Math.min(1, (x + y) / (2 * size)));
      const i = (y * size + x) * 4;
      for (let c = 0; c < 3; c += 1) {
        const base = FROM[c] + (TO[c] - FROM[c]) * g;
        rgba[i + c] = Math.round(base * (1 - f) + WHITE[c] * f);
      }
      rgba[i + 3] = Math.round(a * 255);
    }
  }
  return encodePNG(size, rgba);
}

fs.mkdirSync(OUT, { recursive: true });
fs.writeFileSync(path.join(OUT, 'icon-192.png'), drawIcon(192));
fs.writeFileSync(path.join(OUT, 'icon-512.png'), drawIcon(512));
fs.writeFileSync(path.join(OUT, 'icon-maskable-512.png'), drawIcon(512, { maskable: true }));
fs.writeFileSync(path.join(OUT, 'apple-touch-icon.png'), drawIcon(180, { maskable: true }));
fs.writeFileSync(path.join(OUT, 'favicon.svg'), `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#4f8df0"/><stop offset="1" stop-color="#7a55e0"/></linearGradient></defs>
  <rect width="64" height="64" rx="15" fill="url(#g)"/>
  <g transform="translate(9 16) scale(.96)" fill="none" stroke="#fff" stroke-linecap="round" stroke-linejoin="round">
    <path d="M3 22 15 9l6 6 8-11 16 17" stroke-width="3.8"/>
    <path d="M15 28c5-4.5 10-4.5 15-1s10 3 15-.5" stroke-width="3.2" opacity=".75"/>
  </g>
</svg>
`);
console.log('Iconos generados en', OUT);
