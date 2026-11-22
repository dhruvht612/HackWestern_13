# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Primary audience right now: HackWestern 13 judges and fellow hackers watching a live demo. They have ~30 seconds to understand what ShadowScope does, believe it works, and click into the demo dashboard. The product is framed as a real tool for teams that need to know what an outsider can see of their infrastructure (small eng teams, AppSec, authorized recon).

## Product Purpose

ShadowScope is an AI-powered external attack surface intelligence platform. Given an authorized root domain, it passively discovers exposed assets, correlates them with dependency vulnerabilities, and produces a prioritized, actionable remediation plan. Success for the demo: a judge leaves able to repeat the pipeline in one sentence and has seen it working on real-looking data.

## Positioning

One chain, told as one story: **discover → correlate → prioritize.**
1. Attacker's-eye view: what an outsider sees (subdomains, reachable staging/dev, stale TLS, leaky headers), from passive signals only.
2. Correlation: exposed hosts linked to the vulnerable dependencies running behind them, rendered as exposure paths in a graph rather than two separate lists.
3. AI triage: findings turned into P0/P1 priorities with business impact and remediation.

## Operating Context

- Routes: `/` landing, `/projects/new` create project, `/projects/:id` dashboard with scans, assets, findings, dependencies, graph, and report pages.
- Mock mode (`VITE_USE_MOCKS=true`, default) serves `shared/fixtures/*` so every page works without the backend; the demo project is `11111111-1111-4111-8111-111111111111` (Acme Demo, acme-demo.com).
- Report pages print (`src/styles/print.css`).

## Capabilities and Constraints

- Passive discovery only: CT logs, DNS, HTTP/TLS metadata. No brute-forcing, port scanning, or exploitation. Never claim otherwise.
- Authorized targets only: project creation requires `authorization_confirmed=true`.
- `root_domain` must be a registrable domain (no IPs, wildcards, schemes, paths).
- Findings are *potential* exposure, not proof; they should be validated before action.
- Dependency intel via OSV advisories; AI analysis via Gemini (stubbed in the hackathon scaffold).
- Stack: React 19 + Vite + TypeScript + Tailwind 3, TanStack Query, @xyflow/react (graph), recharts, lucide-react.

## Brand Commitments

- Name: ShadowScope.
- Honesty about scope (passive, authorized, potential exposure) is part of the brand, not fine print.

## Evidence on Hand

- Realistic demo data in `shared/fixtures/`: 5 assets on acme-demo.com (www, api, staging, dev, mail), header/TLS/transport findings, 3 OSV advisories (minimist GHSA-xvch-5gv4-984h critical, lodash GHSA-35jh-r3h4-6jhm high, node-fetch GHSA-r683-j2x4-v87g high), an AI executive summary, a graph, and a Markdown report.
- acme-demo.com and 203.0.113.x are synthetic; label them as demo data.
- Absent: customers, testimonials, logos, benchmarks, pricing, user counts. Do not fabricate any of them.

## Product Principles

1. Show the attacker's view, don't describe it: real-looking evidence beats adjectives.
2. One chain: every surface should place the visitor somewhere on discover → correlate → prioritize.
3. Priority over volume: the product's value is knowing what to fix first.
4. Honest scope: passive, authorized, potential exposure, stated plainly.
