---
name: ShadowScope
description: What sits in your shadow, read through a scope. The file an attacker keeps on you, kept as a dark intelligence dossier.
colors:
  ink-black: "#0B0D10"
  ink-deep: "#060709"
  ink-raised: "#14171C"
  ink-high: "#1D2128"
  silver-glass: "#C0C6CF"
  lime: "#B4F03C"
  lime-hover: "#C8F86C"
  text-primary: "#F3F5F8"
  text-secondary: "#C9CDD4"
  text-muted: "#8E949E"
  severity-critical: "#FF5D5D"
  severity-high: "#FF8C42"
  severity-medium: "#F2C14E"
  severity-low: "#7FB7A4"
  severity-info: "#9AA0AC"
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
    backgroundColor: "{colors.lime}"
    textColor: "{colors.ink-black}"
    rounded: "{rounded.none}"
    padding: "10px 16px"
  button-primary-hover:
    backgroundColor: "{colors.lime-hover}"
    textColor: "{colors.ink-black}"
  button-secondary:
    backgroundColor: "transparent"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.none}"
    padding: "10px 16px"
  field:
    backgroundColor: "{colors.ink-raised}"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.none}"
    padding: "8px 12px"
  tab-active:
    backgroundColor: "{colors.ink-raised}"
    textColor: "{colors.text-primary}"
    padding: "10px 20px 8px"
  tab-inactive:
    backgroundColor: "{colors.silver-glass}"
    textColor: "{colors.ink-black}"
    padding: "10px 20px 8px"
  classification-band:
    backgroundColor: "{colors.silver-glass}"
    textColor: "{colors.ink-black}"
    typography: "{typography.band}"
    padding: "6px 16px"
  severity-badge:
    backgroundColor: "transparent"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.none}"
    padding: "2px 8px"
  priority-p0:
    backgroundColor: "{colors.lime}"
    textColor: "{colors.ink-black}"
    padding: "2px 6px"
  sheet:
    backgroundColor: "{colors.ink-raised}"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.none}"
    padding: "32px"
---

# Design System: ShadowScope

## Overview

**Creative North Star: "The Shadow Dossier"**: the file an outsider keeps on you, read through a scope.

The name splits the system in two. **Shadow** is everything not yet seen: the Ink Black field and the silver redaction tape laid over evidence. **Scope** is the act of bringing one thing into view: the lens mark, the lime reticle that frames each item as it is declassified, and the single P0 it comes to rest on. Every surface should read as moving something out of the shadow and into the scope, one item at a time.

Every surface is a page from the file an outsider would keep on you. The field is Ink Black with a faint silver fiber; content sits on raised ink sheets with a silver hairline edge and a soft drop shadow; text is off-white. Silver Glass is the file's structure: folder tabs, classification bands, rules, labels, redaction tape, and the lines of the infrastructure. Lime is the one live wire: the primary action, focus, the active tab, and the single thing to fix first. Typed exhibits are set in Courier Prime, the body in Public Sans (the U.S. government face), and headings in condensed Archivo, the way a stamp or a form title would be. Classification bands run across the top (and on the landing page, the bottom) of every surface.

Structure comes from rules, not fills. Panels are ruled boxes; tables are ledgers with a heavy silver head rule; summaries are typed ledgers (SUBJECT / SCAN / SOURCES / ON FILE), never hero-metric tiles. Evidence is shown in place and annotated where it sits (a header line, a dotted leader, a note), never summarized into a tinted card.

Density is that of a working document: compact 13 to 14px text in the app, generous 80 to 112px section passes on the landing page. The Persuade surface may tilt and stack sheets inside a silver folder; the Operate surfaces lie flat on one sheet under die-cut folder tabs.

**Key Characteristics:**
- A strict 60 / 30 / 10: Ink Black surfaces, Silver Glass structure, Lime action.
- Square corners everywhere; the die-cut tab, the drawn stamp, and the scope lens are the only other silhouettes.
- Rules and line style carry structure and category; fills are reserved for the bands, tabs, and the folder.
- Lime appears on the primary action, focus, the active tab, the moving scope reticle (which comes to rest on the P0), and once per surface on the P0.
- Condensed Archivo for titles and stamps, Public Sans for prose, Courier Prime for anything collected.

