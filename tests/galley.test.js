'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const G = require('../js/galley.js');

const tex = (md, opts) => G.convert(md, opts).latex.trim();

// ------------------------------------------------------------------ inline

test('emphasis becomes \\textit and \\textbf', () => {
  assert.equal(tex('*a* _b_ **c** __d__ ***e***'), '\\textit{a} \\textit{b} \\textbf{c} \\textbf{d} \\textit{\\textbf{e}}');
});

test('italic can use \\emph', () => {
  assert.equal(tex('*a*', { italic: 'emph' }), '\\emph{a}');
});

test('intraword underscores are not emphasis', () => {
  assert.equal(tex('snake_case_name'), 'snake\\_case\\_name');
});

test('strikethrough, superscript, subscript, small caps', () => {
  assert.equal(tex('~~x~~ 19^th^ H~2~O [Smith]{.smallcaps}'), '\\sout{x} 19\\textsuperscript{th} H\\textsubscript{2}O \\textsc{Smith}');
  assert.deepEqual(G.convert('~~x~~').packages.map((p) => p.name), ['ulem']);
});

test('inline code is escaped inside \\texttt', () => {
  assert.equal(tex('`a_b & {c} \\d`'), '\\texttt{a\\_b \\& \\{c\\} \\textbackslash{}d}');
});

test('links, autolinks and bare URLs', () => {
  assert.equal(tex('[site](https://example.com/a%20b#x)'), '\\href{https://example.com/a\\%20b\\#x}{site}');
  assert.equal(tex('<https://example.com>'), '\\url{https://example.com}');
  assert.equal(tex('See https://example.com/x.'), 'See \\url{https://example.com/x}.');
  assert.equal(tex('[ref]\n\n[ref]: https://example.com'), '\\href{https://example.com}{ref}');
});

test('editorial brackets that are not links stay literal', () => {
  assert.equal(tex('He wrote [sic] and [illegible].'), 'He wrote [sic] and [illegible].');
});

test('math and LaTeX commands pass through', () => {
  assert.equal(tex('Area $\\pi r^2$ and \\cite{knuth}.'), 'Area $\\pi r^2$ and \\cite{knuth}.');
  assert.equal(tex('\\LaTeX is fine'), '\\LaTeX{} is fine');
});

test('dollar amounts are not math', () => {
  assert.equal(tex('It cost $5 and $10.'), 'It cost \\$5 and \\$10.');
});

test('stray backslashes are escaped, not passed through', () => {
  assert.equal(tex('C:\\Users\\me'), 'C:\\textbackslash{}Users\\textbackslash{}me');
});

test('raw LaTeX can be turned off', () => {
  assert.equal(tex('$x$ \\cite{a}', { rawLatex: false }), '\\$x\\$ \\textbackslash{}cite\\{a\\}');
});

test('Markdown escapes produce literal characters', () => {
  assert.equal(tex('\\*not emphasis\\* and \\# hash'), '*not emphasis* and \\# hash');
});

test('Pandoc citations become \\cite', () => {
  assert.equal(tex('[@knuth84, p. 12] and [@a; @b]'), '\\cite[p.~12]{knuth84} and \\cite{a,b}');
});

test('hard breaks and the [ guard after them', () => {
  assert.equal(tex('one  \ntwo\\\n[sic] three'), 'one\\\\\ntwo\\\\\n{[}sic] three');
});

test('lineBreaks: keep turns every newline into a break', () => {
  assert.equal(tex('a\nb', { lineBreaks: 'keep' }), 'a\\\\\nb');
});

// ------------------------------------------------------------------ special characters

test('every LaTeX special character is escaped', () => {
  assert.equal(tex('# not a heading', {}).startsWith('\\section'), true);
  assert.equal(tex('a % b & c # d _ e { f } g ~ h ^ i < j > k |'),
    'a \\% b \\& c \\# d \\_ e \\{ f \\} g \\textasciitilde{} h \\textasciicircum{} i \\textless{} j \\textgreater{} k \\textbar{}');
});

test('symbols become commands', () => {
  assert.equal(tex('§ 4, 40°, £5, ½, ©'), '\\S~4, 40\\textdegree{}, \\pounds{}5, \\textonehalf{}, \\textcopyright{}');
});

test('ASCII mode writes accents as commands', () => {
  assert.equal(tex('Café naïve Ærø', { unicode: 'ascii' }), "Caf\\'{e} na\\\"{\\i}ve \\AE{}r\\o{}");
});

test('keep mode leaves Unicode alone and asks for XeLaTeX in documents', () => {
  assert.equal(tex('Café § 4', { unicode: 'keep', shorthand: false }), 'Café § 4');
  assert.match(tex('x', { unicode: 'keep', document: true }), /fontspec/);
});

