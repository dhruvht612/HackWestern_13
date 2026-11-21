---
name: AttackSurface
description: The file an attacker keeps on you, printed on folder stock and bond paper.
colors:
  manila: "#D9A13B"
  manila-deep: "#C38D2E"
  manila-dark: "#4A3410"
  bond: "#F8F7F3"
  ink: "#141414"
  ink-soft: "#4A4A46"
  ink-faint: "#6E6C64"
  stamp: "#C8102E"
  carbon: "#1F3A93"
  severity-critical: "#7A1530"
  severity-high: "#D9480F"
  severity-medium: "#A87C00"
  severity-low: "#2E6E62"
  severity-info: "#6B6B66"
typography:
  display:
    fontFamily: "Archivo, Public Sans, ui-sans-serif, sans-serif"
    fontSize: "clamp(3.1rem, 7.4vw, 5.6rem)"
    fontWeight: 800
    lineHeight: 0.9
    letterSpacing: "-0.02em"
    fontVariation: "'wdth' 78"
  headline:
    fontFamily: "Archivo, Public Sans, ui-sans-serif, sans-serif"
    fontSize: "clamp(2.3rem, 4.6vw, 3.9rem)"
    fontWeight: 800
    lineHeight: 0.92
    letterSpacing: "-0.015em"
    fontVariation: "'wdth' 78"
  title:
    fontFamily: "Archivo, Public Sans, ui-sans-serif, sans-serif"
    fontSize: "2rem"
    fontWeight: 800
    lineHeight: 1
    letterSpacing: "-0.015em"
    fontVariation: "'wdth' 78"
  body:
    fontFamily: "Public Sans, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.625
  body-lead:
    fontFamily: "Public Sans, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.05rem"
    fontWeight: 400
    lineHeight: 1.625
  exhibit:
    fontFamily: "Courier Prime, ui-monospace, SFMono-Regular, monospace"
    fontSize: "13.5px"
    fontWeight: 400
    lineHeight: 1.625
  label:
    fontFamily: "Public Sans, ui-sans-serif, system-ui, sans-serif"
    fontSize: "11px"
    fontWeight: 600
    lineHeight: 1.4
    letterSpacing: "0.09em"
  band:
    fontFamily: "Archivo, Public Sans, ui-sans-serif, sans-serif"
    fontSize: "11px"
    fontWeight: 700
    letterSpacing: "0.22em"
    fontVariation: "'wdth' 90"
rounded:
  none: "0px"
spacing:
  hairline: "1px"
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "32px"
  section: "80px"
  section-lg: "112px"
components:
  button-primary:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.bond}"
    rounded: "{rounded.none}"
    padding: "10px 16px"
  button-primary-hover:
    backgroundColor: "#000000"
    textColor: "{colors.bond}"
  button-secondary:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    rounded: "{rounded.none}"
    padding: "10px 16px"
  button-secondary-hover:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.bond}"
  field:
    backgroundColor: "{colors.bond}"
    textColor: "{colors.ink}"
    rounded: "{rounded.none}"
    padding: "8px 12px"
  tab-active:
    backgroundColor: "{colors.bond}"
    textColor: "{colors.ink}"
    padding: "10px 20px 8px"
  tab-inactive:
    backgroundColor: "{colors.manila-deep}"
    textColor: "{colors.manila-dark}"
    padding: "10px 20px 8px"
  classification-band:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.bond}"
    typography: "{typography.band}"
    padding: "6px 16px"
  severity-badge:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    rounded: "{rounded.none}"
    padding: "2px 8px"
  priority-p0:
    backgroundColor: "{colors.stamp}"
    textColor: "{colors.bond}"
    padding: "2px 6px"
  sheet:
    backgroundColor: "{colors.bond}"
    textColor: "{colors.ink}"
    rounded: "{rounded.none}"
    padding: "32px"
---

# Design System: AttackSurface

## Overview

**Creative North Star: "The Attacker's Dossier"**

Every surface is a page from the file an outsider would keep on you. The field is manila folder stock with paper fiber; content sits on bond sheets that lie on the folder and cast a soft paper shadow; everything printed on them is carbon ink. Typed exhibits are set in Courier Prime, the body in Public Sans (the U.S. government face), and headings in condensed Archivo, the way a stamp or a form title would be. Classification bands run across the top (and on the landing page, the bottom) of every surface.

