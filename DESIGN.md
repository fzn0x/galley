---
name: Galley
description: A Crouwel-grid workbench that converts Markdown to LaTeX and shows its construction.
colors:
  crouwel-blue: "#0057FF"
  blue-press: "#0046CC"
  on-blue: "#FFFFFF"
  ink: "#111111"
  ink-secondary: "#3A4253"
  muted: "#5A6478"
  faint: "#A9B2C3"
  paper: "#FFFFFF"
  surface: "#F5F7FA"
  grid: "#E6EBF2"
  grid-strong: "#D3DBE7"
  signal: "#D7320F"
  token-env: "#0040BD"
  token-quiet: "#8691A6"
  night-blue: "#4D8DFF"
  night-blue-press: "#3B7BF0"
  night-on-blue: "#0B0D12"
  night-ink: "#EDF1F7"
  night-ink-secondary: "#C3CBD9"
  night-muted: "#9AA4B8"
  night-faint: "#566074"
  night-paper: "#111111"
  night-surface: "#1A1A1A"
  night-grid: "#1C222D"
  night-grid-strong: "#283040"
  night-signal: "#FF6A45"
  night-token-cmd: "#6EA3FF"
typography:
  numeral:
    fontFamily: "Kode Mono, ui-monospace, SFMono-Regular, Menlo, Consolas, monospace"
    fontSize: "28px"
    fontWeight: 700
    lineHeight: "34px"
    fontFeature: "tnum"
  headline:
    fontFamily: "Archivo, Helvetica Neue, Arial, sans-serif"
    fontSize: "20px"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "-0.01em"
  title:
    fontFamily: "Archivo, Helvetica Neue, Arial, sans-serif"
    fontSize: "16px"
    fontWeight: 700
    lineHeight: 1.45
  body:
    fontFamily: "Archivo, Helvetica Neue, Arial, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.45
  control:
    fontFamily: "Archivo, Helvetica Neue, Arial, sans-serif"
    fontSize: "13.5px"
    fontWeight: 600
    lineHeight: 1.45
  label:
    fontFamily: "Archivo, Helvetica Neue, Arial, sans-serif"
    fontSize: "12px"
    fontWeight: 700
    lineHeight: 1
    letterSpacing: "0.1em"
    fontVariation: "'wdth' 80"
  code:
    fontFamily: "Kode Mono, ui-monospace, SFMono-Regular, Menlo, Consolas, monospace"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: "24px"
    fontFeature: "tnum, liga 0"
  meta:
    fontFamily: "Kode Mono, ui-monospace, SFMono-Regular, Menlo, Consolas, monospace"
    fontSize: "12px"
    fontWeight: 400
    lineHeight: 1
    fontFeature: "tnum"
rounded:
  none: "0px"
spacing:
  hair: "2px"
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  module: "24px"
  gutter: "52px"
components:
  button-primary:
    backgroundColor: "{colors.crouwel-blue}"
    textColor: "{colors.on-blue}"
    typography: "{typography.control}"
    rounded: "{rounded.none}"
    padding: "0 10px 0 14px"
    height: "36px"
  button-primary-hover:
    backgroundColor: "{colors.blue-press}"
    textColor: "{colors.on-blue}"
  button-outline:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    typography: "{typography.control}"
    rounded: "{rounded.none}"
    padding: "0 14px"
    height: "36px"
  button-outline-hover:
    textColor: "{colors.crouwel-blue}"
  button-quiet:
    textColor: "{colors.ink}"
    typography: "{typography.control}"
    rounded: "{rounded.none}"
    padding: "0 10px"
    height: "36px"
  button-quiet-hover:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.crouwel-blue}"
  tool:
    textColor: "{colors.ink-secondary}"
    rounded: "{rounded.none}"
    padding: "0 8px"
    height: "28px"
  segmented:
    textColor: "{colors.crouwel-blue}"
    rounded: "{rounded.none}"
    padding: "0 12px"
    height: "28px"
  segmented-selected:
    backgroundColor: "{colors.crouwel-blue}"
    textColor: "{colors.on-blue}"
  select:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.none}"
    padding: "0 34px 0 12px"
    height: "36px"
  pane-head:
    backgroundColor: "{colors.paper}"
    padding: "0 8px 0 16px"
    height: "40px"
  construction-cell:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    padding: "11px 10px 10px 12px"
    width: "96px"
  construction-cell-selected:
    backgroundColor: "{colors.crouwel-blue}"
    textColor: "{colors.on-blue}"
  sheet:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.none}"
    width: "460px"
  toast:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.paper}"
    rounded: "{rounded.none}"
    padding: "10px 16px 10px 10px"