test('scripts pdfLaTeX cannot set are flagged', () => {
  const w = G.convert('Ἀρχή').warnings;
  assert.equal(w.length, 1);
  assert.match(w[0].message, /Greek/);
});

// ------------------------------------------------------------------ typography

test('ellipses in every spelling', () => {
  assert.equal(tex('Wait... no. . . yes… end....'), 'Wait\\ldots{} no\\ldots{} yes\\ldots{} end.\\ldots{}');
  assert.equal(tex('a...', { ellipsis: 'dots' }), 'a\\dots{}');
  assert.equal(tex('a...', { ellipsis: 'off' }), 'a...');
});

test('quotes, apostrophes and nesting', () => {
  assert.equal(tex('"Hello," she said. \'Twas the cat\'s, in the \'90s.'), "``Hello,'' she said. 'Twas the cat's, in the '90s.");
  assert.equal(tex('“Curly ‘nested’ quotes”'), "``Curly `nested' quotes''");
  assert.equal(tex('"\'Hi\'"'), "``\\,`Hi'\\,''");
});

test('csquotes pairs quotes into \\enquote', () => {
  const r = G.convert('“Outer ‘inner’ text” and don’t', { quotes: 'csquotes' });
  assert.equal(r.latex.trim(), "\\enquote{Outer \\enquote{inner} text} and don't");
  assert.deepEqual(r.packages.map((p) => p.name), ['csquotes']);
});

test('dashes', () => {
  assert.equal(tex('a—b, 1–2, word - word, 1847-50, 1850-1840'), 'a---b, 1--2, word -- word, 1847--50, 1850-1840');
});

test('shorthand: ties and spacing', () => {
  assert.equal(tex('Mr. Darcy met Dr. J. R. R. Tolkien on p. 12, pp. 3-5, ca. 1850.'),
    'Mr.~Darcy met Dr.~J.~R.~R.~Tolkien on p.~12, pp.~3--5, ca.~1850.');
  assert.equal(tex('Use e.g. this, cf. that, i.e. those, etc. and more.'), 'Use e.g.\\ this, cf.\\ that, i.e.\\ those, etc.\\ and more.');
  assert.equal(tex('Ask the BBC. Then go.'), 'Ask the BBC\\@. Then go.');
  assert.equal(tex('See MS. Harley 2253.'), 'See MS. Harley 2253.');
  assert.equal(tex('Wm. Smith wrote e. g. this'), 'Wm.~Smith wrote e.g.\\ this');
});

test('shorthand spacing looks across formatting', () => {
  assert.equal(tex('(e.g. *lat.*)'), '(e.g.\\ \\textit{lat.})');
  assert.equal(tex('Mr. *Darcy*'), 'Mr.~\\textit{Darcy}');
});

test('shorthand can be turned off', () => {
  assert.equal(tex('Mr. Darcy, e.g. this', { shorthand: false }), 'Mr. Darcy, e.g. this');
});

test('copy-paste invisibles are cleaned and logged', () => {
  const r = G.convert('Tues\u00ADday,\u200B no\u00A0break, thin\u2009space, ﬁne\uFEFF');
  assert.equal(r.latex.trim(), 'Tuesday, no~break, thin\\,space, fine');
  assert.equal(r.counts.invisible, 5);
  assert.equal(r.counts.ligature, 1);
});

test('rejoining hyphenated line ends is opt-in', () => {
  assert.equal(tex('tran-\nscription'), 'tran-\nscription');
  assert.equal(tex('tran-\nscription', { dehyphenate: true }), 'transcription');
});

// ------------------------------------------------------------------ blocks

test('headings map to sectioning commands', () => {
  assert.equal(tex('# A\n\n## B\n\n### C\n\n#### D'), '\\section{A}\n\n\\subsection{B}\n\n\\subsubsection{C}\n\n\\paragraph{D}');
  assert.equal(tex('# A', { topLevel: 'chapter' }), '\\chapter{A}');
  assert.equal(tex('# A', { numbered: false }), '\\section*{A}');
  assert.equal(tex('# A {-}\n\n# B {#sec:b}'), '\\section*{A}\n\n\\section{B}\\label{sec:b}');
  assert.equal(tex('Title\n=====\n\nSub\n---'), '\\section{Title}\n\n\\subsection{Sub}');
});

test('a footnote in a heading gets a clean short title', () => {
  assert.equal(tex('# Title[^1]\n\n[^1]: Note.'), '\\section[Title]{Title\\footnote{Note.}}');
});

