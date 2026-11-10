"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Neuro } from "@/components/neuro";
import { Icon } from "@/components/icons";
import { ClientGate, Splash, TopNav, Badge } from "@/components/ui";
import { getCurrentUserId, getUser, completedDays, listCerts, saveCert } from "@/lib/db";
import { canvasToPdf, renderCertificate } from "@/lib/pdf";

export default function CertificatePage() {
  return <div className="flex-1"><TopNav /><ClientGate><CertBody /></ClientGate></div>;
}

function CertBody() {
  const nav = useRouter();
  const [user, setUser] = useState<ReturnType<typeof getUser>>(null);
  const [cert, setCert] = useState<ReturnType<typeof listCerts>[number] | null>(null);
  const [ready, setReady] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [qrOk, setQrOk] = useState(true);

  useEffect(() => {
    const id = getCurrentUserId();
    if (!id) { nav.replace("/onboarding"); return; }
    const u = getUser(id);
    if (!u) { nav.replace("/onboarding"); return; }
    if (completedDays(id).length < 7) { /* locked */ }
    setUser(u);
    let c = listCerts().find((x) => x.userId === id) ?? null;
    if (!c && completedDays(id).length >= 7) {
      c = { id: `MT7-${randBlock()}-${randBlock()}`, userId: id, name: u.name, issuedAt: new Date().toISOString() };
      saveCert(c);
    }
    setCert(c);
    setReady(true);
  }, [nav]);

  useEffect(() => {
    if (!ready || !cert || !canvasRef.current) return;
    const verifyUrl = `${window.location.origin}/verify?c=${cert.id}`;
    const ok = renderCertificate(canvasRef.current, { name: user?.name ?? "", certId: cert.id, issuedAt: cert.issuedAt, verifyUrl });
    setQrOk(ok);
  }, [ready, cert, user]);

  if (user && completedDays(user.id).length < 7) {
    return (
      <main className="flex-1 max-w-xl mx-auto px-5 py-20 text-center">
        <div className="animate-floaty inline-block"><Neuro size={130} mood="sleep" blink={false} /></div>
        <h1 className="font-display font-bold text-2xl text-navy-800 mt-6">The certificate is printed… but framed elsewhere. 🖼️</h1>
        <p className="text-ink-muted mt-3">Complete all seven days to earn it. It&apos;s not gatekeeping — gold ink is expensive, and your journey deserves a finished story.</p>
        <Link href="/journey" className="btn btn-primary mt-7">Continue the journey</Link>
      </main>
    );
  }
  if (!ready || !user || !cert) return <Splash />;

  return (
    <main className="flex-1 max-w-4xl mx-auto px-5 pb-24">
      <section className="pt-10 pb-6 text-center">
        <div className="animate-floaty inline-block"><Neuro size={110} mood="proud" /></div>
        <h1 className="font-display font-bold text-3xl text-navy-800 mt-3">Your Certificate of Completion</h1>
        <p className="text-ink-muted mt-2">Signed by me, Neuro, and cosigned by your own honesty. 🧠✨</p>
        <div className="flex flex-wrap gap-2 justify-center mt-4 no-print">
          <button onClick={() => {
            const c = canvasRef.current;
            if (!c) return;
            const d = document.createElement("canvas");
            d.width = 1448; d.height = 2049;
            const ctx = d.getContext("2d");
            if (!ctx) return;
            ctx.scale(2, 2);
            renderCertificate(d, { name: user.name, certId: cert.id, issuedAt: cert.issuedAt, verifyUrl: `${window.location.origin}/verify?c=${cert.id}` });
            ctx.scale(1, 1);
            canvasToPdf(d, `mindtrace-certificate-${cert.id}.pdf`);
          }} className="btn btn-primary" data-testid="download-cert-pdf"><Icon name="download" size={16} /> Download PDF certificate</button>
          <Link href={`/verify?c=${cert.id}`} className="btn btn-ghost"><Icon name="search" size={16} /> Verify it</Link>
        </div>
        <div className="flex gap-2 justify-center items-center mt-4">
          <Badge tone="gold">ID · {cert.id}</Badge>
          <Badge tone="lav">issued {new Date(cert.issuedAt).toLocaleDateString()}</Badge>
          {!qrOk && <Badge tone="danger">QR fallback: ID printed</Badge>}
        </div>
      </section>

      <div className="card overflow-hidden shadow-pop animate-pop-in">
        <canvas ref={canvasRef} width={724} height={1024} className="w-full h-auto block" aria-label="Certificate preview" />
      </div>

      <p className="text-[0.78rem] text-ink-faint text-center mt-4 leading-relaxed max-w-xl mx-auto">
        The certificate confirms participation in the 7-day MindTrace self-reflection programme only — it does not imply any
        psychological assessment, clinical clearance or medical status. The QR code opens certificate verification, which
        reveals just a name and completion date. That&apos;s it. Privacy is the whole point.
      </p>
    </main>
  );
}

function randBlock() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}
