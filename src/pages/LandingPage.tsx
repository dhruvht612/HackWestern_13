import { useEffect, useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, RotateCcw } from "lucide-react";
import { fixtures } from "@/mocks/fixtures";
import { DEMO_PROJECT_ID } from "@/lib/constants";
import { apiConfig } from "@/lib/api";
import { ClassificationBand } from "@/components/ClassificationBand";
import { EnvironmentTag } from "@/components/EnvironmentTag";
import { SeverityBadge } from "@/components/SeverityBadge";
import { Stamp } from "@/components/Stamp";
import { Logo, ScopeMark } from "@/components/Logo";
import { ScopeCorners, ScopeFrame } from "@/components/ScopeFrame";
import { cn } from "@/lib/utils";
import type { Severity } from "@/lib/types";

const { assets, findings, analysis, scan, project } = fixtures;
const DEMO = apiConfig.USE_MOCKS ? `/projects/${DEMO_PROJECT_ID}` : "/projects";
const ruleFindings = findings.filter((f) => f.source === "rules").length;
const scanSeconds = Math.round((Date.parse(scan.completed_at) - Date.parse(scan.started_at)) / 1000);
const hhmm = (iso: string) => iso.slice(11, 16);

/* ---------- Declassify: the hero's one authored moment ---------- */

const STEPS = 11; // redacted items on the case sheet; the stamp lands on step STEPS + 1

const reducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

function useDeclassify(ref: RefObject<HTMLElement | null>) {
  // Reduced motion: the file arrives already declassified.
  const [revealed, setRevealed] = useState(() => (reducedMotion() ? STEPS + 1 : 0));
  const [run, setRun] = useState(0);

  useEffect(() => {
    const el = ref.current;
    if (!el || reducedMotion()) return;
    let timer: number | undefined;
    const start = () => {
      let n = 0;
      const tick = () => {
        n += 1;
        setRevealed(n);
        if (n <= STEPS) timer = window.setTimeout(tick, n === STEPS ? 480 : 230);
      };
      timer = window.setTimeout(tick, 500);
    };
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          io.disconnect();
          start();
        }
      },
      { threshold: 0.35 },
    );
    io.observe(el);
    return () => {
      io.disconnect();
      window.clearTimeout(timer);
    };
  }, [ref, run]);

  return {
    revealed,
    stamped: revealed > STEPS,
    replay: () => {
      setRevealed(reducedMotion() ? STEPS + 1 : 0);
      setRun((r) => r + 1);
    },
  };
}

/** Inline value under redaction tape. Text stays in the DOM for screen readers. */
function R({ step, revealed, children }: { step: number; revealed: number; children: ReactNode }) {
  return (
    <span className="redact" data-open={revealed > step} data-step={step}>
      {children}
    </span>
  );
}

/** A whole row under one strip of tape. */
function RowRedact({ step, revealed, children, className }: { step: number; revealed: number; children: ReactNode; className?: string }) {
  return (
    <div className={cn("relative", className)} data-step={step}>
      {children}
      <span
        aria-hidden="true"
        className="redaction absolute inset-x-0 inset-y-[3px] origin-right transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]"
        style={{ transform: revealed > step ? "scaleX(0)" : "scaleX(1)" }}
      />
    </div>
  );
}

type Box = { x: number; y: number; w: number; h: number };

/**
 * The scope: corner brackets that frame each redaction as its tape peels, then
 * settle on the P0 once the file is declassified. Measured against the unrotated wrapper, so it
 * frames the slightly tilted sheet like a lens held in front of it, not ink on the page.
 */
function useScopeBox(ref: RefObject<HTMLElement | null>, step: number) {
  const [box, setBox] = useState<Box | null>(null);
  useLayoutEffect(() => {
    const root = ref.current;
    if (!root) return;
    const measure = () => {
      const base = root.getBoundingClientRect();
      let l = Infinity, t = Infinity, r = -Infinity, b = -Infinity;
      root.querySelectorAll(`[data-step="${step}"]`).forEach((el) => {
        for (const rc of el.getClientRects()) {
          l = Math.min(l, rc.left); t = Math.min(t, rc.top); r = Math.max(r, rc.right); b = Math.max(b, rc.bottom);
        }
      });
      const pad = 7;
      setBox(l === Infinity ? null : { x: l - base.left - pad, y: t - base.top - pad, w: r - l + pad * 2, h: b - t + pad * 2 });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(root);
    return () => ro.disconnect();
  }, [ref, step]);
  return box;
}

function Scope({ box }: { box: Box | null }) {
  if (!box) return null;
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute left-0 top-0 z-10 transition-[transform,width,height] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none"
      style={{ transform: `translate(${box.x}px, ${box.y}px)`, width: box.w, height: box.h }}
    >
      <ScopeCorners />
    </div>
  );
}

function SheetHeading({ children }: { children: ReactNode }) {
  return (
    <h3 className="mb-2 mt-6 border-b border-silver/30 pb-1 font-display text-[13px] font-extrabold uppercase tracking-[0.16em] text-silver" style={{ fontStretch: "85%" }}>
      {children}
    </h3>
  );
}

