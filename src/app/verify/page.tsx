"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Neuro } from "@/components/neuro";
import { Icon } from "@/components/icons";
import { TopNav, Badge } from "@/components/ui";
import { findCert, prettyDateFull } from "@/lib/db";

export default function VerifyPage() {
  return (
    <div className="flex-1">
      <TopNav />
      <Suspense fallback={<div className="flex-1 grid place-items-center text-sm text-ink-faint">Loading…</div>}>
        <VerifyBody />
      </Suspense>
    </div>
  );
}

function VerifyBody() {
  const params = useSearchParams();
  const [input, setInput] = useState("");
  const [result, setResult] = useState<{
    state: "idle" | "valid" | "revoked" | "notfound" | "local";
    name?: string; issuedAt?: string; id?: string;
  }>({ state: "idle" });

  /* prefill from URL (?c=MT7-…) and look up automatically */
  useEffect(() => {
    const c = params.get("c");
    if (c) { setInput(c); lookUp(c); }
  }, [params]);

  const lookUp = (raw: string) => {
    const id = raw.trim();
    if (!id) { setResult({ state: "idle" }); return; }
    const cert = findCert(id);
    if (!cert) { setResult({ state: "notfound", id }); return; }
    setResult(cert.revoked
      ? { state: "revoked", id }
      : { state: "valid", name: cert.name, issuedAt: cert.issuedAt, id: cert.id });
  };

  return (
    <main className="flex-1 max-w-xl mx-auto w-full px-5 pb-24">
      <section className="pt-12 pb-6 text-center">
        <div className="animate-floaty inline-block"><Neuro size={110} mood="wave" blink={false} /></div>
        <h1 className="font-display font-bold text-3xl text-navy-800 mt-4">Verify a Certificate</h1>
        <p className="text-ink-muted mt-2 leading-relaxed">
          Enter a MindTrace certificate ID (format <span className="font-semibold text-ink">MT7-XXXX-XXXX</span>), or scan the QR code printed on any genuine certificate.
        </p>
      </section>

      <section className="card p-6">
        <form onSubmit={(e) => { e.preventDefault(); lookUp(input); }} className="flex gap-2">
          <input
            className="field font-mono tracking-wider uppercase"
            placeholder="MT7-XXXX-XXXX"
            maxLength={14}
            data-testid="verify-input"
            value={input}
            onChange={(e) => { setInput(e.target.value); setResult({ state: "idle" }); }}
          />
          <button type="submit" className="btn btn-primary shrink-0 !px-5" data-testid="verify-submit">
            <Icon name="search" size={16} /> Verify
          </button>
        </form>

        {result.state === "valid" && (
          <div className="mt-6 rounded-2xl border-2 border-teal-500 bg-teal-100/60 p-5 animate-pop-in text-center">
            <div className="mx-auto mb-2 grid place-items-center w-12 h-12 rounded-full bg-teal-500 text-white">
              <Icon name="check" size={22} />
            </div>
            <div className="font-bold text-teal-700 text-lg">Genuine MindTrace certificate 🎓</div>
            <div className="font-display font-bold text-3xl text-navy-800 mt-3">{result.name}</div>
            <div className="text-sm text-ink-muted mt-1">completed the 7-day MindTrace journey</div>
            <div className="text-xs text-ink-faint mt-1">on {result.issuedAt ? prettyDateFull(result.issuedAt) : "—"}</div>
            <div className="font-mono text-xs text-ink-faint mt-3">{result.id}</div>
            <div className="mt-4 flex flex-wrap gap-2 justify-center">
              <Badge tone="teal">participation verified</Badge>
              <Badge tone="lav">no assessment implied</Badge>
            </div>
            <p className="text-[0.72rem] text-ink-faint mt-4 leading-relaxed">
              This verification confirms <strong>participation in a self-reflection programme only</strong>. It indicates no
              psychological testing, diagnosis, clinical clearance or medical status of any kind.
            </p>
          </div>
        )}

        {result.state === "revoked" && (
          <div className="mt-6 rounded-2xl border-2 border-[#f5c9cd] bg-[#fdf3f4] p-5 animate-pop-in text-center">
            <div className="text-danger font-bold">This certificate has been revoked</div>
            <p className="text-sm text-ink-muted mt-1.5">The certificate holder (or the device owner) revoked this record on this device.</p>
          </div>
        )}

        {result.state === "notfound" && (
          <div className="mt-6 rounded-2xl border-2 border-lav-200 bg-lav-50 p-5 animate-pop-in text-center">
            <div className="font-bold text-navy-800">No certificate found for “{result.id}”</div>
            <p className="text-sm text-ink-muted mt-1.5 leading-relaxed">
              MindTrace stores everything locally, so verification checks the records saved in <em>this</em> browser.
              A certificate issued in another browser or on another device won&apos;t appear here — by design, no certificate
              database lives in any server.
            </p>
          </div>
        )}

        {result.state === "idle" && (
          <div className="mt-6 text-center">
            <div className="chip">🔒 verification reveals only a name, a date and participation</div>
          </div>
        )}
      </section>

      <div className="card p-5 mt-4 flex items-start gap-3">
        <span className="grid place-items-center w-9 h-9 rounded-xl bg-lav-100 text-navy-700 shrink-0"><Icon name="shield" size={16} /></span>
        <p className="text-[0.82rem] text-ink-muted leading-relaxed">
          Privacy note: certificates are written once, shown minimally, and revocable by their holder from this device.
          Verification never exposes answers, journal entries or any reflection data — those stay sealed forever.
        </p>
      </div>

      <div className="text-center mt-8">
        <Link href="/" className="btn btn-ghost"><Icon name="home" size={16} /> Back to home</Link>
      </div>
    </main>
  );
}
