/* ── Zero-dependency PDF writer: one A4 page from a canvas ──
 * Renders the certificate onto a <canvas>, JPEG-encodes it,
 * then assembles a minimal single-page PDF (XObject image).
 */
export function canvasToPdf(canvas: HTMLCanvasElement, filename: string): void {
  const jpeg = canvas.toDataURL("image/jpeg", 0.92).split(",")[1];
  const bin = atob(jpeg);
  const imgBytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) imgBytes[i] = bin.charCodeAt(i);

  const W = 595.28, H = 841.89; // A4 portrait points
  const enc = (s: string) => new TextEncoder().encode(s);

  const contents = `q ${W.toFixed(2)} 0 0 ${H.toFixed(2)} 0 0 cm /Im0 Do Q\n`;
  const header = "%PDF-1.4\n";
  const objCatalog = "1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n";
  const objPages = "2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n";
  const objPage = `3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${W.toFixed(2)} ${H.toFixed(2)}] /Resources << /XObject << /Im0 5 0 R >> /ProcSet [/PDF /ImageC] >> /Contents 4 0 R >>\nendobj\n`;
  const objContents = `4 0 obj\n<< /Length ${contents.length} >>\nstream\n${contents}endstream\nendobj\n`;
  const objImageHead = `5 0 obj\n<< /Type /XObject /Subtype /Image /Width ${canvas.width} /Height ${canvas.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${imgBytes.length} >>\nstream\n`;
  const objImageEnd = "endstream\nendobj\n";

  /* xref offsets */
  const bHead = enc(header);
  const b1 = enc(objCatalog);
  const b2 = enc(objPages);
  const b3 = enc(objPage);
  const b4 = enc(objContents);
  const b5 = enc(objImageHead);
  const b6 = enc(objImageEnd);

  const offsets: number[] = [];
  let off = bHead.length;
  for (const b of [b1, b2, b3, b4, b5]) { offsets.push(off); off += b.length; }
  off += imgBytes.length; // jpeg bytes are part of object 5's stream
  off += b6.length;

  const xrefStr =
    `xref\n0 6\n0000000000 65535 f \n` +
    offsets.map((o) => `${String(o).padStart(10, "0")} 00000 n \n`).join("") +
    `trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${off}\n%%EOF\n`;

  const bXref = enc(xrefStr);
  const total = bHead.length + b1.length + b2.length + b3.length + b4.length + b5.length + imgBytes.length + b6.length + bXref.length;

  const out = new Uint8Array(total);
  let p = 0;
  const copy = (bytes: Uint8Array) => { out.set(bytes, p); p += bytes.length; };
  copy(bHead); copy(b1); copy(b2); copy(b3); copy(b4); copy(b5); copy(imgBytes); copy(b6); copy(bXref);

  const blob = new Blob([out], { type: "application/pdf" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}

/* ── Certificate art direction ────────────────────────────── */
import { drawQR } from "./qr";

export function renderCertificate(canvas: HTMLCanvasElement, opts: {
  name: string; certId: string; issuedAt: string; verifyUrl: string;
}): boolean {
  const ctx = canvas.getContext("2d");
  if (!ctx) return false;
  const W = canvas.width, H = canvas.height;

  /* paper */
  const grad = ctx.createLinearGradient(0, 0, W, H);
  grad.addColorStop(0, "#FDFCF7");
  grad.addColorStop(0.5, "#FAF7EE");
  grad.addColorStop(1, "#F5F1E4");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  /* subtle gradient washes */
  const wash = (x: number, y: number, r: number, rgb: string, alpha: number) => {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, `rgba(${rgb},${alpha})`);
    g.addColorStop(1, `rgba(${rgb},0)`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  };
  wash(W * 0.85, H * 0.1, W * 0.45, "169,155,214", 0.14);
  wash(W * 0.1, H * 0.85, W * 0.45, "53,176,168", 0.10);
  wash(W * 0.5, H * 0.03, W * 0.34, "201,162,74", 0.07);

  const navy = "#1E2A5E", gold = "#A8842E";
  ctx.strokeStyle = navy;
  ctx.lineWidth = 3;
  ctx.strokeRect(56, 56, W - 112, H - 112);
  ctx.strokeStyle = gold;
  ctx.lineWidth = 1;
  ctx.strokeRect(68, 68, W - 136, H - 136);

  const corner = (cx: number, cy: number, sx: number, sy: number) => {
    ctx.strokeStyle = gold;
    ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.arc(cx + sx * 26, cy + sy * 26, 18, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.arc(cx + sx * 26, cy + sy * 26, 6, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx + sx * 12, cy + sy * 44);
    ctx.lineTo(cx + sx * 12, cy + sy * 12);
    ctx.lineTo(cx + sx * 44, cy + sy * 12);
    ctx.stroke();
  };
  corner(70, 70, 1, 1); corner(W - 70, 70, -1, 1); corner(70, H - 70, 1, -1); corner(W - 70, H - 70, -1, -1);

  const centerX = W / 2;
  const serif = '"Georgia", "Times New Roman", serif';
  const sans = '"Segoe UI", system-ui, sans-serif';

  ctx.textAlign = "center";
  ctx.fillStyle = navy;
  ctx.font = `bold 21px ${sans}`;
  ctx.fillText("M I N D T R A C E", centerX, 150);
  ctx.fillStyle = gold;
  ctx.font = `600 12px ${sans}`;
  ctx.fillText("MENTAL WELLNESS & SELF-DISCOVERY", centerX, 174);

  ctx.beginPath(); ctx.moveTo(centerX - 120, 192); ctx.lineTo(centerX + 120, 192); ctx.stroke();

  ctx.fillStyle = navy;
  ctx.font = `bold 44px ${serif}`;
  ctx.fillText("CERTIFICATE", centerX, 268);
  ctx.font = `bold 24px ${serif}`;
  ctx.fillText("OF COMPLETION", centerX, 306);

  ctx.fillStyle = "#5C6480";
  ctx.font = `italic 17px ${serif}`;
  ctx.fillText("This certificate is proudly presented to", centerX, 370);

  ctx.fillStyle = navy;
  ctx.font = `bold 56px ${serif}`;
  ctx.fillText(opts.name, centerX, 452);
  ctx.strokeStyle = gold;
  ctx.lineWidth = 2;
  const nw = Math.min(560, ctx.measureText(opts.name).width + 70);
  ctx.beginPath(); ctx.moveTo(centerX - nw / 2, 474); ctx.lineTo(centerX + nw / 2, 474); ctx.stroke();

  ctx.fillStyle = "#3A4262";
  ctx.font = `17px ${serif}`;
  ctx.fillText("for successfully completing the", centerX, 528);
  ctx.font = `bold 19px ${serif}`;
  ctx.fillStyle = navy;
  ctx.fillText("7-Day MindTrace Mental Wellness & Self-Reflection Journey", centerX, 560);
  ctx.font = `15px ${serif}`;
  ctx.fillStyle = "#5C6480";
  ctx.fillText("(five honest minutes a day — brain-approved ✔)", centerX, 590);

  const dateStr = new Date(opts.issuedAt).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });
  ctx.textAlign = "left";
  ctx.fillStyle = "#3A4262";
  ctx.font = `15px ${sans}`;
  ctx.fillText(`Completed on:  ${dateStr}`, 130, 672);
  ctx.fillText(`Certificate ID:  ${opts.certId}`, 130, 696);

  ctx.textAlign = "center";
  ctx.strokeStyle = navy;
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(W - 310, 700); ctx.lineTo(W - 130, 700); ctx.stroke();
  ctx.beginPath();
  let sx = W - 300;
  const sy = 690;
  ctx.moveTo(sx, sy);
  for (let i = 0; i <= 24; i++) {
    const px = sx + i * 6.6;
    ctx.lineTo(px, sy - Math.sin(i * 0.9) * (i < 10 ? 9 : 4) - 2);
  }
  ctx.strokeStyle = "#3A4262";
  ctx.lineWidth = 1.6;
  ctx.stroke();
  ctx.fillStyle = navy;
  ctx.font = `bold 13px ${sans}`;
  ctx.fillText("NEURO", W - 220, 722);
  ctx.fillStyle = "#5C6480";
  ctx.font = `10px ${sans}`;
  ctx.fillText("Your Reflection Companion, MindTrace", W - 220, 738);

  /* seal */
  const sealX = 190, sealY = 776;
  ctx.strokeStyle = gold;
  ctx.lineWidth = 2.4;
  ctx.beginPath(); ctx.arc(sealX, sealY, 34, 0, Math.PI * 2); ctx.stroke();
  ctx.lineWidth = 1.2;
  ctx.beginPath(); ctx.arc(sealX, sealY, 26, 0, Math.PI * 2); ctx.stroke();
  ctx.fillStyle = gold;
  ctx.font = "bold 11px " + sans;
  ctx.fillText("7 DAYS", sealX, sealY - 2);
  ctx.font = "bold 8px " + sans;
  ctx.fillText("OF YOU", sealX, sealY + 10);
  for (let i = 0; i < 24; i++) {
    const a = (i / 24) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(sealX + Math.cos(a) * 37, sealY + Math.sin(a) * 37);
    ctx.lineTo(sealX + Math.cos(a) * 41, sealY + Math.sin(a) * 41);
    ctx.stroke();
  }

  /* verification QR (bottom-right) */
  try { drawQR(ctx, opts.verifyUrl, W - 250, 742, 86, 3); } catch {
    ctx.fillStyle = "#141B34";
    ctx.font = `bold 12px ${sans}`;
    ctx.fillText(opts.certId, W - 250 + 43, 785);
  }

  ctx.textAlign = "center";
  ctx.fillStyle = "#8F96AD";
  ctx.font = `10.5px ${sans}`;
  ctx.fillText("This certificate confirms participation in a self-reflection program only. It does not indicate any psychological assessment, clinical clearance, or medical status.", centerX, H - 66);
  ctx.fillText("Verify authenticity at the /verify page using the certificate ID.", centerX, H - 48);

  return true;
}