Structure comes from rules, not fills. Panels are ruled boxes; tables are ledgers with a heavy ink head rule; summaries are typed ledgers (SUBJECT / SCAN / SOURCES / ON FILE), never hero-metric tiles. Color is almost entirely absent: one stamp red marks the single thing to fix first, carbon blue marks focus and nothing else, and severity hues ride on edges and bands while the words stay in ink. Evidence is shown in place and annotated where it sits (a header line, a dotted leader, a note), never summarized into a tinted card.

Density is that of a working document: compact 13 to 14px text in the app, generous 80 to 112px section passes on the landing page. The Persuade surface may tilt and stack sheets; the Operate surfaces lie flat on one sheet under die-cut folder tabs.

**Key Characteristics:**
- Manila field, bond sheets, carbon ink; square corners everywhere.
- Rules and line style carry structure and category; fills are reserved.
- Stamp red appears once per surface, on the P0.
- Condensed Archivo for titles and stamps, Public Sans for prose, Courier Prime for anything collected.
- Folder tabs are navigation; classification bands frame the page.

## Colors

A near-achromatic document palette (folder, paper, ink) with one reserved red and one functional blue.

### Primary
- **Stamp Red** (`stamp`): the rubber-stamp ink for the single P0 item: the red `Stamp` and the filled P0 priority chip in memos. It is never a severity hue.

### Secondary
- **Carbon Blue** (`carbon`): the focus ring on every interactive element (2px outline, 2px offset), and link hover. Nothing else is blue.

### Neutral
- **Manila Folder** (`manila`): the page field under everything, always with the `.grain` fiber texture. Also the browser theme color.
- **Folder Shadow** (`manila-deep`): inactive folder tabs and the scrollbar thumb.
- **Folder Ink** (`manila-dark`): text set directly on the manila field (landing ledes, nav links, footer, inactive tab labels). Never used on bond.
- **Bond Paper** (`bond`): every sheet, field, and active tab; also text on ink.
- **Carbon Ink** (`ink`): all primary text, heavy rules, primary buttons, classification bands, redaction tape, the prod environment tag, and the one full-bleed black passage (rules of engagement).
- **Soft Ink** (`ink-soft`): secondary text, field labels, ledger heads, the info severity label.
- **Faint Ink** (`ink-faint`): placeholders, list numerals, evidence-ref footers, inactive log levels.
- **Hairline**: ink at 16 to 30% alpha (`rgba(20,20,20,0.16)` is the global default border) for dividers and ruled boxes; 40% for fields, 100% for head rules.

### Severity
Severity keeps its own inks so it never borrows the stamp or the focus color: Critical oxblood (`severity-critical`), High orange (`severity-high`), Medium ochre (`severity-medium`), Low pine (`severity-low`), Info gray (`severity-info`). Severity hue appears on the badge border, a small square swatch inside the badge, chart bars, and graph card top bands. Badge text stays ink (soft ink for Info); Critical earns a 2px border, never a fill.

### Named Rules
**The One Stamp Rule.** Stamp red marks the P0 and nothing else. A surface carries one red stamp, on the one item to fix first; the same item may repeat its red in a P0 chip, but no severity badge, second item, heading, button, or decoration ever takes red.

**The Edge-Not-Ink Rule.** Severity color rides edges, swatches, bars, and lines; the words are ink. Never set severity labels or body text in a severity hue.

**The Untinted Panel Rule.** Panels, cards, memos, and tiles are bond or transparent with ink rules. No tinted fills to group or signal; hover tints on ledger rows (`manila` at 10 to 15%) are state, not structure.

**The Line-Not-Hue Rule.** Categories that are not severity (environment, priority above P0, inactive paths) are told by line style: solid fill for prod, solid outline for staging, dashed for dev, dotted for unknown.

## Typography

**Display Font:** Archivo, variable width, set condensed (`font-stretch: 78%`), with Public Sans fallback
**Body Font:** Public Sans (with ui-sans-serif, system-ui)
**Label/Mono Font:** Courier Prime (with ui-monospace)

**Character:** A government form set by a typewriter. Archivo condensed at weight 800 reads as stamped titling; Public Sans is the plain civil-service voice; Courier Prime marks everything that was collected rather than written: hostnames, headers, timestamps, IDs, memo routing lines.

