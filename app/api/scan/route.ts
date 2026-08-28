import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

function clamp(n: number) { return Math.max(0, Math.min(100, Math.round(n))); }
function scoreFromChecks(checks: boolean[]) { return clamp((checks.filter(Boolean).length / checks.length) * 100); }

export async function POST(request: Request) {
  let url: string;
  try {
    const body = await request.json();
    url = String(body.url || "").trim();
    if (!/^https?:\/\//i.test(url)) url = `https://${url}`;
    new URL(url);
  } catch {
    return NextResponse.json({ error: "Please enter a valid website URL." }, { status: 400 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!supabaseUrl || !supabaseKey) return NextResponse.json({ error: "Supabase environment variables are missing." }, { status: 500 });
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    const started = Date.now();
    const response = await fetch(url, { redirect: "follow", headers: { "User-Agent": "Website-Rating-Scanner/1.0" }, signal: AbortSignal.timeout(12000) });
    const html = await response.text();
    const finalUrl = response.url;
    const elapsed = Date.now() - started;
    const lower = html.toLowerCase();

    const title = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html)?.[1]?.trim() || "";
    const description = /<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["']/i.exec(html)?.[1] || "";
    const viewport = /<meta[^>]+name=["']viewport["']/i.test(html);
    const h1 = /<h1\b[^>]*>/i.test(html);
    const images = [...html.matchAll(/<img\b[^>]*>/gi)].map(m => m[0]);
    const missingAlt = images.filter(img => !/\balt\s*=\s*["'][^"']*["']/i.test(img)).length;
    const hasHttps = finalUrl.startsWith("https://");
    const hasLang = /<html[^>]+lang=["'][^"']+["']/i.test(html);
    const hasCanonical = /<link[^>]+rel=["']canonical["']/i.test(html);
    const hasRobots = lower.includes("robots.txt") || /<meta[^>]+name=["']robots["']/i.test(html);
    const hasStructuredData = /application\/ld\+json/i.test(html);
    const performance = clamp(100 - Math.min(70, Math.round(elapsed / 80)) - Math.min(20, Math.round(html.length / 250000 * 20)));
    const seo = scoreFromChecks([!!title, title.length >= 10 && title.length <= 70, !!description, description.length <= 170, h1, hasCanonical, hasRobots, hasStructuredData]);
    const accessibility = scoreFromChecks([viewport, hasLang, images.length === 0 || missingAlt === 0, h1]);
    const bestPractices = scoreFromChecks([response.ok, hasHttps, !!title, viewport, !!description]);
    const mobile = scoreFromChecks([viewport, !/width=["']fixed/i.test(html), !/overflow-x\s*:\s*hidden/i.test(html)]);
    const security = scoreFromChecks([hasHttps, !lower.includes("http://") || hasHttps]);
    const ux = scoreFromChecks([!!title, !!description, h1, viewport, images.length < 80]);
    const overall = clamp(performance * .2 + seo * .15 + accessibility * .15 + bestPractices * .15 + mobile * .1 + security * .15 + ux * .1);

    const findings = [
      !title && { severity: "high", category: "SEO", message: "Missing page title." },
      !description && { severity: "medium", category: "SEO", message: "Missing meta description." },
      !viewport && { severity: "high", category: "Mobile", message: "Missing viewport meta tag." },
      !hasHttps && { severity: "critical", category: "Security", message: "Website is not using HTTPS." },
      missingAlt > 0 && { severity: "medium", category: "Accessibility", message: `${missingAlt} image(s) appear to be missing alt text.` },
      !h1 && { severity: "medium", category: "UX", message: "No H1 heading detected." },
    ].filter(Boolean);

    const audit = { url, normalized_url: finalUrl, overall_score: overall, performance_score: performance, seo_score: seo, accessibility_score: accessibility, best_practices_score: bestPractices, mobile_score: mobile, security_score: security, ux_score: ux, findings, metrics: { response_ms: elapsed, html_bytes: new TextEncoder().encode(html).length, status: response.status, title, description, images: images.length, missing_alt: missingAlt }, status: "completed" };
    const { data, error } = await supabase.from("audits").insert(audit).select().single();
    if (error) throw error;
    return NextResponse.json({ audit: data });
  } catch (error) {
    const message = error instanceof Error ? error.message : "The website could not be scanned.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
