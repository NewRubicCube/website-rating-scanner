"use client";

import { FormEvent, useState } from "react";

const categories = [
  ["Performance", "performance_score"],
  ["SEO", "seo_score"],
  ["Accessibility", "accessibility_score"],
  ["Best Practices", "best_practices_score"],
  ["Mobile", "mobile_score"],
  ["Security", "security_score"],
  ["UX", "ux_score"],
] as const;

type Audit = {
  id: string;
  url: string;
  overall_score: number | null;
  performance_score: number | null;
  seo_score: number | null;
  accessibility_score: number | null;
  best_practices_score: number | null;
  mobile_score: number | null;
  security_score: number | null;
  ux_score: number | null;
  findings: unknown[];
  metrics: Record<string, unknown>;
  created_at: string;
};

function scoreClass(score: number | null) {
  if (score === null) return "muted";
  if (score >= 90) return "good";
  if (score >= 70) return "ok";
  return "bad";
}

export default function Home() {
  const [url, setUrl] = useState("");
  const [audit, setAudit] = useState<Audit | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function scan(event: FormEvent) {
    event.preventDefault();
    setError("");
    setAudit(null);
    setLoading(true);
    try {
      const response = await fetch("/api/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Scan failed");
      setAudit(data.audit);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="shell">
      <section className="hero">
        <div className="eyebrow">WEBSITE RATING SCANNER · V1</div>
        <h1>Turn any website into a clear, actionable score.</h1>
        <p className="lead">Enter a URL and get a structured audit across performance, SEO, accessibility, security, mobile and UX.</p>
        <form onSubmit={scan} className="scan-form">
          <input aria-label="Website URL" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://example.com" type="url" required />
          <button disabled={loading}>{loading ? "Scanning…" : "Scan website"}</button>
        </form>
        {error && <div className="error">{error}</div>}
      </section>

      {audit && (
        <section className="results">
          <div className="result-head">
            <div>
              <div className="eyebrow">AUDIT RESULT</div>
              <h2>{audit.url}</h2>
            </div>
            <div className={`overall ${scoreClass(audit.overall_score)}`}><strong>{audit.overall_score ?? "—"}</strong><span>/100</span></div>
          </div>
          <div className="grid">
            {categories.map(([label, key]) => {
              const score = audit[key];
              return <article className="card" key={key}><span>{label}</span><div className={`score ${scoreClass(score)}`}>{score ?? "—"}</div><div className="bar"><i style={{ width: `${Math.max(0, Math.min(100, score ?? 0))}%` }} /></div></article>;
            })}
          </div>
          <div className="details">
            <h3>Findings</h3>
            {audit.findings.length ? <pre>{JSON.stringify(audit.findings, null, 2)}</pre> : <p>No findings returned.</p>}
          </div>
        </section>
      )}
    </main>
  );
}