## Colors

Every color is a CSS custom property in `src/styles/globals.css` (`--color-primary`, `--color-secondary`, `--color-accent`, text and severity tokens, plus `--rgb-*` channel triplets). `tailwind.config.js` reads only those variables, so components never carry a literal color.

### 60%: Ink Black (`--color-primary`, Tailwind `ink`)
- **Ink Black** `#0B0D10`: the page field under everything (with the `.grain` fiber), every dominant surface, the browser theme color, and text on lime or silver fills.
- **Ink Deep** `#060709` (`ink-deep`): quiet passages (the rules-of-engagement section) and the graph board.
- **Ink Raised** `#14171C` (`ink-raised`): sheets, fields, detail panels, the active folder tab, chain nodes.
- **Ink High** `#1D2128` (`ink-high`): pressed and hovered control surfaces.

### 30%: Silver Glass (`--color-secondary`, Tailwind `silver`)
Structure and glass: the hairline edge and top sheen of every sheet, classification bands (filled), inactive folder tabs (filled), the landing case-file folder (filled), head rules and section breaks (solid), hairline dividers and ruled boxes (15 to 45% alpha), field borders, secondary-button borders, ledger heads, field labels and dossier metadata keys (SUBJECT, TO, FROM), redaction tape, icons in the wordmark, graph cards and edges, and the faded (non-P0) exposure chains. Never used for paragraphs.

### 10%: Lime (`--color-accent`, Tailwind `lime`)
Action and focus only: primary buttons (ink text), the focus ring, the active folder tab's top edge, the active severity filter, a selected ledger row's rules, the traced path in the attack graph, the live P0 exposure chain, the active scan progress bar, the highest-exposure bar, the P0 chip, and the P0 stamp. Never a background for more than a button-sized area.

### Text
- **Primary** `#F3F5F8` (`fg`): all headings and body text.
- **Secondary** `#C9CDD4` (`fg-soft`): ledes, secondary lines, metadata values.
- **Muted** `#8E949E` (`fg-faint`): placeholders, list numerals, de-emphasized remediation, disabled text (6.4:1 on Ink Black, 5.9:1 on Ink Raised).

### Severity (sanctioned exception)
Severity is semantic, not palette, and is always paired with a text label so it never depends on hue: Critical `#FF5D5D`, High `#FF8C42`, Medium `#F2C14E`, Low `#7FB7A4`, Info `#9AA0AC`. Severity hue appears on the badge border, a square swatch inside the badge, chart bars, and graph card top bands. Badge text stays off-white; Critical earns a 2px border, never a fill. Lime is never a severity color.

### Named Rules
**The 60/30/10 Rule.** Ink owns the surface, silver owns the structure, lime owns the action. If a new element is neither a surface, a structure, nor an action, it is text.

**The One Lime Mark Rule.** A surface carries one lime stamp, on the one item to fix first. The same item may repeat lime in its P0 chip; no second item, heading, or decoration takes the lime stamp.

**The Edge-Not-Hue Rule.** Severity color rides edges, swatches, bars, and lines; the words are neutral and the label is always present.

**The Untinted Panel Rule.** Panels, cards, and memos are raised ink or transparent with silver rules. Hover tints on ledger rows (`silver` at 10 to 15%) are state, not structure.

**The Line-Not-Hue Rule.** Categories that are not severity (environment, priority above P0, inactive paths) are told by line style: solid silver fill for prod, solid outline for staging, dashed for dev, dotted for unknown.

## Typography

**Display Font:** Archivo, variable width, set condensed (`font-stretch: 78%`), with Public Sans fallback
**Body Font:** Public Sans (with ui-sans-serif, system-ui)
**Label/Mono Font:** Courier Prime (with ui-monospace)

All three are self-hosted from `public/fonts/`.

**Character:** A government form set by a typewriter. Archivo condensed at weight 800 reads as stamped titling; Public Sans is the plain civil-service voice; Courier Prime marks everything that was collected rather than written: hostnames, headers, timestamps, IDs, memo routing lines.