function CaseSheet() {
  const ref = useRef<HTMLDivElement>(null);
  const { revealed, stamped, replay } = useDeclassify(ref);
  // frame the item whose tape is peeling now; once everything is open, hold on the P0 (the last step)
  const scope = useScopeBox(ref, Math.min(Math.max(revealed - 1, 0), STEPS - 1));
  const p0 = analysis.findings.find((f) => f.suggested_priority === "P0");

  return (
    <div ref={ref} className="relative">
      <Scope box={scope} />
      {/* the silver folder the sheet is filed in */}
      <div aria-hidden="true" className="absolute -inset-x-3 -bottom-5 -top-8 rotate-[-1.6deg] bg-silver shadow-sheet sm:-inset-x-5">
        <span
          className="absolute -top-6 left-6 flex h-6 items-center bg-silver px-5 font-display text-[11px] font-extrabold uppercase tracking-[0.16em] text-ink"
          style={{ clipPath: "polygon(10px 0, calc(100% - 10px) 0, 100% 100%, 0 100%)", fontStretch: "85%" }}
        >
          {project.root_domain}
        </span>
      </div>
      <article
        className="sheet relative px-5 pb-7 pt-5 sm:px-8 lg:rotate-[0.6deg]"
        aria-label={`Case file on ${project.root_domain}`}
      >
        <header className="flex items-start justify-between gap-4 border-b-2 border-silver pb-3">
          <div>
            <div className="display text-[2rem] font-extrabold uppercase leading-none">Case file</div>
            <div className="mono mt-1 flex flex-wrap items-center gap-x-3 text-[13px] text-fg-soft">
              <span>No. SS-{scan.id.slice(0, 8)}</span>
              <button
                type="button"
                onClick={replay}
                className="inline-flex items-center gap-1 underline decoration-silver/30 underline-offset-4 transition-colors hover:text-fg hover:decoration-silver"
              >
                <RotateCcw size={12} aria-hidden="true" /> redact &amp; replay
              </button>
            </div>
          </div>
          <Stamp lines={["Collected", "Passively"]} tone="silver" rotate={5} className="-mr-2 -mt-1 w-32 sm:w-36" />
        </header>

        <dl className="mono mt-4 grid grid-cols-[6.5rem_minmax(0,1fr)] gap-y-1.5 text-[13.5px] leading-snug sm:grid-cols-[7.5rem_minmax(0,1fr)]">
          <dt className="text-silver">SUBJECT</dt>
          <dd><R step={0} revealed={revealed}>{project.root_domain}</R></dd>
          <dt className="text-silver">COLLECTED</dt>
          <dd><R step={1} revealed={revealed}>{scan.started_at.slice(0, 10)} {hhmm(scan.started_at)}–{hhmm(scan.completed_at)}Z · {scanSeconds} s</R></dd>
          <dt className="text-silver">SOURCES</dt>
          <dd><R step={2} revealed={revealed}>CT logs · DNS · HTTP/TLS metadata</R></dd>
        </dl>

        <SheetHeading>1. Hosts observed ({assets.length})</SheetHeading>
        <div className="mono space-y-1 text-[13.5px]">
          {assets.map((a, i) => (
            <RowRedact key={a.id} step={3 + Math.floor(i / 2)} revealed={revealed}>
              <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 py-0.5 sm:grid-cols-[12rem_4.75rem_minmax(0,1fr)]">
                <span className="truncate">{a.hostname}</span>
                <span><EnvironmentTag env={a.environment} /></span>
                <span className="col-span-2 truncate text-[13px] text-fg-soft sm:col-span-1">
                  {a.https ? a.technology : `${a.technology} · HTTP`}
                </span>
              </div>
            </RowRedact>
          ))}
        </div>

        <SheetHeading>2. Noted</SheetHeading>
        <ul className="space-y-2 text-[14px] leading-relaxed">
          <li>
            <R step={6} revealed={revealed}>
              <span className="mono">staging</span> is reachable from the internet with no HSTS, CSP, or X-Frame-Options; its certificate expires in 21 days.
            </R>
          </li>
          <li>
            <R step={7} revealed={revealed}>
              <span className="mono">dev</span> answers over plain HTTP and never redirects to HTTPS.
            </R>
          </li>
        </ul>

        <SheetHeading>3. Linked</SheetHeading>
        <p className="mono text-[13.5px] leading-relaxed">
          <R step={8} revealed={revealed}>api.acme-demo.com</R>
          <span className="text-fg-faint"> → </span>
          <R step={9} revealed={revealed}>minimist 1.2.5</R>
          <span className="text-fg-faint"> → </span>
          <R step={10} revealed={revealed}>GHSA-xvch-5gv4-984h</R>
        </p>
        <p className="mt-1 text-[14px] leading-relaxed">
          <R step={10} revealed={revealed}>{p0?.summary ?? "Critical prototype pollution in minimist."}</R>
        </p>
        {/* reserved slot so the stamp lands without shifting the sheet or covering evidence */}
        <div className="-mb-3 mt-1 flex h-[4.25rem] justify-end">
          {stamped ? (
            <div className="stamp-in -mr-1 w-44 sm:-mr-3 sm:w-48">
              <Stamp lines={["P0 · Fix first", "Critical"]} tone="accent" rotate={-6} />
            </div>
          ) : null}
        </div>
      </article>
    </div>
  );
}