test('ordered and unordered lists nest', () => {
  assert.equal(tex('1. one\n2. two\n   - a\n   - b\n3. three'),
    '\\begin{enumerate}\n  \\item one\n  \\item two\n    \\begin{itemize}\n      \\item a\n      \\item b\n    \\end{itemize}\n  \\item three\n\\end{enumerate}');
});

test('ordered lists keep their start number', () => {
  assert.match(tex('3. three\n4. four'), /\\setcounter\{enumi\}\{2\}/);
});

test('task lists use boxes', () => {
  const r = G.convert('- [ ] todo\n- [x] done');
  assert.equal(r.latex.trim(), '\\begin{itemize}\n  \\item[$\\square$] todo\n  \\item[$\\boxtimes$] done\n\\end{itemize}');
  assert.deepEqual(r.packages.map((p) => p.name), ['amssymb']);
});

test('a list item that starts with [ is guarded', () => {
  assert.equal(tex('- [illegible] word'), '\\begin{itemize}\n  \\item {[}illegible] word\n\\end{itemize}');
});

test('definition lists become description', () => {
  assert.equal(tex('Term\n: Meaning.'), '\\begin{description}\n  \\item[Term] Meaning.\n\\end{description}');
});

test('blockquotes, quotation and attribution', () => {
  assert.equal(tex('> One.'), '\\begin{quote}\n  One.\n\\end{quote}');
  assert.equal(tex('> One.\n>\n> Two.'), '\\begin{quotation}\n  One.\n\n  Two.\n\\end{quotation}');
  assert.equal(tex('> Words.\n>\n> — Author'), '\\begin{quote}\n  Words.\n\n  \\hspace*{\\fill}--- Author\n\\end{quote}');
});

test('verse from fenced divs, code fences and line blocks', () => {
  const expected = '\\begin{verse}\n  Line one,\\\\\n  \\hspace*{1em}line two\n\n  New stanza.\n\\end{verse}';
  assert.equal(tex('::: verse\nLine one,\n  line two\n\nNew stanza.\n:::'), expected);
  assert.equal(tex('```verse\nLine one,\n  line two\n\nNew stanza.\n```'), expected);
  assert.equal(tex('| Line one,\n|   line two'), '\\begin{verse}\n  Line one,\\\\\n  \\hspace*{1em}line two\n\\end{verse}');
});

test('fenced divs become environments', () => {
  assert.equal(tex('::: center\nHi\n:::'), '\\begin{center}\n  Hi\n\\end{center}');
  assert.equal(G.convert('::: mybox\nHi\n:::').warnings.length, 1);
});

test('tables use booktabs with alignment and captions', () => {
  const r = G.convert('| a | b |\n|:--|--:|\n| 1 & 2 | 3 |\n\nTable: Caption {#tbl:x}');
  assert.equal(r.latex.trim(), [
    '\\begin{table}[htbp]',
    '  \\centering',
    '  \\begin{tabular}{lr}',
    '    \\toprule',
    '    a & b \\\\',
    '    \\midrule',
    '    1 \\& 2 & 3 \\\\',
    '    \\bottomrule',
    '  \\end{tabular}',
    '  \\caption{Caption}',
    '  \\label{tbl:x}',
    '\\end{table}'
  ].join('\n'));
  assert.deepEqual(r.packages.map((p) => p.name), ['booktabs']);
});

test('tables without a caption are not floats; grid style rules every row', () => {
  const t = tex('| a | b |\n|---|---|\n| 1 | 2 |', { tables: 'grid' });
  assert.match(t, /^\\begin\{center\}/);
  assert.match(t, /\{\|l\|l\|\}/);
  assert.equal((t.match(/\\hline/g) || []).length, 3);
});

test('code blocks keep their text exactly', () => {
  assert.equal(tex('```\n  50% & $x\n```'), '\\begin{verbatim}\n  50% & $x\n\\end{verbatim}');
  assert.equal(tex('```python\nx = 1\n```', { code: 'listings' }), '\\begin{lstlisting}[language=Python]\nx = 1\n\\end{lstlisting}');
});

test('indented text stays text unless indented code is enabled', () => {
  assert.equal(tex('    an indented paragraph'), 'an indented paragraph');
  assert.equal(tex('    code', { indentedCode: true }), '\\begin{verbatim}\ncode\n\\end{verbatim}');
});

test('raw LaTeX blocks and display math', () => {
  assert.equal(tex('\\begin{equation}\nx\n\\end{equation}'), '\\begin{equation}\nx\n\\end{equation}');
  assert.equal(tex('$$\nE = mc^2\n$$'), '\\[\n  E = mc^2\n\\]');
  assert.equal(tex('```{=latex}\n\\newpage\n```'), '\\newpage');
});