---

# Design System: Galley

## Overview

**Creative North Star: "The Crouwel Grid Specimen"**

Galley is a workbench drawn on graph paper. Every surface sits on a 24px module (the code's line height snaps to it), every structural division is a 1px Crouwel-blue rule, and the whole interface reads like a type specimen sheet from a grid-minded studio: white ground, faint blue-grey hairlines, ink text, one saturated blue. LaTeX is built on a grid, and the interface shows the construction. Turning Construction on reveals every character Galley set or normalised as a blue cell.

Density is that of a working tool, not a page: a 56px top bar, two equal panes with 40px heads, a 104px Construction band and a 28px status bar fill the viewport exactly. Nothing floats except the docked sheets and the toast. The system refuses both the grey split editor with a lone Convert button and the cream-paper "LaTeX look"; it is cool, square, and exact.

There is one diagonal in the whole world: LaTeX's backslash. It is the mark, it rides on the primary button, it cancels removed invisible characters, and it leans the selected fill of every segmented control. Everything else is orthogonal.

**Key Characteristics:**
- Graph paper on a 24px module, with a line-number gutter strip.
- One blue for every rule, label, selection and the primary action; ink for text.
- Square corners everywhere; 1px rules instead of cards.
- One diagonal only: the backslash, leaning right-to-left like `\`.
- Archivo for UI (condensed tracked caps for labels), Kode Mono for code and numerals.
- Day ground white; night ground ink with a blue-black grid and a lifted blue.

## Colors

One saturated blue against a cool neutral ladder; a single warm signal is reserved for notes that need checking.

### Primary
- **Crouwel Blue** (crouwel-blue): structural rules (top-bar underline, pane divider, band top, sheet edge), pane and band labels, segmented controls, selection, caret, focus outline, line-link markers, Construction marks and the primary action. Pressed state uses **Pressed Blue** (blue-press). At night it lifts to **Night Blue** (night-blue) so it holds contrast on ink; text on blue flips to near-black (night-on-blue).
- **Environment Blue** (token-env): the deeper blue for `\begin`/`\end` environment names in highlighted LaTeX.

### Secondary
- **Signal Red** (signal; night-signal at night): only for the Notes cell when there are notes to check, with an 8% wash behind it. Never decorative.

### Neutral
- **Paper** (paper): the ground of panes, top bar, band and sheets. At night: **Ink Ground** (night-paper).
- **Second Layer** (surface): gutter strip, status bar, preamble strip, stale notice, sheet foot, quiet hover. At night: night-surface.
- **Graph Line** (grid): the 24px graph-paper hairlines and the lightest row dividers. At night the grid turns blue-black (night-grid).
- **Strong Line** (grid-strong): pane-head and status rules, input borders, scrollbar thumb, inactive dots. At night: night-grid-strong.
- **Ink** (ink): body text and the outline button stroke. **Ink Secondary** (ink-secondary): tools and secondary copy. **Muted** (muted): meta and descriptions. **Faint** (faint): line numbers and disabled. Night equivalents carry the `night-` prefix.
- **Quiet Token** (token-quiet): braces, Markdown delimiters and comments in highlighting.

Translucent blue washes (9% for hover and linked lines, 18% for textarea selection, 11% for Construction marks, 6% for math spans) are derived from the blue, not separate colors.

### Named Rules
**The One Blue Rule.** Crouwel Blue is the only chromatic voice. Structure, labels, state and action all speak it; signal red appears only when a note needs the reader.

**The Rule-Not-Box Rule.** Divisions are drawn with 1px lines (blue for structural seams, strong line for sub-divisions, graph line for rows). No filled cards.

## Typography

**Display Font:** none; the largest type is a numeral.
**Body Font:** Archivo (with Helvetica Neue, Arial), variable weight 400-800 and width 62-125%.
**Label/Mono Font:** Kode Mono (with ui-monospace, SFMono-Regular, Menlo, Consolas), weight 400-700.

**Character:** Archivo's width axis lets one family carry both the plain UI and the condensed, tracked capitals of a specimen sheet; Kode Mono's square grotesque monospace sets the code and every number, so counts read like gauge readings.

### Hierarchy
- **Numeral** (Kode Mono 700, 28px, 34px line): Construction cell counts; 22px for the band total. Tabular figures.
- **Headline** (Archivo 700, 20px, -0.01em): sheet titles only.
- **Title** (Archivo 700, 16px): empty-state title, drop-zone message.
- **Body** (Archivo 400, 14px, 1.45): UI text; descriptions cap at 46-52ch.
- **Control** (Archivo 600, 13.5px): buttons, switches, selects. Tools use 12.5px 500.
- **Label** (Archivo 700, 11-12px, width 78-80%, 0.07-0.1em tracking, uppercase, blue): pane titles, band title, rule-group headings, cell labels, preamble label, the brand sub-line.
- **Code** (Kode Mono 400, 14px, 24px line, ligatures off, tabular): input mirror and output. The line height is the module.
- **Meta** (Kode Mono 400, 11.5-12px): line numbers, counts, positions, kbd.

### Named Rules
**The Numbers Are Mono Rule.** Every count, position, line number and shortcut is Kode Mono with tabular figures.

**The Labels Are Condensed Caps Rule.** Section labels are Archivo condensed (78-80% width), bold, tracked uppercase, in blue. They name the thing they sit on; they are never decorative lead-ins above headlines.

## Layout

The app is a full-viewport grid: 56px top bar, a two-column work area of equal panes, a 104px Construction band, a 28px status bar. The band's columns are a 184px lead (title, total, n-of-N stepper), a horizontally scrolling row of kind cells (min 96px each, scroll-snapped), and a 132px Notes cell.

The 24px module governs the panes: graph-paper squares, code line height, the empty state's top offset (two modules), and the bottom scroll padding (four modules). The gutter is 52px (40px on mobile) with a second-layer strip and a strong-line edge. Spacing steps are 2/4/8/12/16/24px.

**Pane heads.** Markdown: title, line counts, Open and Clear. LaTeX: title, the Fragment/Document segmented control, the Construction switch, and a .tex download. Copy LaTeX lives in the top bar as the primary placement next to Convert, not in the pane head (a deliberate adaptation of the first sketch). In Fragment mode a preamble strip sits under the output with a Copy lines tool.

**Sheets are non-modal docked panels** below the top bar (top 56px to bottom): Rules docks left over the Markdown pane (460px), Notes and Keyboard dock right (400px). Convert, Copy and the uncovered pane stay live.

**Responsive.** At 1180px the brand sub-line and the Convert shortcut hint drop and the band columns tighten (156/116px). At 960px some labels collapse to icons. At 820px and below: a 52px top bar, a 44px tab row with a full-width segmented control (Markdown / LaTeX / Changes with count), one pane at a time, the band becomes the Changes tab as a wrapping cell grid, the status bar hides, and the top actions move into a fixed 60px bottom action bar (blue top rule, safe-area padded, Convert pushed right at 40px tall). Sheets go full-width between the top bar and the action bar, without shadow.

### Named Rules
**The Module Rule.** Vertical rhythm in code surfaces is 24px. Anything placed on graph paper aligns to it.

## Elevation & Depth

Flat. Depth comes from 1px rules and the second neutral layer, not shadows. The only shadows belong to overlays that genuinely sit above the work: the docked sheets and the toast.

### Shadow Vocabulary
- **Overlay** (`box-shadow: 0 12px 32px -8px rgba(17,24,39,0.24), 0 2px 6px rgba(17,24,39,0.08)`; night `0 16px 40px -8px rgba(0,0,0,0.6), 0 2px 8px rgba(0,0,0,0.4)`): sheets and toast only.

### Named Rules
**The Overlays-Only Rule.** A shadow means "this floats above the work". Panes, buttons, cells and fields never carry one.

## Shapes

Square corners throughout (0px), including selects, switches (square track and thumb), status dots, dot strips and the changed-rule marker. Fields and outline buttons take a 1px stroke; the switch track 1.5px.

The single diagonal is the backslash. It appears in the mark, as the slash glyph on the primary button, as the cancel tick through removed invisible characters (a top-left to bottom-right stroke in a 9x18px slot), and as the selected fill of segmented controls and tabs: a parallelogram skewed `skewX(18deg)` so it leans like `\`. The segment group clips to its square outer frame, so outer edges stay square and only inner edges carry the lean.

### Named Rules
**The One Diagonal Rule.** The backslash is the only diagonal: mark, primary button, invisible-character cancel tick, selected segment fill. No other diagonals, slants, or rotated elements.

## Components

### Buttons
Square, compact, decisive.
- **Shape:** square (0px), 36px tall (40px in the mobile action bar).
- **Primary:** blue fill, on-blue text, Archivo 600 13.5px, a kbd hint in a 45% on-blue stroke, and the backslash glyph at the end. Hover darkens to pressed blue; active nudges down 1px; focus outline turns ink.
- **Outline:** paper fill with a 1px ink stroke; hover turns stroke and text blue. Used for Copy LaTeX and sheet secondary actions.
- **Quiet:** no stroke; hover fills the second layer and turns text blue.
- **Done state:** after copy, the button inverts to ink fill with paper text.
- **Icon buttons:** 36px square (28px small), ink-secondary icons 20px (16px), hover second layer plus blue.
- **Tools:** 28px pane-head actions, 12.5px 500, hover blue text on a blue wash.
- **Link buttons:** blue, underlined at 1px, thickening to 2px on hover.

### Segmented Control / Tabs
- **Style:** 1px blue frame, 28px tall (30px as mobile tabs), blue Archivo 600 12.5px labels.
- **Selected:** a blue backslash-leaning parallelogram fill grows in (scaleX, 160ms) behind on-blue text; first and last segments extend their fill past the clipped frame so outer edges read square.
- **Hover:** unselected segments take the blue wash. Focus: 2px ink inset outline.

### Switch
- **Style:** square 34x18px track with 1.5px ink stroke and an 11px square ink thumb; small variant 28x16px.
- **On:** track fills blue, thumb turns on-blue and slides; the small switch's label turns blue. Hover turns the stroke blue.

### Inputs / Fields
- **Select:** square, 1px strong-line stroke, paper fill, 36px (32px in Rules); hover stroke ink; focus stroke blue with the standard outline.
- **Editor:** a transparent textarea over a highlighted mirror on graph paper; blue caret; focus draws a 1px blue inset frame.

### Pane Head
40px strip on paper with a strong-line bottom rule: blue condensed-caps title, Kode Mono meta, tools pushed right.

### Construction Band (signature)
One cell per kind of change plus a Notes cell. Each cell stacks a blue condensed-caps label (11px, 78% width), a Kode Mono 700 28px numeral, and a 16-dot position strip (4px square dots, 2px gap; strong-line off, blue on). Selecting a kind fills the whole cell blue with on-blue label, numeral and dots. Cells fill in short stepped transitions (120ms, `steps(2)`); numerals switch without easing. Disabled kinds go faint with a regular-weight numeral. The Notes cell turns signal red with its wash when notes exist. With Construction on, marks in the output take an 11% blue background with a 1.5px blue underline; the focused kind fills solid blue; the current occurrence takes a 2px ink outline.

### Sheets
Non-modal docked panels with a 1px blue edge on the open side and the overlay shadow, sliding 24px in over 220ms. Head: 20px headline with muted sub-line and a close icon; foot: second layer with outline and primary actions. Rule groups use the blue label style; rows divide with graph lines; a changed rule shows a 6px blue square after its name.

### Toast
Ink fill, paper text, overlay shadow, a blue square icon tile, centred above the band.

## Do's and Don'ts

### Do:
- **Do** snap code line height and graph paper to the 24px module.
- **Do** draw structure with 1px Crouwel Blue rules and sub-divisions with the strong line.
- **Do** set every count, position and line number in Kode Mono with tabular figures.
- **Do** label panes and groups with Archivo condensed, bold, tracked blue capitals that name the region.
- **Do** keep sheets non-modal and docked so Convert and Copy stay live.
- **Do** keep Copy LaTeX in the top bar beside Convert; the LaTeX pane head carries shape, Construction and .tex download.
- **Do** honour reduced motion by removing all transitions and animations.

### Don't:
- **Don't** round corners anywhere.
- **Don't** introduce a second accent; signal red is only for notes that need checking.
- **Don't** use any diagonal other than the backslash (mark, primary button, invisible cancel tick, selected segment fill).
- **Don't** put shadows on anything that is not a docked sheet or the toast.
- **Don't** drift toward cream paper, serif "LaTeX look" styling, or a grey split editor.
- **Don't** place uppercase labels as decorative lead-ins above headings.