/* ---------- Exhibit A: annotated response ---------- */

type ExhibitLine = { code: ReactNode; note?: { severity: Severity; text: string }; prompt?: boolean };

function Missing() {
  return (
    <span className="ml-1 inline-block h-[1.05em] w-20 translate-y-[0.15em] border border-dashed border-silver/60 align-baseline">
      <span className="sr-only">absent</span>
    </span>
  );
}

const exhibitLines: ExhibitLine[] = [
  { code: "$ curl -sI https://staging.acme-demo.com/", prompt: true },
  { code: "HTTP/2 200" },
  { code: "server: nginx/1.18.0", note: { severity: "low", text: "Version disclosed. It tells an attacker which advisories to try." } },
  { code: "content-type: text/html; charset=utf-8" },
  { code: <>strict-transport-security:<Missing /></>, note: { severity: "high", text: "No HSTS. Browsers can be downgraded to plain HTTP." } },
  { code: <>content-security-policy:<Missing /></>, note: { severity: "medium", text: "No CSP. Injected script runs unchallenged." } },
  { code: <>x-frame-options:<Missing /></>, note: { severity: "medium", text: "Any site can frame this page." } },
  { code: "" },
  { code: "$ openssl s_client -connect staging.acme-demo.com:443 \\", prompt: true },
  { code: "    | openssl x509 -noout -enddate", prompt: true },
  { code: "notAfter=May 31 23:59:59 2026 GMT", note: { severity: "medium", text: "Expires in 21 days." } },
];

function AnnotatedExhibit() {
  return (
    <figure className="sheet px-5 py-6 sm:px-8 sm:py-8">
      <div className="mono space-y-1 text-[13.5px] leading-relaxed">
        {exhibitLines.map((line, i) =>
          line.code === "" ? (
            <div key={i} className="h-4" />
          ) : (
            <div key={i} className="flex flex-wrap items-start gap-x-3 gap-y-1 md:flex-nowrap">
              <code className={cn("min-w-0 whitespace-pre-wrap break-all md:shrink-0 md:break-normal", line.prompt ? "text-fg-soft" : "text-fg", line.prompt && "md:shrink")}>
                {line.code}
              </code>
              {line.note ? (
                <>
                  <span aria-hidden="true" className="mt-[0.8em] hidden min-w-6 flex-1 border-b border-dotted border-silver/60 md:block" />
                  <span className="flex w-full items-start gap-2 pl-4 font-sans text-[13px] leading-snug text-fg md:w-[15.5rem] md:shrink-0 md:pl-0">
                    <SeverityBadge severity={line.note.severity} className="mt-px px-1.5 text-[11px]" />
                    <span>{line.note.text}</span>
                  </span>
                </>
              ) : null}
            </div>
          ),
        )}
      </div>
      <figcaption className="mt-6 border-t border-silver/20 pt-3 text-[13px] text-fg-soft">
        Response headers and certificate metadata collected from <span className="mono">staging.acme-demo.com</span>. Demo data.
      </figcaption>
    </figure>
  );
}

/* ---------- Exhibit B: correlation chains ---------- */

type ChainNode = { kind: string; value: string; detail?: string; severity?: Severity };
type Chain = { id: string; nodes: ChainNode[]; priority: string; fix: string };

const chains: Chain[] = [
  {
    id: "minimist",
    priority: "P0",
    fix: "Upgrade minimist to 1.2.6",
    nodes: [
      { kind: "Host", value: "api.acme-demo.com", detail: "prod · Node.js, Express" },
      { kind: "Manifest", value: "package-lock.json", detail: "transitive dependency" },
      { kind: "Package", value: "minimist 1.2.5", detail: "affected < 1.2.6" },
      { kind: "Advisory", value: "GHSA-xvch-5gv4-984h", detail: "Prototype pollution", severity: "critical" },
    ],
  },
  {
    id: "dev-http",
    priority: "P1",
    fix: "Enforce an HTTPS redirect",
    nodes: [
      { kind: "Host", value: "dev.acme-demo.com", detail: "dev · nginx/1.18.0, PHP/8.1" },
      { kind: "Signal", value: "GET http://dev…/", detail: "200 OK over plaintext" },
      { kind: "Rule", value: "No HTTPS redirect", detail: "on-path interception", severity: "high" },
    ],
  },
  {
    id: "staging-hsts",
    priority: "P1",
    fix: "Add Strict-Transport-Security",
    nodes: [
      { kind: "Host", value: "staging.acme-demo.com", detail: "staging · nginx/1.18.0, React" },
      { kind: "Signal", value: "GET https://staging…/", detail: "no HSTS header" },
      { kind: "Rule", value: "Missing HSTS", detail: "downgrade possible", severity: "high" },
    ],
  },
];

// The P0 path is the live connection (lime); the rest stay faded silver infrastructure until hovered.
const inkLine = (lead: boolean) => (lead ? "bg-lime" : "bg-silver/30 group-hover:bg-silver");
const inkBorder = (lead: boolean) => (lead ? "border-silver" : "border-silver/30 group-hover:border-silver");

