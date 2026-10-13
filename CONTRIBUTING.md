# Contributing

Thanks for helping improve Galley. This guide covers how to report problems, propose changes, and get a pull request merged.

## Ways to help

- **Report a bug.** Open an issue with the Markdown that misbehaves, the LaTeX you expected, and what you got. If the output doesn't compile, include the LaTeX error. A failing input is the most useful thing you can send. If it's sensitive, trim it down to a synthetic one that still fails.
- **Suggest a structure or a rule.** Open an issue describing what you're trying to typeset before you write code, so we can agree on the approach. Typographic rules (spacing, abbreviations, quotes) are welcome, especially with a style-guide reference.
- **Improve the docs or the examples.** Small fixes can go straight to a pull request.
- **Report a security problem** privately, as described in [SECURITY.md](SECURITY.md). Please don't use a public issue.

## Development setup

You need a browser, and Node.js 20 or newer to run the tests. There's nothing to install.

```sh
git clone https://github.com/fzn0x/galley.git
cd galley
npm test                     # or: node --test tests/galley.test.js
python -m http.server 8000   # optional: serve the folder at http://localhost:8000
```

Opening `index.html` straight from disk works too. Keep it that way; see the ground rules below.

## Project layout

- `js/galley.js`: the interpreter (block parser, inline parser, text normalisation, change log, source map, document assembly). It has no DOM access. Most changes to conversion behaviour belong here, along with a test.
- `js/app.js`: the UI.
- `js/examples.js`: the example roster. Examples must be public domain or synthetic; say which in the file.
- `css/styles.css`: design tokens, components, themes and breakpoints.
- `tests/galley.test.js`: engine tests, run with Node's built-in `node:test`.
- `DESIGN.md`: the design system. Read it before changing anything visual.

## Ground rules

These constraints keep Galley simple, private and easy to host:

1. **No build step and no runtime dependencies.** The site is static files.
2. **Classic scripts, not ES modules.** Browsers block module scripts on `file://`, and opening `index.html` directly must keep working.
3. **No network requests at runtime.** Don't add CDNs, analytics, web fonts from third-party hosts, or remote APIs. User text never leaves the page.
4. **Respect the Content-Security-Policy** in `index.html`. That means no inline `<script>` blocks, no inline `style="…"` attributes in markup, and no `eval`. Put code in `js/` and styles in `css/`.
5. **Escape everything that reaches `innerHTML`.** Input is untrusted. Use the existing `escHtml()` helper, or `textContent`.
6. **Output must compile.** Every new conversion should produce LaTeX that compiles with a standard pdfLaTeX setup (plus the packages Galley reports). Add the package to the `packages` list via `ctx.use()` when you introduce a command that needs one.
7. **Only markup changes.** Galley may change spacing, punctuation encoding and markup, never wording. Every normalisation goes through `ctx.change()` so it shows up in the Construction view, and has a rule to switch it off.
8. **Accessibility is part of done.** Every control is reachable by keyboard and has a visible focus state and an accessible name. Motion respects `prefers-reduced-motion`.
9. **Follow the design system.** Blue is structure and selection; there is one diagonal, the backslash. New UI reuses the tokens and components in `DESIGN.md`.

## Making a change

1. Fork the repository and create a branch from `main`, for example `fix/verse-indent` or `feat/criticmarkup`.
2. Make your change. Add or update tests in `tests/` for any engine behaviour.
3. Run `npm test` and make sure everything passes. If you changed conversion output, compile a sample to check it.
4. Check the page by hand in a browser: both themes, Construction on, a narrow window (about 390px wide), and the "Pasted from a PDF" example.
5. Open a pull request against `main` and fill in the template. Describe what changed and why, and attach a screenshot for visual changes.

Keep pull requests focused: one fix or feature each. Use plain, imperative commit messages, such as `Guard brackets after \item`.

## Code style

- Two-space indentation, semicolons, single quotes, and `const`/`let` (never `var` in new code). `.editorconfig` covers the basics.
- Keep functions small and name them for what they do. Add a comment where the *why* isn't obvious from the code.
- Match the surrounding code rather than introducing a new pattern.

## Conduct

Be kind and assume good faith. Harassment, insults and personal attacks aren't welcome in issues, pull requests or discussions. The maintainer may remove comments or block participants who don't follow this.

## License

By contributing, you agree that your contributions will be licensed under the [MIT License](LICENSE).