### Hierarchy
- **Display** (800, clamp(3.1rem, 7.4vw, 5.6rem), 0.9): the landing hero headline only, max ~11ch, balanced wrap.
- **Headline** (800, clamp(2.3rem, 4.6vw, 3.9rem), 0.92): landing section headings ("Exhibit A: ..."); the closing CTA steps up to clamp(2.6rem, 6vw, 5rem).
- **Title** (800, 2rem to 2.4rem, 1): app page titles (`PageHeader`), document titles ("Case file", "Memorandum", report title), which may be uppercase.
- **Body** (400, 14px app / 15px memos / 1.05rem landing ledes, 1.625): prose, capped at 34 to 70ch.
- **Exhibit** (Courier Prime 400, 13 to 13.5px, 1.625): collected data, evidence blocks, memo headers, hostnames in tables.
- **Label** (600, 11px, 0.09em, uppercase): field labels, ledger heads, and in-sheet section labels ("Findings by severity", "Evidence"). Numbered only when they title a form box in an intake form ("1. Project name"). Never an eyebrow above a heading.
- **Band** (Archivo 700, 11px, 0.22em, uppercase, width 90%): classification bands only.

### Named Rules
**The Typed-Evidence Rule.** If it was collected (a hostname, header, timestamp, advisory ID, package version), it is set in Courier Prime. If it was written (a summary, a remediation, a description), it is Public Sans.

**The Condensed Title Rule.** Display, headline, title, and stamp text are Archivo at weight 800, condensed (78% for titles, 70 to 85% inside stamps and sheet headings). Never set a title in the body face.

## Layout

Two compositions share one material system. The landing page is a 1320px column with `px-16/32px` gutters, two-column asymmetric grids at `lg` (1fr / 1.08fr hero; 0.78fr / 1.22fr and 1.2fr / 0.8fr exhibits), and section passes of 80px (`py-20`), 112px at `lg`, separated by 2px ink rules at 80% opacity. The app is a 1440px column: header, a row of folder tabs that overlap the sheet by 1px, then one bond sheet (`p-16/24/32px` by breakpoint) holding the page.

Inside the sheet, pages stack in 32px rhythm (`space-y-8`), open with a title over a 2px ink rule, and lay sections in two-column grids at `xl`. Stat boxes sit in a gap-px grid whose 25% ink background shows through as shared hairlines. Detail panels are sticky sheets beside the ledger. Tabs scroll horizontally on narrow screens; the landing nav collapses to the wordmark and one CTA below `md`. Breakpoints are Tailwind defaults.

## Elevation & Depth

Depth is physical paper, not interface layering. The manila field is the ground; bond sheets lie on it with one soft, warm paper shadow tinted by the folder (`sheet`). Nothing inside a sheet is elevated: structure there is rules only. The only other shadow is a small ink lift under the primary button on hover, released on press. On the landing page, a second sheet sits rotated beneath the case file and sheets may tilt under a degree; the app's sheet is flat and untilted. Print strips every shadow, texture, and field to white.

### Shadow Vocabulary
- **Sheet** (`box-shadow: 0 1px 1px rgba(74,52,16,0.18), 0 18px 36px -14px rgba(74,52,16,0.55)`): every bond sheet on the manila field. Always paired with the paper-fiber texture.
- **Lift** (`box-shadow: 0 2px 4px rgba(20,20,20,0.18), 0 10px 18px -8px rgba(20,20,20,0.4)`): primary button hover only, with a 1px rise.

### Named Rules
**The Paper-On-Folder Rule.** A shadow means "a sheet of paper is lying on the folder." Nothing on a sheet casts a shadow.

## Shapes

Square corners throughout (0 radius): buttons, fields, badges, tabs, sheets, tiles. The only silhouette is the die-cut folder tab, a trapezoid clipped 10px in at each top corner. Borders carry meaning by weight and style: 1px hairline for dividers, 1.5px for badges, tags, and chain nodes, 2px for head rules, secondary buttons, and section breaks; dashed for absent or undeclared things (a missing header slot, the "Internet" origin, an empty state, a dev host), dotted for unknown and for annotation leaders. Stamps are the one rounded form, drawn as SVG double rectangles with roughened ink.

## Components

### Buttons
Blunt, typed, square.
- **Shape:** square corners (0).
- **Primary:** ink fill, bond text, bold uppercase 14px with 0.06em tracking, 10px by 16px (landing hero CTAs step to 14px by 24px at 15px text).
- **Hover / Focus:** rises 1px to pure black with the Lift shadow; press returns flat; 150ms ease-out. Focus is the global 2px carbon outline at 2px offset. Disabled at 50% opacity.
- **Secondary:** transparent with a 2px ink border and ink text; hover inverts to ink fill and bond text.
- **Text link action:** underlined at 0.2em offset, 1px thickness, hover to carbon.