### Hierarchy
- **Display** (800, clamp(3.1rem, 7.4vw, 5.6rem), 0.9): the landing hero headline only, max ~11ch, balanced wrap.
- **Headline** (800, clamp(2.3rem, 4.6vw, 3.9rem), 0.92): landing section headings ("Exhibit A: ..."); the closing CTA steps up to clamp(2.6rem, 6vw, 5rem).
- **Title** (800, 2rem to 2.4rem, 1): app page titles (`PageHeader`), document titles ("Case file", "Memorandum", report title), which may be uppercase.
- **Body** (400, 14px app / 15px memos / 1.05rem landing ledes, 1.625): prose, capped at 34 to 70ch.
- **Exhibit** (Courier Prime 400, 13 to 13.5px, 1.625): collected data, evidence blocks, memo headers, hostnames in tables.
- **Label** (600, 11px, 0.09em, uppercase, silver): field labels, ledger heads, and in-sheet section labels ("Findings by severity", "Evidence"). Numbered only when they title a form box in an intake form ("1. Project name"). Never an eyebrow above a heading.
- **Band** (Archivo 700, 11px, 0.22em, uppercase, width 90%): classification bands only.

### Named Rules
**The Typed-Evidence Rule.** If it was collected (a hostname, header, timestamp, advisory ID, package version), it is set in Courier Prime. If it was written (a summary, a remediation, a description), it is Public Sans.

**The Condensed Title Rule.** Display, headline, title, and stamp text are Archivo at weight 800, condensed (78% for titles, 70 to 85% inside stamps and sheet headings). Never set a title in the body face.

**The Neutral Prose Rule.** Paragraphs are off-white or secondary text. Silver and lime never color running text.

## Layout

Two compositions share one material system. The landing page is a 1320px column with `px-16/32px` gutters, two-column asymmetric grids at `lg` (1fr / 1.08fr hero; 0.78fr / 1.22fr and 1.2fr / 0.8fr exhibits), and section passes of 80px (`py-20`), 112px at `lg`, separated by solid 2px silver rules. The app is a 1440px column: header, a row of folder tabs that overlap the sheet by 1px, then one raised ink sheet (`p-16/24/32px` by breakpoint) holding the page.

Inside the sheet, pages stack in 32px rhythm (`space-y-8`), open with a title over a 2px silver rule, and lay sections in two-column grids at `xl`. Detail panels are sticky sheets beside the ledger. Tabs scroll horizontally on narrow screens behind a right-edge fade; the landing nav collapses to the wordmark and one CTA below `md`. Breakpoints are Tailwind defaults.

## Elevation & Depth

Depth comes from ink lightness steps, not new hues: deep for quiet passages and the graph board, the base field, raised for sheets and fields, high for pressed controls. Sheets carry a 1px silver hairline (inset, 16%) and one soft black drop (`sheet`). Nothing inside a sheet is elevated: structure there is rules only. The only other shadow is a small lime-tinted lift under the primary button on hover, released on press. On the landing page the case sheet is filed in a silver folder rotated beneath it, with the subject on the folder tab; the app's sheet is flat and untilted. No glow, no glass.

### Shadow Vocabulary
- **Sheet** (`box-shadow: inset 0 0 0 1px rgb(193 154 107 / 0.16), 0 18px 40px -16px rgb(0 0 0 / 0.65)`): every sheet on the ink field and the landing folder.
- **Lift** (`box-shadow: 0 8px 18px -8px rgb(196 255 31 / 0.35)`): primary button hover only, with a 1px rise.

### Named Rules
**The Sheet-On-Folder Rule.** A shadow means "a sheet is lying in the file." Nothing on a sheet casts a shadow.

## Shapes

