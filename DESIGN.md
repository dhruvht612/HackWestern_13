---
name: ShadowScope
description: The file an attacker keeps on you, kept as a dark intelligence dossier.
colors:
  abyss-navy: "#1A2236"
  navy-deep: "#121929"
  navy-raised: "#212A40"
  navy-high: "#29334C"
  camel-suede: "#C19A6B"
  electric-kiwi: "#C4FF1F"
  kiwi-hover: "#D3FF5C"
  text-primary: "#F8F7F3"
  text-secondary: "#D1D5DB"
  text-muted: "#9AA0AC"
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
    backgroundColor: "{colors.electric-kiwi}"
    textColor: "{colors.abyss-navy}"
    rounded: "{rounded.none}"
    padding: "10px 16px"
  button-primary-hover:
    backgroundColor: "{colors.kiwi-hover}"
    textColor: "{colors.abyss-navy}"
  button-secondary:
    backgroundColor: "transparent"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.none}"
    padding: "10px 16px"
  field:
    backgroundColor: "{colors.navy-raised}"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.none}"
    padding: "8px 12px"
  tab-active:
    backgroundColor: "{colors.navy-raised}"
    textColor: "{colors.text-primary}"
    padding: "10px 20px 8px"
  tab-inactive:
    backgroundColor: "{colors.camel-suede}"
    textColor: "{colors.abyss-navy}"
    padding: "10px 20px 8px"
  classification-band:
    backgroundColor: "{colors.camel-suede}"
    textColor: "{colors.abyss-navy}"
    typography: "{typography.band}"
    padding: "6px 16px"
  severity-badge:
    backgroundColor: "transparent"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.none}"
    padding: "2px 8px"
  priority-p0:
    backgroundColor: "{colors.electric-kiwi}"
    textColor: "{colors.abyss-navy}"
    padding: "2px 6px"
  sheet:
    backgroundColor: "{colors.navy-raised}"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.none}"
    padding: "32px"
---

# Design System: ShadowScope

## Overview

**Creative North Star: "The Attacker's Dossier"**, kept as a dark intelligence file.

Every surface is a page from the file an outsider would keep on you. The field is Abyss Navy with a faint camel fiber; content sits on raised navy sheets with a camel hairline edge and a soft drop shadow; text is off-white. Camel Suede is the file's structure: folder tabs, classification bands, rules, labels, redaction tape, and the lines of the infrastructure. Electric Kiwi is the one live wire: the primary action, focus, the active tab, and the single thing to fix first. Typed exhibits are set in Courier Prime, the body in Public Sans (the U.S. government face), and headings in condensed Archivo, the way a stamp or a form title would be. Classification bands run across the top (and on the landing page, the bottom) of every surface.

Structure comes from rules, not fills. Panels are ruled boxes; tables are ledgers with a heavy camel head rule; summaries are typed ledgers (SUBJECT / SCAN / SOURCES / ON FILE), never hero-metric tiles. Evidence is shown in place and annotated where it sits (a header line, a dotted leader, a note), never summarized into a tinted card.

Density is that of a working document: compact 13 to 14px text in the app, generous 80 to 112px section passes on the landing page. The Persuade surface may tilt and stack sheets inside a camel folder; the Operate surfaces lie flat on one sheet under die-cut folder tabs.

**Key Characteristics:**
- A strict 60 / 30 / 10: Abyss Navy surfaces, Camel Suede structure, Electric Kiwi action.
- Square corners everywhere; the die-cut tab and the drawn stamp are the only other silhouettes.
- Rules and line style carry structure and category; fills are reserved for the bands, tabs, and the folder.
- Kiwi appears on the primary action, focus, the active tab, and once per surface on the P0.
- Condensed Archivo for titles and stamps, Public Sans for prose, Courier Prime for anything collected.

## Colors

Every color is a CSS custom property in `src/styles/globals.css` (`--color-primary`, `--color-secondary`, `--color-accent`, text and severity tokens, plus `--rgb-*` channel triplets). `tailwind.config.js` reads only those variables, so components never carry a literal color.

