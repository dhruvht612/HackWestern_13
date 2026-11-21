# AttackSurface Report — acme-demo.com

**Project:** Acme Demo  
**Scan:** 22222222-2222-4222-8222-222222222222  
**Completed:** 2026-05-10T14:06:12Z  
**Status:** Completed

## Executive Summary

The acme-demo.com external surface shows moderate exposure concentrated in non-production systems and one production API dependency chain. The most urgent risks are a critical prototype pollution advisory in minimist and publicly reachable staging/dev hosts with weak transport or missing browser protections.

**Recommended priorities**
1. Upgrade vulnerable npm dependencies in the API build (minimist, lodash, node-fetch).
2. Restrict public access to staging and dev hosts; enforce HTTPS redirects on dev.
3. Add missing security headers (HSTS, CSP, X-Frame-Options) and renew the staging TLS certificate.

## Asset Inventory

| Hostname | Environment | IPs | Technology | HTTPS | Status |
|---|---|---|---|---:|---|
| www.acme-demo.com | prod | 203.0.113.10 | Cloudflare, nginx/1.24.0 | Yes | resolved |
| api.acme-demo.com | prod | 203.0.113.20 | Node.js, Express | Yes | resolved |
| staging.acme-demo.com | staging | 203.0.113.30 | nginx/1.18.0, React | Yes | resolved |
| dev.acme-demo.com | dev | 203.0.113.40 | nginx/1.18.0, PHP/8.1 | No | resolved |
| mail.acme-demo.com | prod | 203.0.113.50 | Postfix | Yes | resolved |

## Key Findings

| Severity | Asset | Finding | Source | Remediation |
|---|---|---|---|---|
| Critical | api.acme-demo.com | Prototype Pollution in minimist (GHSA-xvch-5gv4-984h) | osv | Upgrade minimist to >= 1.2.6 |
| High | api.acme-demo.com | Command Injection in lodash (GHSA-35jh-r3h4-6jhm) | osv | Upgrade lodash to >= 4.17.21 |
| High | api.acme-demo.com | node-fetch secure header forwarding (GHSA-r683-j2x4-v87g) | osv | Upgrade node-fetch to >= 2.6.7 |
| High | staging.acme-demo.com | Missing Strict-Transport-Security header | rules | Add HSTS header |
| High | dev.acme-demo.com | HTTP does not redirect to HTTPS | rules | Enforce HTTPS redirect |
| Medium | staging.acme-demo.com | Missing Content-Security-Policy header | rules | Add CSP policy |
| Medium | staging.acme-demo.com | Missing X-Frame-Options header | rules | Add X-Frame-Options / frame-ancestors |
| Medium | staging.acme-demo.com | TLS certificate expiring in 21 days | rules | Renew certificate |
| Info | staging.acme-demo.com | Non-production host publicly reachable | rules | Restrict access |

## Dependency Advisories

| Package | Version | Fixed | Advisory | Severity |
|---|---:|---:|---|---|
| lodash | 4.17.15 | 4.17.21 | GHSA-35jh-r3h4-6jhm | High |
| minimist | 1.2.5 | 1.2.6 | GHSA-xvch-5gv4-984h | Critical |
| node-fetch | 2.6.6 | 2.6.7 | GHSA-r683-j2x4-v87g | High |

## Scope and Safety

This report is based on passive external discovery (CT logs, DNS, HTTP headers/TLS metadata) and dependency advisory matching. Findings represent potential exposure and should be validated before remediation in production. No brute-forcing, port scanning, or exploitation was performed.
