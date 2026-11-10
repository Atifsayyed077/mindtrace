/* ── Minimal, spec-correct QR encoder (byte mode, L, v1..v5) ──
 * Single EC block per supported version → no interleaving needed.
 * Implements: mode indicator, length, UTF-8 bytes, terminator/pad,
 * GF(256) Reed-Solomon (0x11D), format info BCH, finder/timing/
 * alignment/dark modules, 8 masks with full penalty selection.
 */

/* capacities in BYTES for byte-mode, level L (v1..v5) */
const L_CAP = { 1: 17, 2: 32, 3: 53, 4: 78, 5: 106 };
const L_TOTAL = { 1: 26, 2: 44, 3: 70, 4: 100, 5: 134 };   // data + ec codewords
const L_EC = { 1: 7, 2: 10, 3: 15, 4: 20, 5: 26 };
const ALIGN: Record<number, number[]> = { 1: [], 2: [6, 18], 3: [6, 22], 4: [6, 26], 5: [6, 30] };

/* ── GF(256) with primitive polynomial 0x11D ── */
const EXP = new Uint8Array(512), LOG = new Uint8Array(256);
(() => {
  let x = 1;
  for (let i = 0; i < 255; i++) {
    EXP[i] = x; LOG[x] = i;
    x <<= 1;
    if (x & 0x100) x ^= 0x11d;
  }
  for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255];
})();
const gmul = (a: number, b: number) => (a && b ? EXP[LOG[a] + LOG[b]] : 0);

/* generator polynomial coefficients (ascending? use descending for division) */
function generatorPoly(n: number): number[] {
  let g = [1];
  for (let i = 0; i < n; i++) {
    const factor = [1, EXP[i]];
    const out: number[] = new Array(g.length + 1).fill(0);
    for (let j = 0; j < g.length; j++)
      for (let k = 0; k < 2; k++)
        out[j + k] ^= gmul(g[j], factor[k]);
    g = out;
  }
  return g; // length n+1, descending powers
}

function rsEncode(data: number[], ecLen: number): number[] {
  const g = generatorPoly(ecLen);
  const res = new Array(ecLen).fill(0);
  for (const d of data) {
    const f = d ^ (res.shift() as number);
    res.push(0);
    if (f) for (let i = 0; i < ecLen; i++) res[i] ^= gmul(g[i + 1], f);
  }
  return res;
}

/* bit buffer */
class BitBuf {
  bits: number[] = [];
  push(val: number, len: number) { for (let i = len - 1; i >= 0; i--) this.bits.push((val >> i) & 1); }
  get length() { return this.bits.length; }
}

function utf8Bytes(s: string): number[] {
  const out: number[] = [];
  const enc = new TextEncoder();
  for (const b of enc.encode(s)) out.push(b);
  return out;
}