### 60%: Abyss Navy (`--color-primary`, Tailwind `navy`)
- **Abyss Navy** `#1A2236`: the page field under everything (with the `.grain` fiber), every dominant surface, the browser theme color, and text on kiwi or camel fills.
- **Navy Deep** `#121929` (`navy-deep`): quiet passages (the rules-of-engagement section) and the graph board.
- **Navy Raised** `#212A40` (`navy-raised`): sheets, fields, detail panels, the active folder tab, chain nodes.
- **Navy High** `#29334C` (`navy-high`): pressed and hovered control surfaces.

### 30%: Camel Suede (`--color-secondary`, Tailwind `camel`)
Structure and warmth: classification bands (filled), inactive folder tabs (filled), the landing case-file folder (filled), head rules and section breaks (solid), hairline dividers and ruled boxes (15 to 45% alpha), field borders, secondary-button borders, ledger heads, field labels and dossier metadata keys (SUBJECT, TO, FROM), redaction tape, icons in the wordmark, graph cards and edges, and the faded (non-P0) exposure chains. Never used for paragraphs.

### 10%: Electric Kiwi (`--color-accent`, Tailwind `kiwi`)
Action and focus only: primary buttons (navy text), the focus ring, the active folder tab's top edge, the active severity filter, a selected ledger row's rules, the traced path in the attack graph, the live P0 exposure chain, the active scan progress bar, the highest-exposure bar, the P0 chip, and the P0 stamp. Never a background for more than a button-sized area.

### Text
- **Primary** `#F8F7F3` (`fg`): all headings and body text.
- **Secondary** `#D1D5DB` (`fg-soft`): ledes, secondary lines, metadata values.
- **Muted** `#9AA0AC` (`fg-faint`): placeholders, list numerals, de-emphasized remediation, disabled text (6.2:1 on Abyss Navy).

### Severity (sanctioned exception)
Severity is semantic, not palette, and is always paired with a text label so it never depends on hue: Critical `#FF5D5D`, High `#FF8C42`, Medium `#F2C14E`, Low `#7FB7A4`, Info `#9AA0AC`. Severity hue appears on the badge border, a square swatch inside the badge, chart bars, and graph card top bands. Badge text stays off-white; Critical earns a 2px border, never a fill. Kiwi is never a severity color.

### Named Rules
**The 60/30/10 Rule.** Navy owns the surface, camel owns the structure, kiwi owns the action. If a new element is neither a surface, a structure, nor an action, it is text.

**The One Kiwi Mark Rule.** A surface carries one kiwi stamp, on the one item to fix first. The same item may repeat kiwi in its P0 chip; no second item, heading, or decoration takes the kiwi stamp.

**The Edge-Not-Hue Rule.** Severity color rides edges, swatches, bars, and lines; the words are neutral and the label is always present.

**The Untinted Panel Rule.** Panels, cards, and memos are raised navy or transparent with camel rules. Hover tints on ledger rows (`camel` at 10 to 15%) are state, not structure.

**The Line-Not-Hue Rule.** Categories that are not severity (environment, priority above P0, inactive paths) are told by line style: solid camel fill for prod, solid outline for staging, dashed for dev, dotted for unknown.

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
- **Label** (600, 11px, 0.09em, uppercase, camel): field labels, ledger heads, and in-sheet section labels ("Findings by severity", "Evidence"). Numbered only when they title a form box in an intake form ("1. Project name"). Never an eyebrow above a heading.
- **Band** (Archivo 700, 11px, 0.22em, uppercase, width 90%): classification bands only.

### Named Rules
**The Typed-Evidence Rule.** If it was collected (a hostname, header, timestamp, advisory ID, package version), it is set in Courier Prime. If it was written (a summary, a remediation, a description), it is Public Sans.

**The Condensed Title Rule.** Display, headline, title, and stamp text are Archivo at weight 800, condensed (78% for titles, 70 to 85% inside stamps and sheet headings). Never set a title in the body face.

**The Neutral Prose Rule.** Paragraphs are off-white or secondary text. Camel and kiwi never color running text.

## Layout

Two compositions share one material system. The landing page is a 1320px column with `px-16/32px` gutters, two-column asymmetric grids at `lg` (1fr / 1.08fr hero; 0.78fr / 1.22fr and 1.2fr / 0.8fr exhibits), and section passes of 80px (`py-20`), 112px at `lg`, separated by solid 2px camel rules. The app is a 1440px column: header, a row of folder tabs that overlap the sheet by 1px, then one raised navy sheet (`p-16/24/32px` by breakpoint) holding the page.