Square corners throughout (0 radius): buttons, fields, badges, tabs, sheets, folders. The only silhouette is the die-cut folder tab, a trapezoid clipped 10px in at each top corner (app navigation and the landing folder's label tab). Borders carry meaning by weight and style: 1px hairline for dividers, 1.5px for badges, tags, and chain nodes, 2px for head rules, secondary buttons, and section breaks; dashed for absent or undeclared things (a missing header slot, the "Internet" origin, an empty state, a dev host), dotted for unknown and for annotation leaders. Stamps are the one rounded form, drawn as SVG double rectangles with roughened ink.

## Components

### Buttons
Blunt, typed, square.
- **Primary:** Lime fill, Ink Black text (14.3:1), bold uppercase 14px with 0.06em tracking, 10px by 16px (landing hero CTAs step to 14px by 24px at 15px text).
- **Hover / Focus:** rises 1px to `lime-hover` with the Lift shadow; press returns flat; 150ms ease-out. Focus is the global 2px lime outline at 2px offset. Disabled at 50% opacity with no lift.
- **Secondary:** transparent with a 2px silver border and off-white text; hover adds a 10% silver wash.
- **Text link action:** underlined at 0.2em offset, 1px thickness, hover to lime.

### Chips
- **Severity badge:** 1.5px border in the severity hue, an 8px square swatch in the hue, bold uppercase 11px off-white label at 0.08em. Critical takes a 2px border; no badge is ever filled.
- **Environment tag:** Courier Prime 11px bold uppercase in a 1.5px silver box; prod is filled silver with ink text, staging outlined, dev dashed, unknown dotted muted.
- **Priority chip:** Courier Prime bold; P0 is filled lime with ink text, every other priority is a 1.5px silver outline.
- **Evidence ref:** Courier Prime 13px secondary text in a silver hairline box.

### Cards / Containers
- **Background:** raised ink (sheets, detail panels) or transparent (ruled panels, memos inside a sheet).
- **Shadow Strategy:** Sheet shadow on top-level sheets only.
- **Border:** silver at 20 to 25%; dashed 35 to 40% for empty states and absent memos.
- **Internal Padding:** 20px for panels, 32px to 40px for landing sheets.

### Inputs / Fields
- **Style:** raised ink fill, 1px silver border at 45%, square, 8px by 12px, 14px off-white text, muted placeholder, lime caret.
- **Focus:** border to full silver plus the lime focus outline; hover raises the border to full silver. In boxed intake forms the box takes the lime outline and the bare input inside drops its own.
- **Error:** 2px `severity-critical` border around the message, with "Not created." and the recovery in text.
- **Labels:** the Label style above the field.

### Admin review queue
The AI recommendation is an `AdviceChip`: the recommendation in uppercase text inside a 1.5px edge (silver for approve, severity-medium for needs more info, severity-critical for reject), followed by confidence and source. Text always carries the meaning; the edge only reinforces it. Times in queues and feeds are relative ("12 hr. ago") with the exact timestamp in the title. Signals in the detail panel are a ledger: silver field label, value, and the signal ID in muted mono so Gemini's citations can link to it.

### Navigation
- **Folder tabs (app):** die-cut trapezoids, 14px semibold with a 15px line icon. Active tab is raised ink, joins the sheet beneath it, and carries a 3px lime top edge. Inactive tabs are filled silver with ink text, easing to 80% silver on hover. 150ms color transition.
- **Landing nav:** 14px semibold secondary-text links on the field, lime on hover; hidden below `md`.
- **Wordmark:** `<Logo>` in `src/components/Logo.tsx`, the only place it is drawn. The scope mark (a silver reticle ring with four ticks, its right half filled silver where it has been brought into view, its left half open ink still in shadow, an off-white pupil on the seam) beside condensed uppercase Archivo 800 at 1.35rem: "SHADOW" in muted text (`fg-faint`, it sits in shadow), "SCOPE" in off-white. Screen readers hear one word. The favicon is the same mark on Ink Black with a lime pupil; the favicon is the one place the mark carries lime.

### Ledger (signature)
Tables are ledgers: a 2px silver head rule over 11px uppercase silver headers, silver hairline row dividers at 15%, tabular numerals, Courier Prime for hostnames and IDs. Clickable rows wash silver at 10 to 15% on hover; a selected row is ruled in lime above and below.

### Stamp (signature)
An SVG rubber stamp: double rectangle, Archivo 800 condensed caps, roughened and speckled ink, normal blend (multiply would vanish on ink), rotated -8 to +6 degrees. Tones: `accent` (lime, the P0 only) and `silver` ("Collected passively", "Filed", "No record"). On the landing case sheet the lime stamp lands with a 460ms expo-out scale into a reserved slot so nothing shifts or is covered.

### Scope (signature)
Lime corner brackets (12px, 2px stroke), never a full box, held like a lens in front of the sheet: measured against the unrotated wrapper, so they stay square while the landing case sheet tilts. On the landing case sheet the scope frames each redaction as its tape peels, gliding between items over 300ms on `cubic-bezier(0.16, 1, 0.3, 1)`, and comes to rest on the P0 as the lime stamp lands. It is `aria-hidden`; the evidence itself carries the meaning. Reduced motion shows it already resting on the P0.

At rest (`ScopeFrame` / `ScopeCorners` in `src/components/ScopeFrame.tsx`), the same brackets mark the one item each surface says to act on first: the lead exposure path on the landing page and the #1 "Fix first" item on the scan dashboard. One per surface, always beside the lime P0 stamp it explains. Never a hover or selection style, and never on more than one item.

### Scope mark as a motif
The lens mark also carries the brand where there is nothing to show: empty states show it at 40px and 60% opacity ("nothing in the sights"), the "How it works" steps sit on a silver line as scope marks that brighten from shadow to full silver on the last step, and the final call to action carries it at 24rem and 14% opacity behind the copy (decorative, `lg` and up only).

### Loading and route motion
Skeletons are redaction tape (`.skeleton`): silver at 12% with a slow 1.6s sweep across them, content not yet in view. A route change settles the next page in over 200ms (`.route-in`: fade plus a 4px rise). Both are off under reduced motion.

### Classification Band
A full-width silver strip of ink Band type stating scope ("Passive recon only // ..."). Top of every surface; also the bottom of the landing page. Hidden in print.

### Redaction
Silver tape over values. Inline values peel right-to-left per wrapped line over 560ms on `cubic-bezier(0.16, 1, 0.3, 1)`; whole rows scale out from the right. Text stays in the DOM for screen readers. Selected text also reads as redaction (silver background, ink text). Reduced motion arrives fully declassified.

### Annotated Exhibit
Raw collected output in Courier Prime with notes pinned to the line they describe: a dotted silver leader runs from the code to a fixed-width note column holding a severity badge and one plain sentence. Absent values are drawn as a dashed silver empty slot, not described.

### Infrastructure lines (exposure chains and the attack graph)
Hosts, manifests, packages, and advisories are silver-bordered raised-ink nodes joined by silver lines. The live connection is lime: the P0 chain on the landing page, and the path traced from a selected card in the attack graph (others fade to 12% silver). The root domain node is filled silver with ink text. Scan progress fills lime while a scan is running and silver once it is complete; the collection log states each event's level (info, warn, error) in text.

## Exceptions

- **Print.** Reports print as black ink on white paper (`src/styles/print.css`): every color inside `.print-surface` drops to near-black with gray rules; bands and controls are hidden.
- **Severity.** The five severity hues are semantic, not palette, and always ship with their text label.
- **Focus.** The focus ring is lime everywhere, including on silver and ink fills, for a consistent 2px indicator.
- **Favicon.** `public/favicon.svg` is a static asset and carries literal ink, silver, and lime.

## Do's and Don'ts

### Do:
- **Do** keep the balance: ink surfaces, silver structure, lime only where the user acts or must act first.
- **Do** put every content surface on a raised ink sheet over the grained ink field, with the Sheet shadow.
- **Do** build structure from silver rules: 2px for heads and page titles, 1px hairlines at 15 to 30% for dividers.
- **Do** set collected data in Courier Prime and written prose in Public Sans, in off-white or secondary text.
- **Do** carry severity on borders, swatches, bars, and edges, with a text label every time.
- **Do** tell non-severity categories by line style (filled, solid, dashed, dotted).
- **Do** draw the live path in lime and fade the rest to silver at 30% until hovered.
- **Do** frame every surface with a classification band stating the passive, authorized scope.
- **Do** give every motion a reduced-motion state that shows the finished result.

### Don't:
- **Don't** use lime for large backgrounds, every icon or border, a second stamp, or decoration.
- **Don't** set paragraphs in silver or lime.
- **Don't** introduce purple, pink, cyan, or blue accents, SaaS gradients, glow, or glassmorphism.
- **Don't** hardcode a color in a component; add or reuse a token in `globals.css`.
- **Don't** fill a panel, card, or callout with a tint to group or flag it.
- **Don't** round corners; the only non-rectangular forms are the die-cut tab and the drawn stamp.
- **Don't** cast shadows inside a sheet or use hard offset shadows.
- **Don't** set titles in Public Sans or uncondensed Archivo.