const MASKS: ((r: number, c: number) => boolean)[] = [
  (r, c) => (r + c) % 2 === 0,
  (r) => r % 2 === 0,
  (_r, c) => c % 3 === 0,
  (r, c) => (r + c) % 3 === 0,
  (r, c) => (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0,
  (r, c) => (r * c) % 2 + (r * c) % 3 === 0,
  (r, c) => ((r * c) % 2 + (r * c) % 3) % 2 === 0,
  (r, c) => ((r + c) % 2 + (r * c) % 3) % 2 === 0,
];

/* Full encode: returns square boolean matrix or null if too long */
export function qrMatrix(text: string): boolean[][] | null {
  const data = utf8Bytes(text);
  let version = Object.keys(L_CAP).map(Number).find((v) => L_CAP[v as 1] >= data.length);
  if (!version) return null;
  const capBits = 4 + 8 + data.length * 8;               // byte mode, len field 8 bits (v1-9)
  const dataBits = (L_TOTAL[version as 1] - L_EC[version as 1]) * 8;  // data-only budget (EC appended after)
  if (capBits > dataBits) return null;

  const bb = new BitBuf();
  bb.push(0b0100, 4);          // byte mode
  bb.push(data.length, 8);     // count (v≤9)
  for (const b of data) bb.push(b, 8);
  /* terminator up to 4 bits */
  const term = Math.min(4, dataBits - bb.length);
  if (term > 0) bb.push(0, term);
  /* pad to byte */
  while (bb.length % 8 !== 0) bb.push(0, 1);
  const padBytes = [0xEC, 0x11];
  let pi = 0;
  while (bb.length < dataBits) bb.push(padBytes[pi++ % 2], 8);

  const dataCw: number[] = [];
  for (let i = 0; i < bb.bits.length; i += 8) {
    let v = 0;
    for (let j = 0; j < 8; j++) v = (v << 1) | bb.bits[i + j];
    dataCw.push(v);
  }
  const ec = rsEncode(dataCw, L_EC[version as 1]);
  const final = [...dataCw, ...ec];

  const size = version * 4 + 17;
  const m: boolean[][] = Array.from({ length: size }, () => new Array(size).fill(false));
  const R = (r: number, c: number) => r >= 0 && r < size && c >= 0 && c < size;

  const drawFinder = (r0: number, c0: number) => {
    for (let r = -1; r <= 7; r++) for (let c = -1; c <= 7; c++) {
      const rr = r0 + r, cc = c0 + c;
      if (!R(rr, cc)) continue;
      const ring = r >= 0 && r <= 6 && c >= 0 && c <= 6 && (r === 0 || r === 6 || c === 0 || c === 6);
      const core = r >= 2 && r <= 4 && c >= 2 && c <= 4;
      if (ring || core) m[rr][cc] = true;
    }
  };
  drawFinder(0, 0); drawFinder(0, size - 7); drawFinder(size - 7, 0);
  for (let i = 8; i < size - 8; i++) { m[6][i] = i % 2 === 0; m[i][6] = i % 2 === 0; }
  const coords = ALIGN[version] ?? [];
  for (const fr of coords) for (const fc of coords) {
    if ((fr <= 8 && fc <= 8) || (fr <= 8 && fc >= size - 9) || (fr >= size - 9 && fc <= 8)) continue;
    for (let r = fr - 2; r <= fr + 2; r++) for (let c = fc - 2; c <= fc + 2; c++) {
      m[r][c] = (Math.max(Math.abs(r - fr), Math.abs(c - fc)) === 2) || (r === fr && c === fc);
    }
  }

  /* function-module map (never receives data) */
  const isFunction: boolean[][] = Array.from({ length: size }, () => new Array(size).fill(false));
  for (let i = 0; i < size; i++) {
    isFunction[6][i] = true; isFunction[i][6] = true;           // timing
  }
  for (let r = 0; r <= 8; r++) for (let c = 0; c <= 8; c++) isFunction[r][c] = true;      // top-left format/finder zone
  for (let r = 0; r <= 8; r++) for (let c = size - 8; c < size; c++) isFunction[r][c] = true; // top-right format zone
  for (let r = size - 8; r < size; r++) for (let c = 0; c <= 8; c++) isFunction[r][c] = true; // bottom-left format zone
  for (const fr of coords) for (const fc of coords) {
    if ((fr <= 8 && fc <= 8) || (fr <= 8 && fc >= size - 9) || (fr >= size - 9 && fc <= 8)) continue;
    for (let r = fr - 2; r <= fr + 2; r++) for (let c = fc - 2; c <= fc + 2; c++) isFunction[r][c] = true;
  }

  /* zig-zag data placement — canonical read order (right col of pair first,
   * alternating direction every column pair, first pair read upward) */
  let bitIndex = 0;
  const totalBits = final.length * 8;
  const bit = (i: number) => (final[i >> 3] >> (7 - (i & 7))) & 1;
  let upward = true;
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5;
    for (let vert = 0; vert < size; vert++) {
      for (let j = 0; j < 2; j++) {
        const x = right - j;
        const y = upward ? size - 1 - vert : vert;
        if (!isFunction[y][x]) {
          if (bitIndex < totalBits) m[y][x] = !!bit(bitIndex);
          bitIndex++;
        }
      }
    }
    upward = !upward;
  }

  /* format info for each mask, choose best by penalty */
  const L_BITS = 0b01; // EC level L
  const fmtBitsFor = (mask: number): number[] => {
    const d = ((L_BITS << 3) | mask) & 0x1f;
    let v = d << 10;
    const POLY = 0b10100110111;
    for (let i = 14; i >= 10; i--) {
      const bitv = (v >> i) & 1;
      if (bitv) v ^= (POLY << (i - 10));
    }
    let bits = ((d << 10) | (v & 0x3ff)) ^ 0b101010000010010; // XOR 0x5412
    const arr: number[] = [];
    for (let i = 14; i >= 0; i--) arr.push((bits >> i) & 1);
    return arr;
  };

  const applyMask = (maskIdx: number): boolean[][] => {
    const mm = m.map((row) => [...row]);
    for (let r = 0; r < size; r++) for (let c = 0; c < size; c++) {
      if (isFunction[r][c]) continue;
      if (MASKS[maskIdx](r, c)) mm[r][c] = !mm[r][c];
    }
    const fb = fmtBitsFor(maskIdx);
    /* fb[0] = bit 14 (MSB) … fb[14] = bit 0 (LSB). Decoders count format bits from the LSB. */
    /* copy 1 — around top-left finder */
    for (let i = 0; i <= 5; i++) { mm[i][8] = !!fb[14 - i]; }             // col 8, rows 0-5 = LSB bits 0-5
    mm[7][8] = !!fb[8];                                                  // (7,8) = bit 6
    mm[8][8] = !!fb[7];                                                  // (8,8) = bit 7
    mm[8][7] = !!fb[6];                                                  // (8,7) = bit 8
    for (let i = 9; i <= 14; i++) { mm[8][14 - i] = !!fb[14 - i]; }      // row 8, cols 5-0 = bits 9-14 (MSB at col 0)
    /* copy 2 — top-right horizontal (8 bits) + bottom-left vertical (7 bits) */
    for (let i = 0; i <= 7; i++) { mm[8][size - 1 - i] = !!fb[14 - i]; }   // row 8, cols size-1…size-8 = bits 0-7
    for (let i = 8; i <= 14; i++) { mm[size - 15 + i][8] = !!fb[14 - i]; } // col 8, rows size-7…size-1 = bits 8-14
    mm[size - 8][8] = true; // dark module stays dark
    return mm;
  };

  const penalty = (mm: boolean[][]): number => {
    let p = 0;
    /* N1: runs */
    for (let r = 0; r < size; r++) {
      let run = 1;
      for (let c = 1; c <= size; c++) {
        if (c < size && mm[r][c] === mm[r][c - 1]) run++;
        else { if (run >= 5) p += run - 2; run = 1; }
      }
    }
    for (let c = 0; c < size; c++) {
      let run = 1;
      for (let r = 1; r <= size; r++) {
        if (r < size && mm[r][c] === mm[r - 1][c]) run++;
        else { if (run >= 5) p += run - 2; run = 1; }
      }
    }
    /* N2: 2x2 blocks */
    for (let r = 0; r < size - 1; r++) for (let c = 0; c < size - 1; c++) {
      const v = mm[r][c];
      if (mm[r][c + 1] === v && mm[r + 1][c] === v && mm[r + 1][c + 1] === v) p += 3;
    }
    /* N3: finder-like */
    const pat1 = [true, false, true, true, true, false, true, false, false, false, false];
    const pat2 = [...pat1].reverse();
    const line = (get: (i: number) => boolean, len: number) => {
      for (let i = 0; i <= len - 11; i++) {
        let a = true, b = true;
        for (let k = 0; k < 11; k++) { if (get(i + k) !== pat1[k]) a = false; if (get(i + k) !== pat2[k]) b = false; }
        if (a || b) p += 40;
      }
    };
    for (let r = 0; r < size; r++) line((i) => mm[r][i], size);
    for (let c = 0; c < size; c++) line((i) => mm[i][c], size);
    /* N4: balance */
    let dark = 0;
    for (let r = 0; r < size; r++) for (let c = 0; c < size; c++) if (mm[r][c]) dark++;
    const total = size * size;
    const ratio = (dark * 100) / total;
    p += Math.floor(Math.abs(ratio - 50) / 5) * 10;
    return p;
  };

  let best: boolean[][] | null = null, bestP = Infinity;
  for (let mask = 0; mask < 8; mask++) {
    const mm = applyMask(mask);
    const p = penalty(mm);
    if (p < bestP) { bestP = p; best = mm; }
  }
  return best;
}

/* Render to canvas with quiet zone */
export function drawQR(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, s: number, quiet = 4): boolean {
  const m = qrMatrix(text);
  if (!m) return false;
  const size = m.length + quiet * 2;
  const cell = s / size;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(x, y, s, s);
  ctx.fillStyle = "#141b34";
  for (let r = 0; r < m.length; r++) for (let c = 0; c < m.length; c++) {
    if (m[r][c]) ctx.fillRect(x + (c + quiet) * cell, y + (r + quiet) * cell, cell + 0.6, cell + 0.6);
  }
  return true;
}