### Chips
- **Severity badge:** 1.5px border in the severity hue, a 8px square swatch in the hue, bold uppercase 11px ink label at 0.08em. Critical takes a 2px border in oxblood; no badge is ever filled.
- **Environment tag:** Courier Prime 11px bold uppercase in a 1.5px ink box; prod is filled ink, staging outlined, dev dashed, unknown dotted faint.
- **Priority chip:** Courier Prime bold 13px; P0 is filled stamp red, every other priority is a 1.5px ink outline.
- **Evidence ref:** Courier Prime 12px soft ink in a hairline box.

### Cards / Containers
- **Corner Style:** square (0).
- **Background:** bond (sheets, tiles, detail panels) or transparent (ruled panels, memos inside a sheet).
- **Shadow Strategy:** Sheet shadow on top-level sheets only; see Elevation & Depth.
- **Border:** ink at 20 to 25%; dashed 35 to 40% for empty states and absent memos.
- **Internal Padding:** 20px for panels and tiles, 32px to 40px for landing sheets.

### Inputs / Fields
- **Style:** bond fill, 1px ink border at 40%, square, 8px by 12px, 14px text, faint-ink placeholder.
- **Focus:** border goes to full ink plus the carbon focus outline; hover raises the border to 70%.
- **Labels:** the Label style above the field.

### Navigation
- **Folder tabs (app):** die-cut trapezoids, 14px semibold with a 15px line icon. Active tab is bond and joins the sheet beneath it; inactive tabs are `manila-deep` with folder-ink text, lightening toward manila on hover. 150ms color transition.
- **Landing nav:** 14px semibold folder-ink text links on the field, ink and underlined on hover; hidden below `md`.
- **Wordmark:** an ink folder glyph with two manila lines beside condensed uppercase "AttackSurface" at 800.

### Ledger (signature)
Tables are ledgers: a 2px ink head rule over 11px uppercase soft-ink headers, hairline row dividers at 15%, tabular numerals, Courier Prime for hostnames and IDs. Clickable rows tint manila at 15% on hover.

### Stamp (signature)
An SVG rubber stamp: double rectangle, Archivo 800 condensed caps, roughened and speckled ink, multiply blend, rotated -8 to +6 degrees. Tones: red (the P0 only) and ink ("Collected passively", "Filed", "No record"). On the landing case sheet it lands with a 460ms expo-out scale (keyframed press, no bounce easing) into a reserved slot so nothing shifts or is covered.

### Classification Band
A full-width ink strip of Band type stating scope ("Passive recon only // ..."). Top of every surface; also the bottom of the landing page. Hidden in print.

### Redaction
Ink tape over values. Inline values peel right-to-left per wrapped line over 560ms on `cubic-bezier(0.16, 1, 0.3, 1)`; whole rows scale out from the right. Text stays in the DOM for screen readers. Selected text also reads as redaction (ink background, bond text). Reduced motion arrives fully declassified.

### Annotated Exhibit
Raw collected output in Courier Prime with notes pinned to the line they describe: a dotted ink leader runs from the code to a fixed-width note column holding a severity badge and one plain sentence. Absent values are drawn as a dashed empty slot, not described.

## Do's and Don'ts

### Do:
- **Do** put every content surface on a bond sheet over the grained manila field, with the Sheet shadow.
- **Do** build structure from ink rules: 2px for heads and page titles, 1px hairlines at 15 to 30% for dividers.
- **Do** set collected data in Courier Prime and written prose in Public Sans.
- **Do** carry severity on borders, swatches, bars, and edges, with ink labels.
- **Do** tell non-severity categories by line style (filled, solid, dashed, dotted).
- **Do** print the most urgent path in full ink and fade the rest to 30% ink until hovered.
- **Do** annotate evidence in place with leaders and badges rather than summarizing it elsewhere.
- **Do** frame every surface with a classification band stating the passive, authorized scope.
- **Do** give every motion a reduced-motion state that shows the finished result.

### Don't:
- **Don't** use stamp red for anything but the P0: no red buttons, headings, links, or second stamps.
- **Don't** fill a panel, card, or callout with a tint to group or flag it.
- **Don't** round corners; the only non-rectangular forms are the die-cut tab and the drawn stamp.
- **Don't** cast shadows inside a sheet or use hard offset shadows; the only shadows are Sheet and the button Lift.
- **Don't** set severity labels or body copy in a severity hue.
- **Don't** set titles in Public Sans or uncondensed Archivo.