function Connector({ lead }: { lead: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "ml-6 block h-5 w-[2px] self-start transition-colors duration-200 lg:ml-0 lg:h-[2px] lg:w-auto lg:min-w-5 lg:flex-1 lg:self-center",
        inkLine(lead),
      )}
    />
  );
}

function ChainRow({ chain, lead }: { chain: Chain; lead: boolean }) {
  return (
    <li className="group py-6 first:pt-0 last:pb-0">
      <MaybeScope on={lead}>
      <div className="flex flex-col lg:flex-row lg:items-stretch">
        <div className={cn("flex items-center self-start border-[1.5px] border-dashed px-3 py-2 transition-colors lg:self-center", inkBorder(lead))}>
          <span className="field-label">Internet</span>
        </div>
        {chain.nodes.map((node) => (
          <div key={node.kind + node.value} className="contents">
            <Connector lead={lead} />
            <div
              className={cn(
                "min-w-0 border-[1.5px] bg-ink-raised px-3 py-2 transition-colors lg:w-[11.5rem] lg:shrink-0",
                node.severity === "critical" ? "border-severity-critical" : inkBorder(lead),
              )}
            >
              <div className="field-label">{node.kind}</div>
              <div
                className={cn("mono mt-0.5 truncate text-[13.5px] font-bold transition-colors", lead ? "text-fg" : "text-fg-soft group-hover:text-fg")}
                title={node.value}
              >
                {node.value}
              </div>
              {node.detail ? (
                <div className="mt-0.5 flex items-center gap-1.5 text-[13px] text-fg-soft">
                  {node.severity ? <SeverityBadge severity={node.severity} className="px-1 py-0 text-[11px]" /> : null}
                  <span className="truncate">{node.detail}</span>
                </div>
              ) : null}
            </div>
          </div>
        ))}
        <Connector lead={lead} />
        <div className="relative flex min-h-[3.5rem] items-center self-start lg:w-[10.5rem] lg:shrink-0 lg:self-center">
          {lead ? (
            <Stamp lines={["P0", "Fix first"]} tone="accent" rotate={-7} className="w-36" />
          ) : (
            <span className={cn("border-[1.5px] px-2 py-1 font-mono text-[13px] font-bold text-fg-soft transition-colors group-hover:text-fg", inkBorder(lead))}>
              {chain.priority}
            </span>
          )}
        </div>
      </div>
      <p className="mt-2 pl-6 text-[13px] text-fg-soft lg:pl-0">
        Fix: <span className="font-semibold text-fg">{chain.fix}</span>
      </p>
      </MaybeScope>
    </li>
  );
}

function MaybeScope({ on, children }: { on: boolean; children: ReactNode }) {
  return on ? <ScopeFrame>{children}</ScopeFrame> : <>{children}</>;
}

/* ---------- Exhibit C: the analyst memo ---------- */

function Memo() {
  const date = new Date(scan.completed_at).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
  return (
    <article className="sheet px-5 py-7 sm:px-10 sm:py-10" aria-label="Analyst memorandum">
      <div className="display text-[2rem] font-extrabold uppercase leading-none tracking-[0.04em]">Memorandum</div>
      <dl className="mono mt-5 grid grid-cols-[4.5rem_minmax(0,1fr)] gap-y-1 border-b-2 border-silver pb-4 text-[13.5px]">
        <dt className="text-silver">TO:</dt>
        <dd>Engineering, {project.root_domain}</dd>
        <dt className="text-silver">FROM:</dt>
        <dd>ShadowScope analyst (Gemini)</dd>
        <dt className="text-silver">DATE:</dt>
        <dd>{date}</dd>
        <dt className="text-silver">RE:</dt>
        <dd className="font-bold">What to fix first</dd>
      </dl>
      <p className="mt-5 max-w-[68ch] text-[15px] leading-relaxed text-fg">{analysis.executive_summary}</p>

      <ol className="mt-6 divide-y divide-silver/15 border-y border-silver/15">
        {analysis.findings.map((f) => {
          const p0 = f.suggested_priority === "P0";
          return (
            <li key={f.finding_id} className="grid grid-cols-[3rem_minmax(0,1fr)] gap-x-4 py-4">
              <span
                className={cn(
                  "h-fit self-start px-1.5 py-0.5 text-center font-mono text-[13px] font-bold",
                  p0 ? "bg-lime text-ink" : "border-[1.5px] border-silver text-fg",
                )}
              >
                {f.suggested_priority}
              </span>
              <div className="min-w-0">
                <p className="font-semibold leading-snug text-fg">{f.summary}</p>
                <p className="mt-1 text-[14px] leading-relaxed text-fg-soft">
                  <span className="font-semibold text-fg">Fix:</span> {f.remediation}
                </p>
                <p className="mono mt-1.5 text-[13px] text-fg-faint">
                  {f.evidence_refs.join(" · ")} · confidence {f.confidence}
                </p>
              </div>
            </li>
          );
        })}
      </ol>
    </article>
  );
}

/* ---------- Rules of engagement ---------- */