Inside the sheet, pages stack in 32px rhythm (`space-y-8`), open with a title over a 2px camel rule, and lay sections in two-column grids at `xl`. Detail panels are sticky sheets beside the ledger. Tabs scroll horizontally on narrow screens behind a right-edge fade; the landing nav collapses to the wordmark and one CTA below `md`. Breakpoints are Tailwind defaults.

## Elevation & Depth

Depth comes from navy lightness steps, not new hues: deep for quiet passages and the graph board, the base field, raised for sheets and fields, high for pressed controls. Sheets carry a 1px camel hairline (inset, 16%) and one soft black drop (`sheet`). Nothing inside a sheet is elevated: structure there is rules only. The only other shadow is a small kiwi-tinted lift under the primary button on hover, released on press. On the landing page the case sheet is filed in a camel folder rotated beneath it, with the subject on the folder tab; the app's sheet is flat and untilted. No glow, no glass.

### Shadow Vocabulary
- **Sheet** (`box-shadow: inset 0 0 0 1px rgb(193 154 107 / 0.16), 0 18px 40px -16px rgb(0 0 0 / 0.65)`): every sheet on the navy field and the landing folder.
- **Lift** (`box-shadow: 0 8px 18px -8px rgb(196 255 31 / 0.35)`): primary button hover only, with a 1px rise.

### Named Rules
**The Sheet-On-Folder Rule.** A shadow means "a sheet is lying in the file." Nothing on a sheet casts a shadow.

## Shapes

