# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Static HTML/CSS/JS, matching the maintainer's earlier tool (clojure-map-formatter): no build step, no runtime dependencies, classic scripts so `index.html` works from `file://`, Node's built-in test runner for the engine, MIT license, deployed to GitHub Pages under `fzn0x/<brand-name>`.

## Users

A general-purpose converter whose defaults favour long-form archival text (confirmed: all of these):

- Transcribers and editors turning historical or archival material (books, letters, poems, manuscripts) into LaTeX editions. They paste long passages, often copied from PDFs, word processors, or OCR, and need output that compiles first time.
- Academics and students drafting papers, theses, or notes in Markdown, then pasting the LaTeX into an existing document or Overleaf.
- Writers and poets drafting prose and verse in Markdown and typesetting it as a book or chapbook.

## Product Purpose

Convert common Markdown structures into clean LaTeX: `\textit`, `\textbf`, sectioning, `enumerate`/`itemize`, tables, blockquotes, verse wrappers, and the rest of everyday writing. Two panels, Markdown in and LaTeX out, with quick convert and copy, keyboard shortcuts, and an optional real-time mode. Success means pasted text comes out as LaTeX that compiles without hand repair, typographically correct (ellipses, quotes, dashes, abbreviation spacing), with nothing silently lost.

## Positioning

A Markdown-to-LaTeX interpreter with typesetter's defaults for long-form and archival text, not a generic document converter: it normalises the small things that break or uglify LaTeX after copy-paste (special characters, ellipses, shorthand like `e.g.`/`ca.`/`p. 12`, invisible Unicode) and shows its work, so an editor can trust that only markup changed.

## Operating Context

Used beside a LaTeX editor (local TeX distribution or Overleaf) and a source document: a PDF, scan transcription, word-processor file, or a Markdown draft. Input arrives by paste or file drop; output leaves by copy or `.tex` download into an existing document's body, or as a standalone file.

## Capabilities and Constraints

- Default output is a body-only LaTeX fragment; an optional toggle wraps it in a full compilable document whose preamble lists only the packages the output needs.
- Must cover: italic/bold, headings, ordered and unordered lists (nested), tables, blockquotes, verse wrappers. Further structures (footnotes, links, images, code, math passthrough, scene breaks) are in scope as additions.
- Archival defaults: cleaner ellipsis handling, consistent shorthand normalisation, reliable escaping of LaTeX special characters, and cleanup of copy-paste artefacts.
- Interaction: convert and copy actions, keyboard shortcuts, optional real-time conversion toggle.
- Runs fully client-side; nothing is sent anywhere.
- Name and logo: delegated to this build (the user asked for both to be created).

## Evidence on Hand

None. No users, testimonials, metrics, or adoption figures exist; do not fabricate any. Example texts shipped in the tool must be public-domain or synthetic.

## Product Principles

1. Compiles first time: escaping and normalisation exist so pasted text never breaks a LaTeX run.
2. Show the work: every normalisation is visible and reversible by setting, because archival editors must know exactly what changed.
3. Only markup changes: wording, spelling, and archaic forms in the source are preserved verbatim.
4. Stay in the flow: paste, read, copy, with no setup ritual; real-time mode is one toggle away.
5. Private by construction: everything runs locally in the page.