function Box({ checked }: { checked: boolean }) {
  return (
    <svg viewBox="0 0 20 20" className="h-5 w-5 shrink-0" aria-hidden="true">
      <rect x="1.5" y="1.5" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="1.5" />
      {checked ? <path d="M5 10.5l3.2 3.2L15 6.5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="square" /> : null}
    </svg>
  );
}

const reads = ["Certificate Transparency logs", "DNS records", "HTTP response headers", "TLS certificate metadata", "Package manifests you upload"];
const never = ["Port scans", "Brute force or credential guessing", "Exploit payloads of any kind", "Domains you haven't confirmed you're authorized to assess"];

/* ---------- Page ---------- */

const navLinks = [
  ["#how-it-works", "How it works"],
  ["#features", "Features"],
  ["#gemini", "Gemini"],
  ["#why", "Why ShadowScope?"],
  ["#scope", "Scope"],
] as const;

const steps = [
  {
    n: "01",
    title: "Discover",
    body: "Verify a domain you own. ShadowScope discovers public-facing assets such as subdomains and related infrastructure.",
  },
  {
    n: "02",
    title: "Detect",
    body: "ShadowScope identifies potential security misconfigurations and checks uploaded software dependencies for known vulnerabilities.",
  },
  {
    n: "03",
    title: "Analyze",
    body: "Google Gemini AI analyzes collected evidence, explains security risks, and prioritizes what needs attention.",
  },
  {
    n: "04",
    title: "Secure",
    body: "Users receive actionable recommendations and security reports to help them address identified risks.",
  },
] as const;

const features = [
  {
    title: "Attack Surface Discovery",
    body: "Find publicly visible assets associated with verified domains.",
  },
  {
    title: "Security Risk Detection",
    body: "Identify potential configuration issues and known vulnerable dependencies.",
  },
  {
    title: "Gemini AI Analysis",
    body: "Explain findings and prioritize security improvements.",
  },
  {
    title: "Security Intelligence Dashboard",
    body: "View assets, findings, and supporting evidence.",
  },
  {
    title: "Actionable Security Reports",
    body: "Understand what to fix and why.",
  },
  {
    title: "Admin Security Controls",
    body: "Support human review of suspicious accounts and domain claims where implemented.",
  },
] as const;

const reasons = [
  {
    title: "Plain words, not jargon",
    body: "Every finding comes with an explanation you can forward to your team, not just a score.",
  },
  {
    title: "Evidence you can check",
    body: "Each point traces back to the header, certificate, manifest, or advisory it came from.",
  },
  {
    title: "A clear order of work",
    body: "One prioritized list tells you what deserves attention first instead of handing you another backlog.",
  },
  {
    title: "Restraint by design",
    body: "Collection is passive and limited to domains you are authorized to assess.",
  },
] as const;

type FooterLink = { label: string; href: string };
type FooterSection = { title: string; links: FooterLink[] };

const footerSections: FooterSection[] = [
  { title: "Explore", links: navLinks.map(([href, label]) => ({ label, href })) },
  {
    title: "Demo",
    links: [
      { label: "Open demo file", href: DEMO },
      { label: "Attack paths", href: `${DEMO}/graph` },
      { label: "Report", href: `${DEMO}/report` },
    ],
  },
  {
    title: "Account",
    links: [
      { label: "Sign in", href: "/signin" },
      { label: "Create account", href: "/signup" },
      { label: "Start a project", href: "/projects/new" },
    ],
  },
];

function FooterLinks({ title, links }: FooterSection) {
  return (
    <div>
      <h3 className="field-label mb-4 border-b border-silver/30 pb-2">{title}</h3>
      <ul className="space-y-2.5">
        {links.map(({ label, href }) => (
          <li key={`${href}-${label}`}>
            {href.startsWith("#") ? (
              <a
                href={href}
                className="text-[13px] text-fg-soft transition-colors hover:text-lime hover:underline"
              >
                {label}
              </a>
            ) : (
              <Link
                to={href}
                className="text-[13px] text-fg-soft transition-colors hover:text-lime hover:underline"
              >
                {label}
              </Link>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function LandingPage() {
  return (
    <div className="grain min-h-screen overflow-x-clip text-fg">
      <ClassificationBand>Passive recon only // AI-powered intelligence // Demo data: acme-demo.com</ClassificationBand>

      <header className="mx-auto flex max-w-[1320px] items-center justify-between gap-4 px-4 py-5 md:px-8">
        <Logo to="/" />
        <div className="flex items-center gap-4 sm:gap-6">
          <nav aria-label="Page sections" className="hidden items-center gap-7 lg:flex">
            {navLinks.map(([href, label]) => (
              <a key={href} href={href} className="text-sm font-semibold text-fg-soft transition-colors hover:text-lime">
                {label}
              </a>
            ))}
          </nav>
          <nav aria-label="Account" className="hidden items-center gap-4 sm:flex">
            <Link to="/signin" className="text-sm font-semibold text-fg-soft transition-colors hover:text-lime">
              Sign in
            </Link>
            <Link to="/signup" className="text-sm font-semibold text-fg-soft transition-colors hover:text-lime">
              Create account
            </Link>
          </nav>
          <Link to={DEMO} className="btn-primary px-3.5 py-2 text-[13px]">
            Open demo
          </Link>
        </div>
      </header>

      <main>
        {/* Hero: the file itself */}
        <section className="mx-auto grid max-w-[1320px] items-center gap-12 px-4 pb-24 pt-6 md:px-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.08fr)] lg:gap-16 lg:pb-28 lg:pt-10">
          <div>
            <h1 className="display max-w-[11ch] text-[clamp(3.1rem,7.4vw,5.6rem)] font-extrabold leading-[0.9] tracking-[-0.02em] [text-wrap:balance]">
              See Beyond the Surface.
            </h1>
            <p className="mt-7 max-w-[34rem] text-[1.05rem] leading-relaxed text-fg-soft">
              Discover your digital exposure, uncover potential security risks, and get AI-powered insights to secure
              what matters.
            </p>
            <div className="mt-9 flex flex-wrap gap-3">
              <Link to="/projects/new" className="btn-primary px-6 py-3.5 text-[15px]">
                Start Your Security Scan <ArrowRight size={17} aria-hidden="true" />
              </Link>
              <a href="#features" className="btn-secondary px-6 py-3.5 text-[15px]">
                Explore Features
              </a>
            </div>
            <p className="mt-5 text-sm text-fg-soft">
              Passive signals only. The case file alongside uses synthetic data for acme-demo.com.
            </p>
          </div>
          <CaseSheet />
        </section>

        {/* How ShadowScope Works */}
        <section id="how-it-works" className="scroll-mt-4 border-t-2 border-silver">
          <div className="mx-auto max-w-[1320px] px-4 py-20 md:px-8 lg:py-28">
            <h2 className="display max-w-[18ch] text-[clamp(2.3rem,4.6vw,3.9rem)] font-extrabold leading-[0.92] [text-wrap:balance]">
              How ShadowScope Works
            </h2>
            <p className="mt-6 max-w-[52ch] text-[1.05rem] leading-relaxed text-fg-soft">
              No security background needed. Verify what you own, see what an outsider could see, and get a short,
              evidence-backed list of what to do next.
            </p>
            <ol className="relative mt-14 grid gap-10 lg:grid-cols-4 lg:gap-10">
              {/* the line every step sits on: out of the shadow, into the scope */}
              <span
                aria-hidden="true"
                className="absolute bottom-4 left-[13px] top-4 w-0.5 bg-gradient-to-b from-silver/20 to-silver lg:bottom-auto lg:left-4 lg:right-4 lg:top-[13px] lg:h-0.5 lg:w-auto lg:bg-gradient-to-r"
              />
              {steps.map((s, i) => (
                <li key={s.n} className="relative pl-12 lg:pl-0 lg:pt-14">
                  <span aria-hidden="true" className="absolute left-0 top-0">
                    <ScopeMark className={cn("h-7 w-7", i < steps.length - 1 && "opacity-50")} />
                  </span>
                  <span className="mono text-[13px] font-bold text-silver">{s.n}</span>
                  <h3 className="display mt-1 text-xl font-extrabold uppercase">{s.title}</h3>
                  <p className="mt-2 max-w-[34ch] text-[14px] leading-relaxed text-fg-soft">{s.body}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* Key Features */}
        <section id="features" className="scroll-mt-4 border-t-2 border-silver">
          <div className="mx-auto max-w-[1320px] px-4 py-20 md:px-8 lg:py-28">
            <div className="flex flex-wrap items-end justify-between gap-6">
              <div>
                <h2 className="display max-w-[14ch] text-[clamp(2.3rem,4.6vw,3.9rem)] font-extrabold leading-[0.92] [text-wrap:balance]">
                  Key Features
                </h2>
              </div>
              <p className="max-w-[42ch] text-[1.05rem] leading-relaxed text-fg-soft">
                These capabilities are part of the working demo. Each one stays tied to the evidence behind it.
              </p>
            </div>
            <dl className="mt-12 border-t-2 border-silver">
              {features.map((f) => (
                <div
                  key={f.title}
                  className="grid gap-x-12 gap-y-1.5 border-b border-silver/25 py-5 transition-colors hover:bg-silver/[0.04] md:grid-cols-[minmax(0,19rem)_minmax(0,1fr)] md:py-6"
                >
                  <dt className="display text-[1.15rem] font-extrabold uppercase leading-snug">{f.title}</dt>
                  <dd className="max-w-[62ch] text-[14.5px] leading-relaxed text-fg-soft">{f.body}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        {/* Powered by Google Gemini */}
        <section id="gemini" className="scroll-mt-4 border-t-2 border-silver">
          <div className="mx-auto grid max-w-[1320px] gap-12 px-4 py-20 md:px-8 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:py-28">
            <div>
              <h2 className="display text-[clamp(2.3rem,4.6vw,3.9rem)] font-extrabold leading-[0.92] [text-wrap:balance]">
                An analyst that shows its sources.
              </h2>
              <p className="mt-6 max-w-[42ch] text-[1.05rem] leading-relaxed text-fg-soft">
                Gemini reads the evidence collected by the scan, explains what each finding means in plain language, and
                suggests what to fix first. Its output is checked before it reaches your report, and a deterministic
                summary keeps the report usable when the model is unavailable.
              </p>
              <p className="mt-5 max-w-[42ch] text-sm leading-relaxed text-fg-soft">
                Treat the memo as triage, not a verdict. Severity and evidence come from the scan, not the model.
              </p>
            </div>
            <div className="sheet trace-line p-5 sm:p-8">
              <dl className="divide-y divide-silver/15 border-y-2 border-silver">
                {[
                  ["In", "Headers, certificates, hosts, advisories, and manifests collected for the project"],
                  ["Model", "Google Gemini reads only that collected evidence"],
                  ["Check", "Structured output is validated before it is shown"],
                  ["Fallback", "A deterministic summary is used when AI is unavailable"],
                  ["Out", "A prioritized memo with remediation and evidence references"],
                ].map(([k, v]) => (
                  <div key={k} className="grid grid-cols-[5.5rem_minmax(0,1fr)] gap-4 py-3.5 text-[14px] sm:grid-cols-[7rem_minmax(0,1fr)]">
                    <dt className="field-label">{k}</dt>
                    <dd className="text-fg-soft">{v}</dd>
                  </div>
                ))}
              </dl>
              <p className="mono mt-6 text-[13px] text-fg-faint">EVIDENCE IN → EXPLANATION OUT</p>
            </div>
          </div>
        </section>

        {/* Exhibit A — Discover */}
        <section id="discover" className="scroll-mt-4 border-t-2 border-silver">
          <div className="mx-auto grid max-w-[1320px] gap-12 px-4 py-20 md:px-8 lg:grid-cols-[minmax(0,0.78fr)_minmax(0,1.22fr)] lg:py-28">
            <div>
              <h2 className="display text-[clamp(2.3rem,4.6vw,3.9rem)] font-extrabold leading-[0.92] [text-wrap:balance]">
                Exhibit A: what an outsider already sees.
              </h2>
              <p className="mt-6 max-w-[38ch] text-[1.05rem] leading-relaxed text-fg-soft">
                Your infrastructure talks before anyone knocks. Certificate logs list every name you’ve issued a certificate
                for, DNS resolves them, and every response header admits what’s running.
              </p>
              <dl className="mt-9 border-t-2 border-silver">
                {[
                  ["Certificate Transparency", `${assets.length} hostnames`],
                  ["DNS", `${assets.length} resolved · 203.0.113.0/24`],
                  ["HTTP + TLS metadata", `${ruleFindings} rule findings`],
                ].map(([k, v]) => (
                  <div key={k} className="flex items-baseline justify-between gap-4 border-b border-silver/30 py-3">
                    <dt className="text-sm font-semibold">{k}</dt>
                    <dd className="mono tabular text-[13.5px] text-fg-soft">{v}</dd>
                  </div>
                ))}
              </dl>
            </div>
            <AnnotatedExhibit />
          </div>
        </section>

        {/* Exhibit B — Correlate */}
        <section id="correlate" className="scroll-mt-4 border-t-2 border-silver">
          <div className="mx-auto max-w-[1320px] px-4 py-20 md:px-8 lg:py-28">
            <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:items-end lg:gap-16">
              <h2 className="display text-[clamp(2.3rem,4.6vw,3.9rem)] font-extrabold leading-[0.92] [text-wrap:balance]">
                Exhibit B: two lists aren’t a map.
              </h2>
              <p className="max-w-[46ch] text-[1.05rem] leading-relaxed text-fg-soft">
                Scanners hand you hostnames. Dependency tools hand you CVEs. ShadowScope joins them, so a critical advisory
                gets an address: the production API that ships it.
              </p>
            </div>
            <div className="sheet mt-12 px-5 py-8 sm:px-8 sm:py-10">
              <ol aria-label="Exposure paths" className="divide-y divide-silver/15">
                {chains.map((c, i) => (
                  <ChainRow key={c.id} chain={c} lead={i === 0} />
                ))}
              </ol>
              <div className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-silver/20 pt-4 text-[13px] text-fg-soft">
                <span>Potential exposure paths, not confirmed attack chains. Ranked by priority.</span>
                <Link to={`${DEMO}/graph`} className="inline-flex items-center gap-1.5 font-semibold text-fg underline underline-offset-4 hover:text-lime">
                  See every path in the demo <ArrowRight size={14} aria-hidden="true" />
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* Exhibit C — Prioritize */}
        <section id="prioritize" className="scroll-mt-4 border-t-2 border-silver">
          <div className="mx-auto grid max-w-[1320px] gap-12 px-4 py-20 md:px-8 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)] lg:py-28">
            <div className="order-2 lg:order-1">
              <Memo />
            </div>
            <div className="order-1 lg:order-2 lg:pt-4">
              <h2 className="display text-[clamp(2.3rem,4.6vw,3.9rem)] font-extrabold leading-[0.92] [text-wrap:balance]">
                Exhibit C: what to fix first, in plain words.
              </h2>
              <p className="mt-6 max-w-[36ch] text-[1.05rem] leading-relaxed text-fg-soft">
                {findings.length} findings is a backlog. One P0 is a plan. The analyst reads the evidence, weighs business
                impact, and writes the memo you’d forward to your team, with every point tied to its source.
              </p>
              <p className="mt-5 max-w-[36ch] text-sm leading-relaxed text-fg-soft">
                Memos are generated from collected evidence. Treat them as triage, not a verdict.
              </p>
            </div>
          </div>
        </section>

        {/* Why ShadowScope */}
        <section id="why" className="scroll-mt-4 border-t-2 border-silver">
          <div className="mx-auto max-w-[1320px] px-4 py-20 md:px-8 lg:py-28">
            <h2 className="display max-w-[18ch] text-[clamp(2.3rem,4.6vw,3.9rem)] font-extrabold leading-[0.92] [text-wrap:balance]">
              Clarity is the feature.
            </h2>
            <p className="mt-6 max-w-[52ch] text-[1.05rem] leading-relaxed text-fg-soft">
              ShadowScope is built for people who need to act on security findings, not just collect them. Our mission is
              making cybersecurity smarter, simpler, and more accessible through AI-powered security intelligence.
            </p>
            <div className="mt-12 grid gap-x-10 border-t-2 border-silver sm:grid-cols-2">
              {reasons.map((r) => (
                <div key={r.title} className="border-b border-silver/30 pb-6 pt-6">
                  <h3 className="display text-xl font-extrabold uppercase">{r.title}</h3>
                  <p className="mt-2 text-[14px] leading-relaxed text-fg-soft">{r.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Rules of engagement: the quiet deep-ink passage */}
        <section id="scope" className="scroll-mt-0 border-y border-silver/25 bg-ink-deep text-fg">
          <div className="mx-auto max-w-[1320px] px-4 py-20 md:px-8 lg:py-28">
            <h2 className="display max-w-[20ch] text-[clamp(2.3rem,4.6vw,3.9rem)] font-extrabold leading-[0.92] [text-wrap:balance]">
              Passive by design. Authorized by rule.
            </h2>
            <div className="mt-12 grid gap-12 md:grid-cols-2 md:gap-16">
              <div>
                <h3 className="border-b border-silver/40 pb-2 font-display text-sm font-extrabold uppercase tracking-[0.18em] text-silver" style={{ fontStretch: "85%" }}>
                  It reads
                </h3>
                <ul className="mt-2">
                  {reads.map((r) => (
                    <li key={r} className="flex items-center gap-3 border-b border-silver/15 py-3 text-[1.05rem]">
                      <span className="text-silver"><Box checked /></span> {r}
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <h3 className="border-b border-silver/40 pb-2 font-display text-sm font-extrabold uppercase tracking-[0.18em] text-silver" style={{ fontStretch: "85%" }}>
                  It never does
                </h3>
                <ul className="mt-2">
                  {never.map((r) => (
                    <li key={r} className="flex items-center gap-3 border-b border-silver/15 py-3 text-[1.05rem] text-fg-soft">
                      <span className="text-fg-faint"><Box checked={false} /></span> {r}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
            <p className="mt-12 max-w-[60ch] text-[15px] leading-relaxed text-fg-soft">
              A project can’t be created until you confirm you’re authorized to assess the domain. Every finding is potential
              exposure, not proof. Validate before you change production.
            </p>
          </div>
        </section>

        {/* Final call to action */}
        <section id="get-started" className="relative mx-auto max-w-[1320px] px-4 py-24 md:px-8 lg:py-32">
          <ScopeMark className="pointer-events-none absolute right-8 top-1/2 hidden h-[24rem] w-[24rem] -translate-y-1/2 opacity-[0.14] lg:block" />
          <h2 className="display max-w-[16ch] text-[clamp(2.6rem,6vw,5rem)] font-extrabold leading-[0.9] [text-wrap:balance]">
            Know what’s exposed before someone else does.
          </h2>
          <p className="mt-6 max-w-[52ch] text-[1.05rem] leading-relaxed text-fg-soft">
            Start with a domain you own. ShadowScope shows you the public-facing assets, the potential risks, and a
            prioritized plan to address them.
          </p>
          <div className="mt-10 flex flex-wrap gap-3">
            <Link to="/projects/new" className="btn-primary px-6 py-3.5 text-[15px]">
              Start Your Security Scan <ArrowRight size={17} aria-hidden="true" />
            </Link>
            <Link to={DEMO} className="btn-secondary px-6 py-3.5 text-[15px]">
              Open the demo
            </Link>
          </div>
        </section>
      </main>

      <footer className="border-t-2 border-silver">
        <div className="mx-auto max-w-[1320px] px-4 py-14 md:px-8">
          <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-[1.4fr_repeat(3,1fr)] lg:gap-12">
            <div>
              <Logo to="/" />
              <p className="mt-4 max-w-[34ch] text-[13px] leading-relaxed text-fg-soft">
                See Beyond the Surface. AI-powered cybersecurity intelligence, built at HackWestern 13. acme-demo.com,
                203.0.113.0/24, and every scan shown here are synthetic demo data.
              </p>
            </div>
            {footerSections.map((section) => (
              <FooterLinks key={section.title} {...section} />
            ))}
          </div>
        </div>
        <ClassificationBand>Passive recon only // AI-powered intelligence // Demo data: acme-demo.com</ClassificationBand>
      </footer>
    </div>
  );
}
