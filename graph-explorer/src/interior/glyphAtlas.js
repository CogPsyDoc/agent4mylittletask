/**
 * A canvas-rendered glyph atlas: printable ASCII plus common accents,
 * white glyphs on transparent, used by the interior letter field.
 */

import * as THREE from 'three';

const CHARS = ' !"#$%&\'()*+,-./0123456789:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[\\]^_`abcdefghijklmnopqrstuvwxyz{|}~äöüßéèêàçñ°—•';
const COLS = 16;
const CELL = 128;

let cached = null;

export function getGlyphAtlas() {
  if (cached) return cached;

  const rows = Math.ceil(CHARS.length / COLS);
  const canvas = document.createElement('canvas');
  canvas.width = COLS * CELL;
  canvas.height = rows * CELL;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#ffffff';
  ctx.font = `600 ${CELL * 0.72}px "Courier New", monospace`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  const uv = new Map();
  for (let i = 0; i < CHARS.length; i++) {
    const col = i % COLS;
    const row = (i / COLS) | 0;
    ctx.fillText(CHARS[i], col * CELL + CELL / 2, row * CELL + CELL * 0.55);
    // UV origin bottom-left in WebGL; flip the row.
    uv.set(CHARS[i], [col / COLS, 1 - (row + 1) / rows]);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = true;

  cached = {
    texture,
    cellUv: [1 / COLS, 1 / rows],
    uvFor: (ch) => uv.get(ch) || uv.get('•') || [0, 0],
    has: (ch) => uv.has(ch),
  };
  return cached;
}