Square corners throughout (0 radius): buttons, fields, badges, tabs, sheets, folders. The only silhouette is the die-cut folder tab, a trapezoid clipped 10px in at each top corner (app navigation and the landing folder's label tab). Borders carry meaning by weight and style: 1px hairline for dividers, 1.5px for badges, tags, and chain nodes, 2px for head rules, secondary buttons, and section breaks; dashed for absent or undeclared things (a missing header slot, the "Internet" origin, an empty state, a dev host), dotted for unknown and for annotation leaders. Stamps are the one rounded form, drawn as SVG double rectangles with roughened ink.

## Components

### Buttons
Blunt, typed, square.
- **Primary:** Electric Kiwi fill, Abyss Navy text (13:1), bold uppercase 14px with 0.06em tracking, 10px by 16px (landing hero CTAs step to 14px by 24px at 15px text).
- **Hover / Focus:** rises 1px to `kiwi-hover` with the Lift shadow; press returns flat; 150ms ease-out. Focus is the global 2px kiwi outline at 2px offset. Disabled at 50% opacity with no lift.
- **Secondary:** transparent with a 2px camel border and off-white text; hover adds a 10% camel wash.
- **Text link action:** underlined at 0.2em offset, 1px thickness, hover to kiwi.

### Chips
- **Severity badge:** 1.5px border in the severity hue, an 8px square swatch in the hue, bold uppercase 11px off-white label at 0.08em. Critical takes a 2px border; no badge is ever filled.
- **Environment tag:** Courier Prime 11px bold uppercase in a 1.5px camel box; prod is filled camel with navy text, staging outlined, dev dashed, unknown dotted muted.
- **Priority chip:** Courier Prime bold; P0 is filled kiwi with navy text, every other priority is a 1.5px camel outline.
- **Evidence ref:** Courier Prime 13px secondary text in a camel hairline box.

### Cards / Containers
- **Background:** raised navy (sheets, detail panels) or transparent (ruled panels, memos inside a sheet).
- **Shadow Strategy:** Sheet shadow on top-level sheets only.
- **Border:** camel at 20 to 25%; dashed 35 to 40% for empty states and absent memos.
- **Internal Padding:** 20px for panels, 32px to 40px for landing sheets.

### Inputs / Fields
- **Style:** raised navy fill, 1px camel border at 45%, square, 8px by 12px, 14px off-white text, muted placeholder, kiwi caret.
- **Focus:** border to full camel plus the kiwi focus outline; hover raises the border to full camel. In boxed intake forms the box takes the kiwi outline and the bare input inside drops its own.
- **Error:** 2px `severity-critical` border around the message, with "Not created." and the recovery in text.
- **Labels:** the Label style above the field.

### Navigation
- **Folder tabs (app):** die-cut trapezoids, 14px semibold with a 15px line icon. Active tab is raised navy, joins the sheet beneath it, and carries a 3px kiwi top edge. Inactive tabs are filled camel with navy text, easing to 80% camel on hover. 150ms color transition.
- **Landing nav:** 14px semibold secondary-text links on the field, kiwi on hover; hidden below `md`.
- **Wordmark:** a camel folder glyph with navy lines beside condensed uppercase "ShadowScope" at 800.

### Ledger (signature)
Tables are ledgers: a 2px camel head rule over 11px uppercase camel headers, camel hairline row dividers at 15%, tabular numerals, Courier Prime for hostnames and IDs. Clickable rows wash camel at 10 to 15% on hover; a selected row is ruled in kiwi above and below.

### Stamp (signature)
An SVG rubber stamp: double rectangle, Archivo 800 condensed caps, roughened and speckled ink, normal blend (multiply would vanish on navy), rotated -8 to +6 degrees. Tones: `accent` (kiwi, the P0 only) and `camel` ("Collected passively", "Filed", "No record"). On the landing case sheet the kiwi stamp lands with a 460ms expo-out scale into a reserved slot so nothing shifts or is covered.

### Classification Band
A full-width camel strip of navy Band type stating scope ("Passive recon only // ..."). Top of every surface; also the bottom of the landing page. Hidden in print.

### Redaction
Camel tape over values. Inline values peel right-to-left per wrapped line over 560ms on `cubic-bezier(0.16, 1, 0.3, 1)`; whole rows scale out from the right. Text stays in the DOM for screen readers. Selected text also reads as redaction (camel background, navy text). Reduced motion arrives fully declassified.

### Annotated Exhibit
Raw collected output in Courier Prime with notes pinned to the line they describe: a dotted camel leader runs from the code to a fixed-width note column holding a severity badge and one plain sentence. Absent values are drawn as a dashed camel empty slot, not described.

### Infrastructure lines (exposure chains and the attack graph)
Hosts, manifests, packages, and advisories are camel-bordered raised-navy nodes joined by camel lines. The live connection is kiwi: the P0 chain on the landing page, and the path traced from a selected card in the attack graph (others fade to 12% camel). The root domain node is filled camel with navy text. Scan progress fills kiwi while a scan is running and camel once it is complete; the collection log states each event's level (info, warn, error) in text.

## Exceptions

- **Print.** Reports print as black ink on white paper (`src/styles/print.css`): every color inside `.print-surface` drops to near-black with gray rules; bands and controls are hidden.
- **Severity.** The five severity hues are semantic, not palette, and always ship with their text label.
- **Focus.** The focus ring is kiwi everywhere, including on camel and navy fills, for a consistent 2px indicator.
- **Favicon.** `public/favicon.svg` is a static asset and carries literal navy, camel, and kiwi.

## Do's and Don'ts

### Do:
- **Do** keep the balance: navy surfaces, camel structure, kiwi only where the user acts or must act first.
- **Do** put every content surface on a raised navy sheet over the grained navy field, with the Sheet shadow.
- **Do** build structure from camel rules: 2px for heads and page titles, 1px hairlines at 15 to 30% for dividers.
- **Do** set collected data in Courier Prime and written prose in Public Sans, in off-white or secondary text.
- **Do** carry severity on borders, swatches, bars, and edges, with a text label every time.
- **Do** tell non-severity categories by line style (filled, solid, dashed, dotted).
- **Do** draw the live path in kiwi and fade the rest to camel at 30% until hovered.
- **Do** frame every surface with a classification band stating the passive, authorized scope.
- **Do** give every motion a reduced-motion state that shows the finished result.

### Don't:
- **Don't** use kiwi for large backgrounds, every icon or border, a second stamp, or decoration.
- **Don't** set paragraphs in camel or kiwi.
- **Don't** introduce purple, pink, cyan, or blue accents, SaaS gradients, glow, or glassmorphism.
- **Don't** hardcode a color in a component; add or reuse a token in `globals.css`.
- **Don't** fill a panel, card, or callout with a tint to group or flag it.
- **Don't** round corners; the only non-rectangular forms are the die-cut tab and the drawn stamp.
- **Don't** cast shadows inside a sheet or use hard offset shadows.
- **Don't** set titles in Public Sans or uncondensed Archivo.