test('thematic breaks become scene breaks', () => {
  assert.equal(tex('a\n\n***\n\nb'), 'a\n\n\\begin{center}\n  *\\quad*\\quad*\n\\end{center}\n\nb');
  assert.match(tex('a\n\n***\n\nb', { sceneBreak: 'rule' }), /\\rule\{\\linewidth\}/);
});

test('footnotes, inline footnotes and the space before them', () => {
  assert.equal(tex('Word[^1] and more ^[Inline.].\n\n[^1]: The *note*.'), 'Word\\footnote{The \\textit{note}.} and more\\footnote{Inline.}.');
  assert.equal(G.convert('Missing[^x].').warnings.length, 1);
});

test('images become figures', () => {
  assert.equal(tex('![A caption](fig.png){width=50% #fig:a}'),
    '\\begin{figure}[htbp]\n  \\centering\n  \\includegraphics[width=0.5\\linewidth]{fig.png}\n  \\caption{A caption}\n  \\label{fig:a}\n\\end{figure}');
});

test('HTML comments become LaTeX comments; pagebreak becomes \\newpage', () => {
  assert.equal(tex('<!-- note -->'), '% note');
  assert.equal(tex('<!-- pagebreak -->'), '\\newpage');
});

// ------------------------------------------------------------------ documents

test('document mode builds a preamble with only what is used', () => {
  const t = tex('---\ntitle: A *Study*\nauthor:\n  - Ada\n  - Charles\nlang: fr\n---\n\n[x](https://e.com)', { document: true });
  assert.match(t, /^\\documentclass\{article\}/);
  assert.match(t, /\\usepackage\[french\]\{babel\}/);
  assert.match(t, /\\usepackage\{hyperref\}\n/);
  assert.doesNotMatch(t, /booktabs|graphicx/);
  assert.match(t, /\\title\{A \\textit\{Study\}\}\n\\author\{Ada \\and Charles\}/);
  assert.match(t, /\\maketitle/);
  assert.match(t, /\\end\{document\}$/);
});

test('document mode loads csquotes when quotes use it', () => {
  assert.match(tex('"Quoted"', { document: true, quotes: 'csquotes' }), /\\usepackage\{csquotes\}[\s\S]*\\enquote\{Quoted\}/);
});

test('chapters pick the book class', () => {
  assert.match(tex('# One', { document: true, topLevel: 'chapter' }), /\\documentclass\{book\}/);
});

// ------------------------------------------------------------------ the change log

test('every change is logged with its line and marked in the output', () => {
  const r = G.convert('Line one.\nCosts 5% & more...');
  const escape = r.changes.filter((c) => c.kind === 'escape');
  assert.equal(escape.length, 2);
  assert.equal(escape[0].line, 2);
  for (const m of r.marks) {
    const change = r.changes[m.change];
    assert.equal(r.latex.slice(m.start, m.end), change.to === 'removed' ? '' : change.to);
  }
});

test('escapes on every path are counted and marked', () => {
  const missing = G.convert('Missing[^x].');
  assert.equal(missing.latex.trim(), 'Missing[\\textasciicircum{}x].');
  assert.equal(missing.counts.escape, 1);
  const code = G.convert('`a_b & c`');
  assert.equal(code.counts.escape, 2);
  const delim = G.convert('a _ b');
  assert.equal(delim.latex.trim(), 'a \\_ b');
  assert.equal(delim.counts.escape, 1);
  for (const r of [missing, code, delim]) {
    for (const m of r.marks) assert.equal(r.latex.slice(m.start, m.end), r.changes[m.change].to);
  }
});

test('source and output line ranges line up', () => {
  const r = G.convert('# Title\n\nPara one\ncontinues.\n\n- item');
  const para = r.blocks.find((b) => b.src[0] === 3);
  assert.deepEqual(para.src, [3, 4]);
  const lines = r.latex.split('\n');
  assert.equal(lines[para.out[0] - 1], 'Para one');
});

test('output is stable on empty and whitespace input', () => {
  assert.equal(G.convert('').latex, '');
  assert.equal(G.convert('   \n\n  ').latex, '');
});

test('never throws on hostile input', () => {
  const nasty = ['[', '](', '![', '*'.repeat(500), '`'.repeat(99), '$$', '\\begin{x}', '| a |\n|-', ':::', '[^', '^[', '<', '<!--', '---\ntitle: x', '~~~', '> '.repeat(200) + 'x', '- '.repeat(100) + 'x'];
  for (const s of nasty) assert.doesNotThrow(() => G.convert(s), s);
});
