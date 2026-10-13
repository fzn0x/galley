/* Galley: a Markdown-to-LaTeX interpreter with typesetter's defaults.
 *
 * Galley.convert(markdown, options) returns
 *   latex     the LaTeX, a body fragment or a full document
 *   changes   every normalisation it made: { kind, line, from, to }
 *   marks     where those changes sit in `latex`: { start, end, kind, change }
 *   blocks    source-to-output line ranges: { src: [a, b], out: [a, b] }
 *   packages  what the preamble needs: { name, options, why }
 *   warnings  things to know before compiling: { line, message }
 *
 * No DOM access, so it runs in Node for the tests. Classic script: it sets
 * window.Galley in the browser and module.exports in Node.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.Galley = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const DEFAULTS = {
    document: false,        // wrap the body in a compilable document
    topLevel: 'section',    // what `#` becomes: 'part' | 'chapter' | 'section'
    numbered: true,         // false gives starred headings
    italic: 'textit',       // 'textit' | 'emph'
    quotes: 'tex',          // 'tex' (``…'') | 'csquotes' (\enquote) | 'keep'
    ellipsis: 'ldots',      // 'ldots' | 'dots' | 'textellipsis' | 'off'
    dashes: true,           // Unicode dashes, spaced hyphens and year ranges
    shorthand: true,        // ties and spacing after abbreviations, initials
    invisibles: true,       // soft hyphens, zero-width spaces, odd spaces
    dehyphenate: false,     // rejoin words split across lines by a hyphen
    lineBreaks: 'join',     // 'join' (Markdown) | 'keep' (archival lineation)
    tables: 'booktabs',     // 'booktabs' | 'grid'
    sceneBreak: 'asterism', // what `---` becomes: 'asterism' | 'rule' | 'space'
    code: 'verbatim',       // 'verbatim' | 'listings'
    unicode: 'symbols',     // 'symbols' | 'ascii' | 'keep'
    rawLatex: true,         // let \commands{…} and math through untouched
    indentedCode: false,    // four-space indents are text, not code, by default
    docClass: 'auto'        // 'auto' | 'article' | 'report' | 'book'
  };

  const KINDS = {
    escape: 'Special characters',
    quote: 'Quotes',
    ellipsis: 'Ellipses',
    dash: 'Dashes',
    tie: 'Ties',
    space: 'Spacing',
    shorthand: 'Shorthand',
    unicode: 'Symbols',
    invisible: 'Invisibles',
    ligature: 'Ligatures',
    dehyphen: 'Rejoined words'
  };

  // Private-use sentinels. They never survive into the output.
  const M_OPEN = '\uE000', M_MID = '\uE001', M_CLOSE = '\uE002';
  const B_OPEN = '\uE003', B_SEP = '\uE004', B_CLOSE = '\uE005';
  const Q_OD = '\uE020', Q_CD = '\uE021', Q_OS = '\uE022', Q_CS = '\uE023', Q_AP = '\uE024';
  const NOINDENT = '\uE200';
  const BR = '\uE300', ITEM = '\uE301';

  // ------------------------------------------------------------------ tables

  const ESCAPES = {
    '\\': '\\textbackslash{}', '{': '\\{', '}': '\\}', '$': '\\$', '&': '\\&',
    '#': '\\#', '%': '\\%', '_': '\\_', '~': '\\textasciitilde{}',
    '^': '\\textasciicircum{}', '<': '\\textless{}', '>': '\\textgreater{}',
    '|': '\\textbar{}'
  };

  const SYMBOLS = {
    '§': '\\S{}', '¶': '\\P{}', '©': '\\textcopyright{}', '®': '\\textregistered{}',
    '™': '\\texttrademark{}', '°': '\\textdegree{}', '†': '\\dag{}', '‡': '\\ddag{}',
    '•': '\\textbullet{}', '·': '\\textperiodcentered{}', '£': '\\pounds{}',
    '€': '\\texteuro{}', '¢': '\\textcent{}', '¥': '\\textyen{}', '¤': '\\textcurrency{}',
    '×': '\\texttimes{}', '÷': '\\textdiv{}', '±': '\\textpm{}', '−': '\\textminus{}',
    '¬': '\\textlnot{}', '½': '\\textonehalf{}', '¼': '\\textonequarter{}',
    '¾': '\\textthreequarters{}', '¹': '\\textonesuperior{}', '²': '\\texttwosuperior{}',
    '³': '\\textthreesuperior{}', '‰': '\\textperthousand{}', '№': '\\textnumero{}',
    'µ': '\\textmu{}', 'ª': '\\textordfeminine{}', 'º': '\\textordmasculine{}',
    '¡': '\\textexclamdown{}', '¿': '\\textquestiondown{}', '‽': '\\textinterrobang{}',
    '¦': '\\textbrokenbar{}', '′': '\\ensuremath{\\prime}', '″': '\\ensuremath{\\prime\\prime}',
    '←': '\\textleftarrow{}', '→': '\\textrightarrow{}', '↑': '\\textuparrow{}',
    '↓': '\\textdownarrow{}', '✓': '\\checkmark{}', '℔': '\\textlbrackdbl{}'
  };
  delete SYMBOLS['℔']; // keep the table honest: only commands every kernel defines

  const LIGATURES = { 'ﬀ': 'ff', 'ﬁ': 'fi', 'ﬂ': 'fl', 'ﬃ': 'ffi', 'ﬄ': 'ffl', 'ﬅ': 'ft', 'ﬆ': 'st' };

  const SPACES = {
    '\u00A0': '~', '\u202F': '\\,', '\u2009': '\\,', '\u200A': '\\,',
    '\u2002': '\\enspace{}', '\u2003': '\\quad{}', '\u2007': '~', '\u2004': ' ',
    '\u2005': ' ', '\u2006': ' ', '\u2008': ' ', '\u2000': ' ', '\u2001': '\\quad{}',
    '\u205F': ' ', '\u3000': '\\quad{}'
  };
  const INVISIBLE_NAMES = {
    '\u00AD': 'soft hyphen', '\u200B': 'zero-width space', '\u2060': 'word joiner',
    '\uFEFF': 'byte-order mark', '\u00A0': 'no-break space', '\u202F': 'narrow no-break space',
    '\u2009': 'thin space', '\u200A': 'hair space', '\u2007': 'figure space'
  };

  const ACCENTS = {
    '\u0300': '`', '\u0301': "'", '\u0302': '^', '\u0303': '~', '\u0304': '=',
    '\u0306': 'u', '\u0307': '.', '\u0308': '"', '\u030A': 'r', '\u030B': 'H',
    '\u030C': 'v', '\u0323': 'd', '\u0327': 'c', '\u0328': 'k', '\u0331': 'b'
  };
  const LETTERS = {
    'ß': '\\ss{}', 'æ': '\\ae{}', 'Æ': '\\AE{}', 'œ': '\\oe{}', 'Œ': '\\OE{}',
    'ø': '\\o{}', 'Ø': '\\O{}', 'å': '\\aa{}', 'Å': '\\AA{}', 'ł': '\\l{}', 'Ł': '\\L{}',
    'ı': '\\i{}', 'ȷ': '\\j{}', 'ð': '\\dh{}', 'Ð': '\\DH{}', 'þ': '\\th{}', 'Þ': '\\TH{}',
    'ŋ': '\\ng{}', 'Ŋ': '\\NG{}', 'đ': '\\dj{}', 'Đ': '\\DJ{}'
  };
  const T1_LETTERS = new Set(['ð', 'Ð', 'þ', 'Þ', 'ŋ', 'Ŋ', 'đ', 'Đ']);

  // Commands that pass through bare (no arguments) when raw LaTeX is on.
  const RAW_BARE = new Set(('LaTeX TeX LaTeXe today noindent indent newpage clearpage ' +
    'cleardoublepage pagebreak nopagebreak linebreak nolinebreak newline par smallskip ' +
    'medskip bigskip vfill hfill centering raggedright raggedleft quad qquad enspace ' +
    'thinspace ldots dots textellipsis S P dag ddag copyright pounds maketitle ' +
    'tableofcontents listoffigures listoftables appendix frontmatter mainmatter backmatter ' +
    'small footnotesize scriptsize tiny large Large LARGE huge Huge normalsize itshape ' +
    'bfseries scshape upshape mdseries normalfont rmfamily sffamily ttfamily slshape em ' +
    'ae AE oe OE o O ss l L aa AA i j dh DH th TH textbackslash textasciitilde ' +
    'textasciicircum textbar textless textgreater textendash textemdash textbullet ' +
    'textdegree textregistered texttrademark textcopyright texteuro checkmark and ' +
    'item footnotemark printbibliography').split(' '));

  const STD_ENVS = new Set(('center flushleft flushright quote quotation verse abstract ' +
    'itemize enumerate description small footnotesize scriptsize large Large minipage ' +
    'multicols tabular table figure equation align gather multline').split(' '));

  const LISTINGS_LANGS = {
    c: 'C', 'c++': 'C++', cpp: 'C++', java: 'Java', python: 'Python', py: 'Python',
    html: 'HTML', xml: 'XML', sql: 'SQL', bash: 'bash', sh: 'sh', shell: 'sh', tex: 'TeX',
    latex: 'TeX', haskell: 'Haskell', lisp: 'Lisp', matlab: 'Matlab', perl: 'Perl',
    php: 'PHP', r: 'R', ruby: 'Ruby', fortran: 'Fortran', pascal: 'Pascal', go: 'Go'
  };

  const BABEL = {
    en: 'english', 'en-us': 'american', 'en-gb': 'british', fr: 'french', de: 'ngerman',
    es: 'spanish', it: 'italian', nl: 'dutch', pt: 'portuguese', la: 'latin',
    id: 'bahasai', ms: 'bahasam', sv: 'swedish', da: 'danish', no: 'norsk', fi: 'finnish',
    pl: 'polish', cs: 'czech', hu: 'magyar', tr: 'turkish', ga: 'irish', cy: 'welsh'
  };

  // Abbreviations. Titles and Victorian name contractions take a tie before a
  // name; reference words take a tie before a number; the "always" set is
  // never sentence-final, so it takes a control space; the "maybe" set only
  // does when a lowercase word follows.
  const TITLES = 'Mr|Mrs|Ms|Messrs|Mme|Mlle|Dr|Prof|Rev|Revd|Fr|Br|Sr|St|Hon|Capt|Col|Gen|Lt|Maj|Sgt|Cpl|Adm|Gov|Sen|Rep|Pres|Wm|Jas|Chas|Geo|Thos|Jno|Benj|Edw|Robt|Saml|Richd|Jos|Eliz|Margt|Hy';
  const NUMREFS = 'p|pp|vol|vols|no|nos|fig|figs|ch|chap|chaps|sec|secs|eq|eqs|fol|fols|ff|l|ll|col|cols|art|arts|para|paras|ca|c|n|nn|v|vv|ser|pt|pts|bk|bks|tab|app|op|ed|eds|fl|b|d|r|bap|bur|m|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec';
  const ALWAYS_SPACE = ['[eE]\\. ?g', '[iI]\\. ?e','cf', 'vs', 'viz', 'sc', 'et al', 'approx', 'esp', 'incl', 'resp', 'op\\. cit', 'loc\\. cit', 's\\.v', 'q\\.v', 'ibid', 'id'];
  const MAYBE_SPACE = ['etc', 'al', 'misc', 'ult', 'inst', 'prox', 'cent', 'yr', 'yrs', 'mo', 'mos', 'wk', 'wks', 'hr', 'hrs', 'min', 'oz', 'lb', 'lbs', 'ft', 'in', 'yd', 'yds', 'doz', 'qt', 'pk', 'gal', 'cwt', 'esq', 'Esq', 'Co', 'Bros', 'Ltd', 'Inc'];
  const CAPS_NO_SENTENCE = new Set(['MS', 'MSS', 'ALS', 'ADS', 'TLS', 'TS', 'AL', 'PS', 'NB', 'OED', 'ODNB']);
  const ELISIONS = /^(?:tis|twas|twere|twill|em|n'|cause|til|till|round|neath|tween|twixt|ere)\b/i;

  // ------------------------------------------------------------------ helpers

  const isBlank = (s) => /^[ \t]*$/.test(s);
  const indentOf = (s) => { const m = /^ */.exec(s); return m[0].length; };
  const isWS = (c) => c === undefined || c === '' || /\s/.test(c);
  const isPunct = (c) => c !== undefined && /[!-/:-@[-`{-~\u2000-\u206F\u2E00-\u2E7F\u00A1-\u00BF]/.test(c);
  const isAlnum = (c) => c !== undefined && /[\p{L}\p{N}]/u.test(c);
  const isLower = (c) => c !== undefined && /\p{Ll}/u.test(c);

  function expandTabs(s) {
    if (s.indexOf('\t') < 0) return s;
    let out = '';
    for (const ch of s) {
      if (ch === '\t') out += ' '.repeat(4 - (out.length % 4));
      else out += ch;
    }
    return out;
  }

  function indent(str, n) {
    const pad = ' '.repeat(n);
    return str.split('\n').map((l) => (l === '' || l[0] === NOINDENT ? l : pad + l)).join('\n');
  }

  // Find the index of the bracket that closes the one at `start`, skipping
  // escapes and code spans. Returns -1 when unbalanced.
  function matchBracket(s, start, open, close) {
    let depth = 0;
    for (let i = start; i < s.length; i++) {
      const c = s[i];
      if (c === '\\') { i++; continue; }
      if (c === '`') {
        const run = /^`+/.exec(s.slice(i))[0];
        const end = s.indexOf(run, i + run.length);
        if (end > 0) { i = end + run.length - 1; continue; }
      }
      if (c === open) depth++;
      else if (c === close) { depth--; if (depth === 0) return i; }
    }
    return -1;
  }

  // Consume LaTeX argument groups ([…] and {…}) starting at i.
  function consumeArgs(s, i) {
    let j = i;
    if (s[j] === '*') j++;
    for (;;) {
      if (s[j] === '{') { const e = matchBalanced(s, j, '{', '}'); if (e < 0) break; j = e + 1; }
      else if (s[j] === '[') { const e = matchBalanced(s, j, '[', ']'); if (e < 0) break; j = e + 1; }
      else break;
    }
    return j;
  }
  function matchBalanced(s, start, open, close) {
    let depth = 0;
    for (let i = start; i < s.length; i++) {
      const c = s[i];
      if (c === '\\') { i++; continue; }
      if (c === open) depth++;
      else if (c === close) { depth--; if (depth === 0) return i; }
      else if (c === '\n' && s[i + 1] === '\n') return -1;
    }
    return -1;
  }

  function parseAttrs(s) {
    // Pandoc-style {#id .class key=value -}
    const out = { id: null, classes: [], kv: {} };
    if (!s) return out;
    for (const tok of s.trim().split(/\s+/)) {
      if (!tok) continue;
      if (tok === '-') out.classes.push('unnumbered');
      else if (tok[0] === '#') out.id = tok.slice(1);
      else if (tok[0] === '.') out.classes.push(tok.slice(1));
      else {
        const eq = tok.indexOf('=');
        if (eq > 0) out.kv[tok.slice(0, eq)] = tok.slice(eq + 1).replace(/^["']|["']$/g, '');
        else out.classes.push(tok);
      }
    }
    return out;
  }

  // Escape for an argument that is taken literally (URLs, labels, paths).
  const escapeUrl = (u) => u.replace(/[\\]/g, '/').replace(/([%#{}])/g, '\\$1');
  const escapeLabel = (s) => s.replace(/[^A-Za-z0-9:._\-/+]/g, '-');

  // Escape text that must print literally (code spans). With a context, every
  // escaped character is logged and marked like any other change.
  function escapeCode(s, ctx, line) {
    let out = '';
    for (const ch of s) {
      const esc = ESCAPES[ch] || (ch === '"' ? '\\textquotedbl{}' : ch === "'" ? '\\textquotesingle{}' : ch === '`' ? '\\textasciigrave{}' : null);
      if (!esc) { out += ch; continue; }
      out += ctx ? M_OPEN + ctx.change('escape', line, ch, esc) + M_MID + esc + M_CLOSE : esc;
    }
    return out;
  }

  // ------------------------------------------------------------------ context

  function makeContext(opts) {
    const ctx = {
      opts,
      changes: [],
      warnings: [],
      need: new Map(),       // package -> { options, why }
      footnotes: Object.create(null),
      refs: Object.create(null),
      usedNotes: new Set(),
      blockMap: [],
      listDepth: 0,
      enumDepth: 0,
      unicodeNotes: new Map(), // script -> { count, lines:Set }
      front: null
    };
    ctx.change = (kind, line, from, to) => ctx.changes.push({ kind, line, from, to }) - 1;
    ctx.warn = (line, message) => {
      if (!ctx.warnings.some((w) => w.line === line && w.message === message)) ctx.warnings.push({ line, message });
    };
    ctx.use = (name, why, options) => {
      const cur = ctx.need.get(name);
      if (cur) { if (!cur.why.includes(why)) cur.why.push(why); }
      else ctx.need.set(name, { options: options || '', why: [why] });
    };
    return ctx;
  }

  // ------------------------------------------------------------------ text normalisation
  //
  // A text run becomes a list of segments: { t } is plain text still to be
  // processed and escaped; { l, c } is finished LaTeX tied to change c.

  // `tail` characters at the end of the last segment belong to the next
  // inline node: rules may look at them but never consume them.
  function ruleAt(segs, re, fn, tail) {
    const out = [];
    for (let k = 0; k < segs.length; k++) {
      const s = segs[k];
      if (s.t === undefined) { out.push(s); continue; }
      const str = s.t;
      const limit = k === segs.length - 1 && tail ? str.length - tail : str.length;
      re.lastIndex = 0;
      let last = 0, m;
      while ((m = re.exec(str))) {
        if (m[0] === '') { re.lastIndex++; continue; }
        if (m.index + m[0].length > limit) break;
        const rep = fn(m, str);
        if (rep == null) continue;
        if (m.index > last) out.push({ t: str.slice(last, m.index) });
        for (const r of rep) out.push(r);
        last = m.index + m[0].length;
      }
      if (last < str.length) out.push({ t: str.slice(last) });
    }
    return out;
  }

  function renderText(str, line, ctx, after) {
    const o = ctx.opts;
    const L = (l, kind, from, to) => ({ l, c: ctx.change(kind, line, from, to === undefined ? l : to) });
    const tail = after ? after.length : 0;
    let segs = [{ t: str + (after || '') }];
    const rule = (sg, re, fn) => ruleAt(sg, re, fn, tail);

    if (o.invisibles) {
      segs = rule(segs, /[\u00AD\u200B\u2060\uFEFF]/g, (m) => [L('', 'invisible', INVISIBLE_NAMES[m[0]], 'removed')]);
      segs = rule(segs, /[\u00A0\u202F\u2000-\u200A\u205F\u3000]/g, (m) => {
        const to = SPACES[m[0]] || ' ';
        return [to === ' ' ? { t: ' ' } : L(to, 'invisible', INVISIBLE_NAMES[m[0]] || 'Unicode space', to)];
      });
      segs = rule(segs, /[ﬀﬁﬂﬃﬄﬅﬆ]/g, (m) => [{ l: LIGATURES[m[0]], c: ctx.change('ligature', line, m[0], LIGATURES[m[0]]) }]);
    }

    if (o.shorthand) {
      // "e. g." before punctuation; before a word, the spacing rule below handles it.
      segs = rule(segs, /\b([eE])\. g\.(?=[,;:)]|$)|\b([iI])\. e\.(?=[,;:)]|$)/g, (m) => {
        const to = m[1] ? m[1] + '.g.' : m[2] + '.e.';
        return [L(to, 'shorthand', m[0], to)];
      });
    }

    if (o.ellipsis !== 'off') {
      const cmd = '\\' + (o.ellipsis === 'dots' ? 'dots' : o.ellipsis === 'textellipsis' ? 'textellipsis' : 'ldots') + '{}';
      segs = rule(segs, /\.(?: ?\.){3}|\.(?: \.){2}|\.\.\.|…/g, (m) => {
        const four = (m[0].match(/\./g) || []).length === 4;
        return [L(four ? '.' + cmd : cmd, 'ellipsis', m[0])];
      });
    }

    if (o.dashes) {
      segs = rule(segs, /[—―]|–/g, (m) => [L(m[0] === '–' ? '--' : '---', 'dash', m[0])]);
      segs = rule(segs, /(?<=[\p{L}\p{N},;.!?'")\]]) - (?=[\p{L}\p{N}"'(\[])/gu, (m) => [{ t: ' ' }, L('--', 'dash', '-', '--'), { t: ' ' }]);
      segs = rule(segs, /\b(1[0-9]{3}|20[0-9]{2})-(1[0-9]{3}|20[0-9]{2}|[0-9]{2})\b(?!-)/g, (m) => {
        const a = +m[1];
        const b = m[2].length === 2 ? Math.floor(a / 100) * 100 + +m[2] : +m[2];
        if (b <= a) return null;
        return [{ t: m[1] }, L('--', 'dash', '-', '--'), { t: m[2] }];
      });
    }

    if (o.shorthand) {
      // Page and line ranges: pp. 12-14 → pp.~12--14
      segs = rule(segs, new RegExp('\\b(pp|ll|fols|ff|nn|vv|cols|paras)\\. (\\d+[a-z]?)-(\\d+[a-z]?)\\b', 'g'), (m) => [
        { t: m[1] + '.' }, L('~', 'tie', 'space', '~'), { t: m[2] },
        o.dashes ? L('--', 'dash', '-', '--') : { t: '-' }, { t: m[3] }
      ]);
      segs = rule(segs, new RegExp('\\b(' + TITLES + ')\\. (?=\\p{Lu})', 'gu'), (m) => [{ t: m[1] + '.' }, L('~', 'tie', 'space', '~')]);
      segs = rule(segs, new RegExp('\\b(' + NUMREFS + ')\\. (?=\\d|[IVXLC]+\\b)', 'gi'), (m) => {
        if (/^[bdrm]$/.test(m[1]) === false && /^[BDRM]$/.test(m[1])) return null;
        return [{ t: m[1] + '.' }, L('~', 'tie', 'space', '~')];
      });
      segs = rule(segs, /§ ?(?=\d)|¶ ?(?=\d)/g, (m) => {
        const sym = m[0][0] === '§' ? '\\S' : '\\P';
        return [L(sym + '~', 'tie', m[0], sym + '~')];
      });
      segs = rule(segs, new RegExp('(?<![\\p{L}.])(' + ALWAYS_SPACE.join('|') + ')\\. (?=\\S)', 'gu'), (m) => {
        const spaced = /^([eEiI])\. ([geGE])$/.exec(m[1]);
        const head = spaced
          ? L(spaced[1] + '.' + spaced[2] + '.', 'shorthand', m[1] + '.', spaced[1] + '.' + spaced[2] + '.')
          : { t: m[1] + '.' };
        return [head, L('\\ ', 'space', 'space', '\\ ')];
      });
      segs = rule(segs, new RegExp('(?<![\\p{L}.])(' + MAYBE_SPACE.join('|') + ')\\. (?=[\\p{Ll}(\\d])', 'gu'), (m) => [{ t: m[1] + '.' }, L('\\ ', 'space', 'space', '\\ ')]);
      segs = rule(segs, /(?<![\p{L}])(\p{Lu})\. (?=\p{Lu})/gu, (m) => [{ t: m[1] + '.' }, L('~', 'tie', 'space', '~')]);
      segs = rule(segs, /(?<![\p{L}.])(\p{Lu}{2,})\.(?=\s+[\p{Lu}"'(\[\u201C\u2018]|\s*$)/gu, (m) => {
        if (CAPS_NO_SENTENCE.has(m[1])) return null;
        return [{ t: m[1] }, L('\\@.', 'space', '.', '\\@.')];
      });
    }

    if (o.quotes !== 'keep') {
      segs = rule(segs, /[„‚«»‹›]/g, (m) => {
        const map = { '„': '\\quotedblbase{}', '‚': '\\quotesinglbase{}', '«': '\\guillemotleft{}', '»': '\\guillemotright{}', '‹': '\\guilsinglleft{}', '›': '\\guilsinglright{}' };
        ctx.use('fontenc', 'guillemets and low quotes', 'T1');
        return [L(map[m[0]], 'quote', m[0])];
      });
    }

    if (o.unicode !== 'keep') {
      segs = rule(segs, /[§¶©®™°†‡•·£€¢¥¤×÷±−¬½¼¾¹²³‰№µªº¡¿‽¦′″←→↑↓✓]/g, (m) => {
        if (m[0] === '✓') ctx.use('amssymb', 'check marks');
        return [L(SYMBOLS[m[0]], 'unicode', m[0])];
      });
    }
    if (o.unicode === 'ascii') {
      segs = rule(segs, /[^\x00-\x7F\uE000-\uE3FF]/g, (m) => {
        const ch = m[0];
        if (LETTERS[ch]) {
          if (T1_LETTERS.has(ch)) ctx.use('fontenc', 'Old English and Icelandic letters', 'T1');
          return [L(LETTERS[ch], 'unicode', ch)];
        }
        const d = ch.normalize('NFD');
        if (d.length > 1 && /^[\x20-\x7E]$/.test(d[0]) && [...d.slice(1)].every((c) => ACCENTS[c])) {
          let base = d[0] === 'i' ? '\\i' : d[0] === 'j' ? '\\j' : d[0];
          for (const mark of d.slice(1)) base = '\\' + ACCENTS[mark] + '{' + base + '}';
          return [L(base, 'unicode', ch)];
        }
        noteUnicode(ch, line, ctx);
        return null;
      });
    } else if (o.unicode === 'symbols') {
      segs.forEach((s, k) => {
        if (s.t === undefined) return;
        const t = k === segs.length - 1 && tail ? s.t.slice(0, -tail) : s.t;
        for (const ch of t) if (ch.codePointAt(0) > 0x24F) noteUnicode(ch, line, ctx);
      });
    }

    segs = rule(segs, /[\\{}$&#%_~^<>|]/g, (m) => [L(ESCAPES[m[0]], 'escape', m[0])]);

    if (tail) {
      const lastSeg = segs[segs.length - 1];
      if (lastSeg && lastSeg.t !== undefined) lastSeg.t = lastSeg.t.slice(0, -tail);
    }
    let out = '';
    for (const s of segs) {
      if (s.t !== undefined) out += s.t;
      else out += M_OPEN + s.c + M_MID + s.l + M_CLOSE;
    }
    return out;
  }

  // The first characters of an inline node, for lookahead across node edges.
  function firstText(nd) {
    if (!nd) return '';
    switch (nd.type) {
      case 'text': return nd.value.slice(0, 2);
      case 'quote': return nd.from;
      case 'emph': case 'strong': case 'strike': case 'under': case 'sup': case 'sub':
      case 'small': case 'span': case 'q': case 'link':
        return nd.children && nd.children.length ? firstText(nd.children[0]) : 'x';
      case 'code': case 'math': case 'raw': case 'image': case 'cite': return 'x';
      default: return '';
    }
  }

  function noteUnicode(ch, line, ctx) {
    const cp = ch.codePointAt(0);
    if (cp >= 0xE000 && cp <= 0xE3FF) return;
    let script = 'Other Unicode characters';
    if (/\p{Script=Greek}/u.test(ch)) script = 'Greek';
    else if (/\p{Script=Cyrillic}/u.test(ch)) script = 'Cyrillic';
    else if (/\p{Script=Hebrew}/u.test(ch)) script = 'Hebrew';
    else if (/\p{Script=Arabic}/u.test(ch)) script = 'Arabic';
    else if (/[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/u.test(ch)) script = 'CJK';
    else if (/\p{Extended_Pictographic}/u.test(ch)) script = 'Emoji';
    else if (ch === 'ſ') script = 'Long s (ſ)';
    else if (/\p{M}/u.test(ch)) script = 'Combining marks';
    else if (/\p{L}/u.test(ch)) script = 'Extended Latin letters';
    const cur = ctx.unicodeNotes.get(script) || { count: 0, lines: new Set() };
    cur.count++;
    cur.lines.add(line);
    ctx.unicodeNotes.set(script, cur);
  }

  // ------------------------------------------------------------------ inline parsing

  function inlineParser(ctx, lineOf) {
    const o = ctx.opts;

    function parse(src, base) {
      const nodes = [];
      let text = '', textPos = 0;
      const flush = () => {
        if (text) { nodes.push({ type: 'text', value: text, line: lineOf(textPos) }); text = ''; }
      };
      const add = (node) => { flush(); nodes.push(node); };
      const pushText = (s, pos) => { if (!text) textPos = pos; text += s; };
      const n = src.length;
      let i = 0;

      while (i < n) {
        const c = src[i];
        const pos = base + i;

        if (c === '\\') {
          const next = src[i + 1];
          if (next === '\n' || next === undefined) {
            if (next === '\n') { add({ type: 'hardbreak' }); i += 2; continue; }
            pushText('\\', pos); i++; continue;
          }
          if (o.rawLatex && next === '\\') {
            const after = src.slice(i + 2);
            const m = /^ *\n/.exec(after);
            add({ type: 'hardbreak' });
            i += 2 + (m ? m[0].length : 0);
            continue;
          }
          if (o.rawLatex && (next === '(' || next === '[')) {
            const close = next === '(' ? '\\)' : '\\]';
            const end = src.indexOf(close, i + 2);
            if (end > 0) { add({ type: 'math', latex: src.slice(i, end + 2) }); i = end + 2; continue; }
          }
          if (o.rawLatex && /[A-Za-z@]/.test(next)) {
            const m = /^[A-Za-z@]+/.exec(src.slice(i + 1));
            const name = m[0];
            const j = i + 1 + name.length;
            const hasArgs = src[j] === '{' || src[j] === '[' || (src[j] === '*' && (src[j + 1] === '{' || src[j + 1] === '['));
            if (hasArgs || RAW_BARE.has(name)) {
              let end = hasArgs ? consumeArgs(src, j) : j;
              // A bare control word swallows the following space; keep it visible with {}.
              let latex = src.slice(i, end);
              if (!hasArgs && src[end] === ' ' && !/[{}]$/.test(latex)) latex += '{}';
              add({ type: 'raw', latex });
              i = end;
              continue;
            }
          }
          if (next === '"' || next === "'") {
            add({ type: 'raw', latex: next === '"' ? '\\textquotedbl{}' : '\\textquotesingle{}', change: ['escape', next] , line: lineOf(pos) });
            i += 2; continue;
          }
          if (/[!-/:-@[-`{-~]/.test(next)) { pushText(next, pos + 1); i += 2; continue; }
          pushText('\\', pos); i++; continue;
        }

        if (c === '`') {
          const run = /^`+/.exec(src.slice(i))[0];
          let j = i + run.length, found = -1;
          while ((j = src.indexOf(run, j)) >= 0) {
            if (src[j + run.length] !== '`' && src[j - 1] !== '`') { found = j; break; }
            j += run.length;
          }
          if (found >= 0) {
            let code = src.slice(i + run.length, found).replace(/\n/g, ' ');
            if (/^ .* $/.test(code) && code.trim()) code = code.slice(1, -1);
            add({ type: 'code', value: code, line: lineOf(pos) });
            i = found + run.length;
            continue;
          }
          pushText(run, pos); i += run.length; continue;
        }

        if (c === '$' && o.rawLatex) {
          if (src[i + 1] === '$') {
            const end = src.indexOf('$$', i + 2);
            if (end > i + 2) { add({ type: 'math', latex: '\\[' + src.slice(i + 2, end).trim() + '\\]' }); i = end + 2; continue; }
          } else if (src[i + 1] !== undefined && !isWS(src[i + 1])) {
            let j = i + 1, end = -1;
            while ((j = src.indexOf('$', j)) > 0) {
              if (src[j - 1] === '\\') { j++; continue; }
              if (!isWS(src[j - 1]) && !/\d/.test(src[j + 1] || '')) { end = j; break; }
              j++;
            }
            if (end > i + 1 && src.slice(i + 1, end).indexOf('\n\n') < 0) {
              add({ type: 'math', latex: src.slice(i, end + 1) });
              i = end + 1;
              continue;
            }
          }
          pushText('$', pos); i++; continue;
        }

        if (c === '*' || c === '_' || (c === '~' && src[i + 1] === '~')) {
          const run = new RegExp('^\\' + c + '+').exec(src.slice(i))[0];
          if (c === '~' && run.length !== 2) { pushText(run, pos); i += run.length; continue; }
          const before = i === 0 ? undefined : src[i - 1];
          const after = src[i + run.length];
          const lf = !isWS(after) && (!isPunct(after) || isWS(before) || isPunct(before));
          const rf = !isWS(before) && (!isPunct(before) || isWS(after) || isPunct(after));
          let canOpen = lf, canClose = rf;
          if (c === '_') {
            canOpen = lf && (!rf || isPunct(before));
            canClose = rf && (!lf || isPunct(after));
          }
          add({ type: 'delim', ch: c, count: run.length, orig: run.length, canOpen, canClose, pos, line: lineOf(pos) });
          i += run.length;
          continue;
        }

        if (c === '~') {
          const m = /^~((?:[^\s~\\]|\\.)+)~(?!~)/.exec(src.slice(i));
          if (m && src[i - 1] !== '~') { add({ type: 'sub', children: parse(m[1], pos + 1) }); i += m[0].length; continue; }
          pushText('~', pos); i++; continue;
        }

        if (c === '^') {
          if (src[i + 1] === '[') {
            const end = matchBracket(src, i + 1, '[', ']');
            if (end > 0) { add({ type: 'footnote', children: parse(src.slice(i + 2, end), pos + 2), line: lineOf(pos) }); i = end + 1; continue; }
          }
          const m = /^\^((?:[^\s^\\]|\\.)+)\^/.exec(src.slice(i));
          if (m) { add({ type: 'sup', children: parse(m[1], pos + 1) }); i += m[0].length; continue; }
          pushText('^', pos); i++; continue;
        }

        if (c === '!' && src[i + 1] === '[') {
          const end = matchBracket(src, i + 1, '[', ']');
          if (end > 0) {
            const tail = linkTail(src, end + 1);
            if (tail) {
              add({ type: 'image', alt: src.slice(i + 2, end), url: tail.url, title: tail.title, attrs: tail.attrs, line: lineOf(pos) });
              i = tail.end;
              continue;
            }
          }
          pushText('!', pos); i++; continue;
        }

        if (c === '[') {
          const cm = /^\[(-?@[\w:.#$%&+?<>~/-]+(?:\s*;\s*-?@[\w:.#$%&+?<>~/-]+)*)(?:,\s*([^\]]+))?\]/.exec(src.slice(i));
          if (cm) {
            const keys = cm[1].split(/\s*;\s*/).map((k) => k.replace(/^-?@/, ''));
            add({ type: 'cite', keys, locator: cm[2] ? cm[2].trim() : null, line: lineOf(pos) });
            i += cm[0].length;
            continue;
          }
          const fm = /^\[\^([^\]\s]+)\]/.exec(src.slice(i));
          if (fm && src[i + fm[0].length] !== ':') {
            add({ type: 'noteref', id: fm[1], line: lineOf(pos), pos });
            i += fm[0].length;
            continue;
          }
          const end = matchBracket(src, i, '[', ']');
          if (end > 0) {
            const inner = src.slice(i + 1, end);
            const tail = linkTail(src, end + 1);
            if (tail) {
              add({ type: 'link', url: tail.url, children: parse(inner, pos + 1), raw: inner });
              i = tail.end;
              continue;
            }
            if (src[end + 1] === '{') {
              const ae = src.indexOf('}', end + 1);
              if (ae > 0) {
                const attrs = parseAttrs(src.slice(end + 2, ae));
                add({ type: 'span', attrs, children: parse(inner, pos + 1) });
                i = ae + 1;
                continue;
              }
            }
            let refKey = null, consumed = end + 1;
            const rm = /^\[([^\]]*)\]/.exec(src.slice(end + 1));
            if (rm) { refKey = (rm[1] || inner).toLowerCase().trim(); consumed = end + 1 + rm[0].length; }
            else refKey = inner.toLowerCase().trim();
            const ref = ctx.refs[refKey];
            if (ref) {
              add({ type: 'link', url: ref.url, children: parse(inner, pos + 1), raw: inner });
              i = consumed;
              continue;
            }
          }
          pushText('[', pos); i++; continue;
        }

        if (c === '<') {
          const rest = src.slice(i);
          let m = /^<((?:https?|ftp|mailto):[^\s<>]+)>/i.exec(rest);
          if (m) { add({ type: 'link', url: m[1], children: null, raw: m[1] }); i += m[0].length; continue; }
          m = /^<([A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+)>/.exec(rest);
          if (m) { add({ type: 'link', url: 'mailto:' + m[1], children: null, raw: m[1] }); i += m[0].length; continue; }
          m = /^<!--([\s\S]*?)-->/.exec(rest);
          if (m) {
            if (/^\s*(newpage|pagebreak|clearpage)\s*$/i.test(m[1])) add({ type: 'raw', latex: '\\newpage{}' });
            i += m[0].length; continue;
          }
          m = /^<br\s*\/?>/i.exec(rest);
          if (m) { add({ type: 'hardbreak' }); i += m[0].length; continue; }
          m = /^<(sup|sub|em|i|strong|b|u|ins|s|del|strike|small|cite|q|span)(\s[^>]*)?>/i.exec(rest);
          if (m) {
            const tag = m[1].toLowerCase();
            const closeRe = new RegExp('</' + tag + '\\s*>', 'i');
            const cm = closeRe.exec(rest.slice(m[0].length));
            if (cm) {
              const innerStart = i + m[0].length;
              const inner = src.slice(innerStart, innerStart + cm.index);
              const children = parse(inner, base + innerStart);
              const type = { sup: 'sup', sub: 'sub', em: 'emph', i: 'emph', cite: 'emph', strong: 'strong', b: 'strong', u: 'under', ins: 'under', s: 'strike', del: 'strike', strike: 'strike', small: 'small', q: 'q', span: 'span' }[tag];
              const node = { type, children };
              if (tag === 'span') node.attrs = { classes: /small-?caps/i.test(m[2] || '') ? ['smallcaps'] : [], kv: {}, id: null };
              add(node);
              i = innerStart + cm.index + cm[0].length;
              continue;
            }
          }
          m = /^<\/?[A-Za-z][A-Za-z0-9-]*(?:\s[^<>]*)?\/?>/.exec(rest);
          if (m) { ctx.warn(lineOf(pos), 'HTML tag ' + m[0] + ' dropped'); i += m[0].length; continue; }
          pushText('<', pos); i++; continue;
        }

        if (c === '\n') {
          // Hard break: two trailing spaces, or every line in "keep" mode.
          const hard = / {2,}$/.test(text) || o.lineBreaks === 'keep';
          text = text.replace(/ +$/, '');
          add({ type: hard ? 'hardbreak' : 'softbreak' });
          i++;
          while (src[i] === ' ') i++;
          continue;
        }

        if (o.quotes !== 'keep' && (c === '"' || c === "'" || c === '\u201C' || c === '\u201D' || c === '\u2018' || c === '\u2019')) {
          const prev = i === 0 ? undefined : src[i - 1];
          const next = src[i + 1];
          let q;
          if (c === '\u201C') q = 'od';
          else if (c === '\u201D') q = 'cd';
          else if (c === '\u2018') q = 'os';
          else if (c === '\u2019') q = isAlnum(prev) && isAlnum(next) ? 'ap' : 'cs';
          else {
            const openCtx = isWS(prev) || /[([{\u2014\u2013/\u201C\u2018"'-]/.test(prev);
            if (c === '"') q = openCtx && !isWS(next) ? 'od' : 'cd';
            else if (isAlnum(prev) && isAlnum(next)) q = 'ap';
            else if (openCtx && /\d/.test(next || '')) q = 'ap';
            else if (openCtx && ELISIONS.test(src.slice(i + 1))) q = 'ap';
            else if (openCtx && !isWS(next)) q = 'os';
            else q = isAlnum(prev) ? 'cs' : 'cs';
          }
          add({ type: 'quote', q, from: c, line: lineOf(pos) });
          i++;
          continue;
        }

        if ((c === 'h' || c === 'w' || c === 'H' || c === 'W') && (i === 0 || /[\s(*_~"'\u201C]/.test(src[i - 1]))) {
          const m = /^(?:https?:\/\/|www\.)[^\s<]+/i.exec(src.slice(i));
          if (m) {
            let url = m[0];
            // Trailing punctuation and unbalanced closing parentheses are not part of the URL.
            for (;;) {
              const last = url[url.length - 1];
              if (/[.,:;!?'"*_~\u201D\u2019]/.test(last)) { url = url.slice(0, -1); continue; }
              if (last === ')' && (url.match(/\(/g) || []).length < (url.match(/\)/g) || []).length) { url = url.slice(0, -1); continue; }
              break;
            }
            add({ type: 'link', url: /^www\./i.test(url) ? 'http://' + url : url, children: null, raw: url });
            i += url.length;
            continue;
          }
        }

        pushText(c, pos);
        i++;
      }
      flush();
      return processEmphasis(nodes);
    }

    function linkTail(src, k) {
      if (src[k] !== '(') return null;
      let j = k + 1;
      while (src[j] === ' ' || src[j] === '\n') j++;
      let url = '';
      if (src[j] === '<') {
        const e = src.indexOf('>', j);
        if (e < 0) return null;
        url = src.slice(j + 1, e);
        j = e + 1;
      } else {
        let depth = 0;
        const s = j;
        while (j < src.length) {
          const ch = src[j];
          if (ch === '\\') { j += 2; continue; }
          if (ch === '(') depth++;
          else if (ch === ')') { if (depth === 0) break; depth--; }
          else if (/\s/.test(ch)) break;
          j++;
        }
        url = src.slice(s, j);
      }
      while (src[j] === ' ' || src[j] === '\n') j++;
      let title = null;
      if (src[j] === '"' || src[j] === "'" || src[j] === '(') {
        const close = src[j] === '(' ? ')' : src[j];
        const e = src.indexOf(close, j + 1);
        if (e < 0) return null;
        title = src.slice(j + 1, e);
        j = e + 1;
        while (src[j] === ' ' || src[j] === '\n') j++;
      }
      if (src[j] !== ')') return null;
      j++;
      let attrs = null;
      if (src[j] === '{') {
        const e = src.indexOf('}', j);
        if (e > 0) { attrs = parseAttrs(src.slice(j + 1, e)); j = e + 1; }
      }
      return { url: url.replace(/\\(.)/g, '$1'), title, attrs, end: j };
    }

    return parse;
  }

  // CommonMark's delimiter algorithm, with ~~ for strikethrough.
  function processEmphasis(nodes) {
    let ci = 0;
    while (ci < nodes.length) {
      const closer = nodes[ci];
      if (closer.type !== 'delim' || !closer.canClose || closer.count === 0) { ci++; continue; }
      let oi = ci - 1, found = false;
      for (; oi >= 0; oi--) {
        const op = nodes[oi];
        if (op.type !== 'delim' || op.ch !== closer.ch || !op.canOpen || op.count === 0) continue;
        if (closer.ch === '~') { if (op.count !== 2 || closer.count !== 2) continue; }
        else if ((op.canClose || closer.canOpen) && (op.orig + closer.orig) % 3 === 0 && !(op.orig % 3 === 0 && closer.orig % 3 === 0)) continue;
        found = true;
        break;
      }
      if (!found) {
        if (!closer.canOpen) closer.canClose = false;
        ci++;
        continue;
      }
      const opener = nodes[oi];
      const use = closer.ch === '~' ? 2 : (opener.count >= 2 && closer.count >= 2 ? 2 : 1);
      const type = closer.ch === '~' ? 'strike' : use === 2 ? 'strong' : 'emph';
      const children = nodes.slice(oi + 1, ci);
      opener.count -= use;
      closer.count -= use;
      nodes.splice(oi + 1, ci - oi - 1, { type, children });
      ci = oi + 2;
      if (opener.count === 0) { nodes.splice(oi, 1); ci--; }
      if (closer.count === 0) { nodes.splice(ci, 1); }
    }
    return nodes;
  }

  // ------------------------------------------------------------------ inline rendering

  function renderInlines(nodes, ctx, flags) {
    let out = '';
    for (let k = 0; k < nodes.length; k++) {
      const nd = nodes[k];
      switch (nd.type) {
        case 'text':
          if (nd._latex === undefined) nd._latex = renderText(nd.value, nd.line, ctx, firstText(nodes[k + 1]));
          out += nd._latex;
          break;
        case 'delim':
          if (nd.count) {
            const lit = nd.ch.repeat(nd.count);
            out += escapeTracked(lit, ctx, nd.line);
          }
          break;
        case 'quote': {
          if (nd._latex === undefined) {
            const marker = { od: Q_OD, cd: Q_CD, os: Q_OS, cs: Q_CS, ap: Q_AP }[nd.q];
            const to = { od: '``', cd: "''", os: '`', cs: "'", ap: "'" }[nd.q];
            const c = ctx.change('quote', nd.line, nd.from, to);
            nd._latex = M_OPEN + c + M_MID + marker + M_CLOSE;
          }
          out += nd._latex;
          break;
        }
        case 'softbreak': out += flags.heading ? ' ' : '\n'; break;
        case 'hardbreak': out += flags.heading ? ' ' : BR + '\n'; break;
        case 'code': out += '\\texttt{' + escapeCode(nd.value, ctx, nd.line) + '}'; break;
        case 'math': out += nd.latex; break;
        case 'raw':
          if (nd.change && nd._c === undefined) nd._c = ctx.change(nd.change[0], nd.line, nd.change[1], nd.latex);
          out += nd._c !== undefined ? M_OPEN + nd._c + M_MID + nd.latex + M_CLOSE : nd.latex;
          break;
        case 'emph': out += '\\' + (ctx.opts.italic === 'emph' ? 'emph' : 'textit') + '{' + renderInlines(nd.children, ctx, flags) + '}'; break;
        case 'strong': out += '\\textbf{' + renderInlines(nd.children, ctx, flags) + '}'; break;
        case 'strike':
          ctx.use('ulem', 'strikethrough', 'normalem');
          out += '\\sout{' + renderInlines(nd.children, ctx, flags) + '}';
          break;
        case 'under':
          ctx.use('ulem', 'underline', 'normalem');
          out += '\\uline{' + renderInlines(nd.children, ctx, flags) + '}';
          break;
        case 'sup': out += '\\textsuperscript{' + renderInlines(nd.children, ctx, flags) + '}'; break;
        case 'sub': out += '\\textsubscript{' + renderInlines(nd.children, ctx, flags) + '}'; break;
        case 'small': out += '{\\small ' + renderInlines(nd.children, ctx, flags) + '}'; break;
        case 'q':
          out += M_OPEN + ctx.change('quote', null, '<q>', '``') + M_MID + Q_OD + M_CLOSE + renderInlines(nd.children, ctx, flags) +
            M_OPEN + ctx.change('quote', null, '</q>', "''") + M_MID + Q_CD + M_CLOSE;
          break;
        case 'span': {
          const inner = renderInlines(nd.children, ctx, flags);
          const cl = nd.attrs.classes;
          if (cl.includes('smallcaps') || cl.includes('sc')) out += '\\textsc{' + inner + '}';
          else if (cl.includes('underline') || cl.includes('ul')) { ctx.use('ulem', 'underline', 'normalem'); out += '\\uline{' + inner + '}'; }
          else if (cl.includes('mark')) { ctx.use('soul', 'highlighting'); out += '\\hl{' + inner + '}'; }
          else if (nd.attrs.kv.lang && BABEL[nd.attrs.kv.lang.toLowerCase()]) {
            ctx.use('babel', 'foreign-language spans');
            ctx.langs = ctx.langs || new Set();
            ctx.langs.add(BABEL[nd.attrs.kv.lang.toLowerCase()]);
            out += '\\foreignlanguage{' + BABEL[nd.attrs.kv.lang.toLowerCase()] + '}{' + inner + '}';
          } else out += inner;
          break;
        }
        case 'link': {
          ctx.use('hyperref', 'links');
          const url = escapeUrl(nd.url);
          if (!nd.children || nd.raw === nd.url || nd.raw === nd.url.replace(/^mailto:/, '')) {
            out += /^mailto:/.test(nd.url) ? '\\href{' + url + '}{' + renderText(nd.raw, null, ctx) + '}' : '\\url{' + url + '}';
          } else out += '\\href{' + url + '}{' + renderInlines(nd.children, ctx, flags) + '}';
          break;
        }
        case 'image': {
          ctx.use('graphicx', 'images');
          out += '\\includegraphics' + graphicOpts(nd.attrs, '') + '{' + escapeUrl(nd.url) + '}';
          break;
        }
        case 'noteref': {
          const note = ctx.footnotes[nd.id];
          if (!note) {
            ctx.warn(nd.line, 'Footnote [^' + nd.id + '] has no definition; kept as text');
            out += '[' + escapeCode('^' + nd.id, ctx, nd.line) + ']';
            break;
          }
          if (flags.heading) break;
          if (ctx.usedNotes.has(nd.id)) ctx.warn(nd.line, 'Footnote [^' + nd.id + '] is referenced more than once; its text is repeated');
          ctx.usedNotes.add(nd.id);
          if (note.latex === undefined) note.latex = renderBlocks(note.blocks, ctx, { tight: false, noMap: true }).trim();
          out = trimSpaceBeforeNote(out, nd.line, ctx);
          out += '\\footnote{' + note.latex + '}';
          break;
        }
        case 'cite': {
          const loc = nd.locator ? '[' + renderText(nd.locator, nd.line, ctx) + ']' : '';
          out += '\\cite' + loc + '{' + nd.keys.join(',') + '}';
          break;
        }
        case 'footnote':
          if (flags.heading) break;
          out = trimSpaceBeforeNote(out, nd.line, ctx);
          out += '\\footnote{' + renderInlines(nd.children, ctx, flags).trim() + '}';
          break;
        default: break;
      }
    }
    return out;
  }

  function trimSpaceBeforeNote(out, line, ctx) {
    if (/ $/.test(out)) {
      ctx.change('space', line, 'space before footnote', 'removed');
      return out.replace(/ +$/, '');
    }
    return out;
  }

  function escapeTracked(str, ctx, line) {
    let out = '';
    for (const ch of str) {
      if (ESCAPES[ch]) out += M_OPEN + ctx.change('escape', line, ch, ESCAPES[ch]) + M_MID + ESCAPES[ch] + M_CLOSE;
      else out += ch;
    }
    return out;
  }

  function graphicOpts(attrs, fallback) {
    if (!attrs) return fallback;
    const parts = [];
    for (const key of ['width', 'height']) {
      const v = attrs.kv[key];
      if (!v) continue;
      const pct = /^(\d+(?:\.\d+)?)%$/.exec(v);
      if (pct) parts.push(key + '=' + (+pct[1] / 100) + (key === 'width' ? '\\linewidth' : '\\textheight'));
      else parts.push(key + '=' + v);
    }
    return parts.length ? '[' + parts.join(',') + ']' : fallback;
  }

  // ------------------------------------------------------------------ block parsing

  const RE_ATX = /^ {0,3}(#{1,6})(?:[ \t]+(.*?))?(?:[ \t]+#+)?[ \t]*$/;
  const RE_HR = /^ {0,3}([-*_])(?:[ \t]*\1){2,}[ \t]*$/;
  const RE_FENCE = /^( {0,3})(`{3,}|~{3,})[ \t]*(.*)$/;
  const RE_DIV_OPEN = /^ {0,3}(:{3,})[ \t]*([^:\s].*?)[ \t]*:*[ \t]*$/;
  const RE_DIV_CLOSE = /^ {0,3}:{3,}[ \t]*$/;
  const RE_BULLET = /^( {0,3})([-*+])( +|$)(.*)$/;
  const RE_ORDERED = /^( {0,3})(\d{1,9})([.)])( +|$)(.*)$/;
  const RE_QUOTE = /^ {0,3}> ?(.*)$/;
  const RE_FOOTDEF = /^ {0,3}\[\^([^\]\s]+)\]:[ \t]*(.*)$/;
  const RE_LINKDEF = /^ {0,3}\[([^\]^][^\]]*)\]:[ \t]*<?([^\s>]+)>?(?:[ \t]+(?:"[^"]*"|'[^']*'|\([^)]*\)))?[ \t]*$/;
  const RE_SETEXT = /^ {0,3}(=+|-+)[ \t]*$/;
  const RE_TABLE_DELIM = /^ {0,3}\|?[ \t]*:?-+:?[ \t]*(?:\|[ \t]*:?-+:?[ \t]*)*\|?[ \t]*$/;
  const RE_LINEBLOCK = /^\|(?: |$)/;
  const RE_DEF = /^ {0,3}:[ \t]+(.*)$/;
  const RE_MATH_OPEN = /^ {0,3}\$\$/;
  const RE_BEGIN_ENV = /^ {0,3}\\begin\{([A-Za-z@*]+)\}/;
  const RE_RAW_LINE = /^ {0,3}\\[A-Za-z@]+\*?(?:\[[^\]]*\]|\{[^{}]*\})*[ \t]*$/;
  const RE_COMMENT = /^ {0,3}<!--/;
  const RE_CAPTION = /^(?:Table)?:[ \t]+(.*)$/;

  function listMarker(text) {
    let m = RE_BULLET.exec(text);
    if (m && !RE_HR.test(text)) {
      const width = m[1].length + 1 + (m[3].length > 4 ? 1 : Math.max(m[3].length, 1));
      return { ordered: false, ch: m[2], indent: m[1].length, content: width, text: m[4], empty: m[4] === '' };
    }
    m = RE_ORDERED.exec(text);
    if (m) {
      const width = m[1].length + m[2].length + 1 + (m[4].length > 4 ? 1 : Math.max(m[4].length, 1));
      return { ordered: true, ch: m[3], num: +m[2], indent: m[1].length, content: width, text: m[5], empty: m[5] === '' };
    }
    return null;
  }

  function isTableStart(lines, i) {
    const a = lines[i], b = lines[i + 1];
    if (!a || !b) return false;
    if (a.text.indexOf('|') < 0 || b.text.indexOf('|') < 0 && a.text.trim()[0] !== '|') return false;
    if (!RE_TABLE_DELIM.test(b.text) || b.text.indexOf('-') < 0) return false;
    return splitRow(a.text).length === splitRow(b.text).length || b.text.indexOf('|') >= 0;
  }

  function splitRow(text) {
    let s = text.trim();
    if (s[0] === '|') s = s.slice(1);
    if (s[s.length - 1] === '|' && s[s.length - 2] !== '\\') s = s.slice(0, -1);
    const cells = [];
    let cur = '', inCode = false;
    for (let i = 0; i < s.length; i++) {
      const c = s[i];
      if (c === '\\' && s[i + 1] === '|') { cur += '|'; i++; continue; }
      if (c === '`') inCode = !inCode;
      if (c === '|' && !inCode) { cells.push(cur.trim()); cur = ''; continue; }
      cur += c;
    }
    cells.push(cur.trim());
    return cells;
  }

  function interruptsParagraph(lines, i, opts) {
    const t = lines[i].text;
    if (RE_ATX.test(t) || RE_FENCE.test(t) || RE_QUOTE.test(t) || RE_DIV_OPEN.test(t) || RE_DIV_CLOSE.test(t)) return true;
    if (RE_HR.test(t) && !/^ {0,3}-+[ \t]*$/.test(t)) return true;
    if (RE_MATH_OPEN.test(t) || (opts.rawLatex && RE_BEGIN_ENV.test(t))) return true;
    if (RE_FOOTDEF.test(t) || RE_COMMENT.test(t)) return true;
    const lm = listMarker(t);
    if (lm && !lm.empty && (!lm.ordered || lm.num === 1)) return true;
    if (isTableStart(lines, i)) return true;
    return false;
  }

  function parseBlocks(lines, ctx) {
    const blocks = [];
    const opts = ctx.opts;
    let i = 0;
    const n = lines.length;

    while (i < n) {
      const line = lines[i];
      const t = line.text;
      if (isBlank(t)) { i++; continue; }

      // Fenced code, verse, raw LaTeX or math
      let m = RE_FENCE.exec(t);
      if (m && !(m[2][0] === '`' && m[3].indexOf('`') >= 0)) {
        const fence = m[2], ind = m[1].length;
        const closeRe = new RegExp('^ {0,3}' + (fence[0] === '`' ? '`' : '~') + '{' + fence.length + ',}[ \\t]*$');
        const body = [];
        let j = i + 1;
        while (j < n && !closeRe.test(lines[j].text)) {
          body.push({ text: lines[j].text.replace(new RegExp('^ {0,' + ind + '}'), ''), ln: lines[j].ln });
          j++;
        }
        const end = Math.min(j, n - 1);
        blocks.push(fenceBlock(m[3].trim(), body, line.ln, lines[end].ln));
        i = j + 1;
        continue;
      }

      // Fenced div  ::: name
      m = RE_DIV_OPEN.exec(t);
      if (m) {
        let spec = m[2].trim();
        let name = spec, attrs = parseAttrs('');
        const brace = /^\{(.*)\}$/.exec(spec) || /^([A-Za-z*]+)\s*\{(.*)\}$/.exec(spec);
        if (brace && brace.length === 2) { attrs = parseAttrs(brace[1]); name = attrs.classes[0] || ''; }
        else if (brace) { name = brace[1]; attrs = parseAttrs(brace[2]); }
        else name = spec.split(/\s+/)[0];
        const body = [];
        let depth = 1, j = i + 1, inFence = null;
        while (j < n) {
          const lt = lines[j].text;
          const fm = RE_FENCE.exec(lt);
          if (fm) inFence = inFence ? (lt.trim().startsWith(inFence) ? null : inFence) : fm[2];
          if (!inFence) {
            if (RE_DIV_OPEN.test(lt)) depth++;
            else if (RE_DIV_CLOSE.test(lt)) { depth--; if (depth === 0) break; }
          }
          body.push(lines[j]);
          j++;
        }
        const end = Math.min(j, n - 1);
        if (/^(verse|poem|poetry)$/i.test(name)) blocks.push({ type: 'verse', lines: body, start: line.ln, end: lines[end].ln, attrs });
        else blocks.push({ type: 'div', name: name.replace(/[^A-Za-z*]/g, ''), attrs, children: parseBlocks(body, ctx), start: line.ln, end: lines[end].ln });
        i = j + 1;
        continue;
      }

      // Display math block
      if (opts.rawLatex && RE_MATH_OPEN.test(t)) {
        const first = t.trim().slice(2);
        if (/\$\$\s*$/.test(first) && first.replace(/\$\$\s*$/, '').trim()) {
          blocks.push({ type: 'math', content: first.replace(/\$\$\s*$/, '').trim(), start: line.ln, end: line.ln });
          i++;
          continue;
        }
        const body = first.trim() ? [first] : [];
        let j = i + 1;
        while (j < n && !/\$\$\s*$/.test(lines[j].text)) { body.push(lines[j].text); j++; }
        if (j < n) {
          const last = lines[j].text.replace(/\$\$\s*$/, '');
          if (last.trim()) body.push(last);
          blocks.push({ type: 'math', content: body.join('\n').trim(), start: line.ln, end: lines[j].ln });
          i = j + 1;
          continue;
        }
      }

      // Raw LaTeX environment or a line of commands
      if (opts.rawLatex) {
        m = RE_BEGIN_ENV.exec(t);
        if (m) {
          const name = m[1];
          const esc = name.replace(/[*]/g, '\\*');
          let depth = 0, j = i;
          const body = [];
          for (; j < n; j++) {
            const lt = lines[j].text;
            depth += (lt.match(new RegExp('\\\\begin\\{' + esc + '\\}', 'g')) || []).length;
            depth -= (lt.match(new RegExp('\\\\end\\{' + esc + '\\}', 'g')) || []).length;
            body.push(lt);
            if (depth <= 0) break;
          }
          const end = Math.min(j, n - 1);
          blocks.push({ type: 'raw', content: body.join('\n'), start: line.ln, end: lines[end].ln });
          i = end + 1;
          continue;
        }
        if (RE_RAW_LINE.test(t)) {
          const body = [];
          let j = i;
          while (j < n && RE_RAW_LINE.test(lines[j].text)) { body.push(lines[j].text.trim()); j++; }
          blocks.push({ type: 'raw', content: body.join('\n'), start: line.ln, end: lines[j - 1].ln });
          i = j;
          continue;
        }
      }

      // HTML comment
      if (RE_COMMENT.test(t)) {
        const body = [];
        let j = i;
        for (; j < n; j++) { body.push(lines[j].text); if (lines[j].text.indexOf('-->') >= 0) break; }
        const end = Math.min(j, n - 1);
        const inner = body.join('\n').replace(/^\s*<!--/, '').replace(/-->\s*$/, '').trim();
        if (/^(newpage|pagebreak|clearpage)$/i.test(inner)) blocks.push({ type: 'raw', content: '\\newpage', start: line.ln, end: lines[end].ln });
        else blocks.push({ type: 'comment', lines: inner.split('\n'), start: line.ln, end: lines[end].ln });
        i = end + 1;
        continue;
      }

      // ATX heading
      m = RE_ATX.exec(t);
      if (m) {
        let text = (m[2] || '').trim();
        let attrs = parseAttrs('');
        const am = /\s*\{([^{}]*)\}\s*$/.exec(text);
        if (am && /(^|\s)[#.-]/.test(am[1])) { attrs = parseAttrs(am[1]); text = text.slice(0, am.index).trim(); }
        blocks.push({ type: 'heading', level: m[1].length, text, attrs, start: line.ln, end: line.ln });
        i++;
        continue;
      }

      if (RE_HR.test(t)) { blocks.push({ type: 'hr', start: line.ln, end: line.ln }); i++; continue; }

      // Footnote definition
      m = RE_FOOTDEF.exec(t);
      if (m) {
        const body = [{ text: m[2], ln: line.ln }];
        let j = i + 1;
        while (j < n) {
          const lt = lines[j].text;
          if (isBlank(lt)) {
            let k = j;
            while (k < n && isBlank(lines[k].text)) k++;
            if (k < n && indentOf(lines[k].text) >= 2) { while (j < k) { body.push({ text: '', ln: lines[j].ln }); j++; } continue; }
            break;
          }
          if (indentOf(lt) >= 2) { body.push({ text: lt.replace(/^ {1,4}/, ''), ln: lines[j].ln }); j++; continue; }
          if (RE_FOOTDEF.test(lt) || interruptsParagraph(lines, j, opts)) break;
          if (!isBlank(body[body.length - 1].text)) { body.push({ text: lt, ln: lines[j].ln }); j++; continue; }
          break;
        }
        ctx.footnotes[m[1]] = { blocks: parseBlocks(body, ctx), line: line.ln };
        i = j;
        continue;
      }

      // Link reference definition
      m = RE_LINKDEF.exec(t);
      if (m) { ctx.refs[m[1].toLowerCase().trim()] = { url: m[2] }; i++; continue; }

      // Blockquote
      if (RE_QUOTE.test(t)) {
        const inner = [];
        let j = i;
        while (j < n) {
          const lt = lines[j].text;
          const qm = RE_QUOTE.exec(lt);
          if (qm) { inner.push({ text: qm[1], ln: lines[j].ln }); j++; continue; }
          if (!isBlank(lt) && inner.length && !isBlank(inner[inner.length - 1].text) && !interruptsParagraph(lines, j, opts)) {
            inner.push({ text: lt, ln: lines[j].ln }); j++; continue;
          }
          break;
        }
        blocks.push({ type: 'quote', children: parseBlocks(inner, ctx), start: line.ln, end: lines[j - 1].ln });
        i = j;
        continue;
      }

      // Pipe table
      if (isTableStart(lines, i)) {
        const head = splitRow(t);
        const align = splitRow(lines[i + 1].text).map((c) => {
          const l = c.startsWith(':'), r = c.endsWith(':');
          return l && r ? 'c' : r ? 'r' : 'l';
        });
        const rows = [];
        let j = i + 2;
        while (j < n && !isBlank(lines[j].text) && (lines[j].text.indexOf('|') >= 0) && !interruptsParagraphStrict(lines, j)) {
          rows.push({ cells: splitRow(lines[j].text), ln: lines[j].ln });
          j++;
        }
        blocks.push({ type: 'table', head: { cells: head, ln: line.ln }, align, rows, start: line.ln, end: lines[j - 1].ln });
        i = j;
        continue;
      }

      // Line block → verse
      if (RE_LINEBLOCK.test(t)) {
        const body = [];
        let j = i;
        while (j < n && (RE_LINEBLOCK.test(lines[j].text) || (body.length && /^ +\S/.test(lines[j].text) && !isBlank(lines[j].text)))) {
          const lt = lines[j].text;
          if (RE_LINEBLOCK.test(lt)) body.push({ text: lt.replace(/^\| ?/, ''), ln: lines[j].ln });
          else body[body.length - 1].text += ' ' + lt.trim();
          j++;
        }
        blocks.push({ type: 'verse', lines: body, start: line.ln, end: lines[j - 1].ln, lineBlock: true });
        i = j;
        continue;
      }

      // Lists
      const lm = listMarker(t);
      if (lm) {
        const res = parseList(lines, i, lm, ctx);
        blocks.push(res.block);
        i = res.next;
        continue;
      }

      // Indented code (opt-in)
      if (opts.indentedCode && indentOf(t) >= 4) {
        const body = [];
        let j = i;
        while (j < n && (indentOf(lines[j].text) >= 4 || isBlank(lines[j].text))) { body.push({ text: lines[j].text.slice(4), ln: lines[j].ln }); j++; }
        while (body.length && isBlank(body[body.length - 1].text)) body.pop();
        blocks.push({ type: 'code', lang: '', lines: body.map((b) => b.text), start: line.ln, end: body[body.length - 1].ln });
        i = j;
        continue;
      }

      // Definition list: a term line followed by ": definition"
      if (i + 1 < n && (RE_DEF.test(lines[i + 1].text) || (isBlank(lines[i + 1].text) && i + 2 < n && RE_DEF.test(lines[i + 2].text)))) {
        const res = parseDefList(lines, i, ctx);
        if (res) { blocks.push(res.block); i = res.next; continue; }
      }

      // Paragraph (or setext heading)
      const para = [{ text: t.replace(/^\s+/, ''), ln: line.ln }];
      let j = i + 1;
      let setext = 0;
      while (j < n) {
        const lt = lines[j].text;
        if (isBlank(lt)) break;
        const sm = RE_SETEXT.exec(lt);
        if (sm) { setext = sm[1][0] === '=' ? 1 : 2; j++; break; }
        if (interruptsParagraph(lines, j, opts)) break;
        para.push({ text: lt.replace(/^\s+/, ''), ln: lines[j].ln });
        j++;
      }
      if (setext) {
        blocks.push({ type: 'heading', level: setext, text: para.map((p) => p.text).join(' ').trim(), attrs: parseAttrs(''), start: line.ln, end: lines[j - 1].ln });
      } else {
        blocks.push({ type: 'para', lines: para, start: line.ln, end: para[para.length - 1].ln });
      }
      i = j;
    }
    return postProcess(blocks);
  }

  function interruptsParagraphStrict(lines, j) {
    const t = lines[j].text;
    return RE_ATX.test(t) || RE_FENCE.test(t) || RE_QUOTE.test(t) || RE_DIV_OPEN.test(t);
  }

  function fenceBlock(info, body, start, end) {
    const word = info.split(/\s+/)[0].toLowerCase();
    if (/^(verse|poem|poetry)$/.test(word)) return { type: 'verse', lines: body, start, end };
    if (/^\{?=(latex|tex)\}?$/.test(word) || word === 'rawlatex') return { type: 'raw', content: body.map((b) => b.text).join('\n'), start, end };
    if (word === 'math') return { type: 'math', content: body.map((b) => b.text).join('\n').trim(), start, end };
    return { type: 'code', lang: word.replace(/^\{?\.?/, '').replace(/\}$/, ''), lines: body.map((b) => b.text), start, end };
  }

  function parseList(lines, i, first, ctx) {
    const n = lines.length;
    const items = [];
    let j = i;
    let loose = false;
    const startLn = lines[i].ln;
    let endLn = startLn;

    while (j < n) {
      const lm = listMarker(lines[j].text);
      if (!lm || lm.ordered !== first.ordered || lm.ch !== first.ch || lm.indent > first.indent + 3) break;
      const body = [{ text: lm.text, ln: lines[j].ln }];
      const contentIndent = lm.empty ? lm.indent + 2 : lm.content;
      const itemStart = lines[j].ln;
      j++;
      while (j < n) {
        const lt = lines[j].text;
        if (isBlank(lt)) { body.push({ text: '', ln: lines[j].ln }); j++; continue; }
        const ind = indentOf(lt);
        if (ind >= contentIndent) { body.push({ text: lt.slice(contentIndent), ln: lines[j].ln }); j++; continue; }
        const sub = listMarker(lt);
        if (sub && ind > lm.indent && !(isBlank(body[body.length - 1].text) && ind < contentIndent && sub.ordered === first.ordered && sub.ch === first.ch && ind <= first.indent)) {
          body.push({ text: lt.slice(Math.min(ind, contentIndent)), ln: lines[j].ln }); j++; continue;
        }
        if (!isBlank(body[body.length - 1].text) && !sub && !interruptsParagraph(lines, j, ctx.opts)) {
          body.push({ text: lt.trim(), ln: lines[j].ln }); j++; continue;
        }
        break;
      }
      let trailing = 0;
      while (body.length > 1 && isBlank(body[body.length - 1].text)) { body.pop(); trailing++; }
      // A blank line between two block children inside the item makes the list loose.
      const children = parseBlocks(body, ctx);
      const innerBlank = body.some((b, k) => k > 0 && isBlank(b.text) && k < body.length - 1);
      if (innerBlank && children.length > 1) loose = true;
      let task = null;
      if (children[0] && children[0].type === 'para') {
        const tm = /^\[([ xX])\][ \t]+/.exec(children[0].lines[0].text);
        if (tm) { task = tm[1] !== ' '; children[0].lines[0] = { text: children[0].lines[0].text.slice(tm[0].length), ln: children[0].lines[0].ln }; }
      }
      items.push({ children, task, start: itemStart, end: body[body.length - 1].ln });
      endLn = body[body.length - 1].ln;
      if (trailing) {
        const next = j < n ? listMarker(lines[j].text) : null;
        if (next && next.ordered === first.ordered && next.ch === first.ch && next.indent <= first.indent + 3) loose = true;
        else break;
      }
    }
    return {
      block: { type: 'list', ordered: first.ordered, startNum: first.num || 1, items, loose, start: startLn, end: endLn },
      next: j
    };
  }

  function parseDefList(lines, i, ctx) {
    const n = lines.length;
    const items = [];
    let j = i;
    while (j < n) {
      if (isBlank(lines[j].text) || RE_DEF.test(lines[j].text)) break;
      const term = { text: lines[j].text.trim(), ln: lines[j].ln };
      let k = j + 1;
      if (k < n && isBlank(lines[k].text)) k++;
      if (!(k < n && RE_DEF.test(lines[k].text))) break;
      const defs = [];
      while (k < n && RE_DEF.test(lines[k].text)) {
        const body = [{ text: RE_DEF.exec(lines[k].text)[1], ln: lines[k].ln }];
        k++;
        while (k < n) {
          const lt = lines[k].text;
          if (isBlank(lt)) {
            let q = k;
            while (q < n && isBlank(lines[q].text)) q++;
            if (q < n && indentOf(lines[q].text) >= 2 && !RE_DEF.test(lines[q].text)) { while (k < q) { body.push({ text: '', ln: lines[k].ln }); k++; } continue; }
            break;
          }
          if (RE_DEF.test(lt)) break;
          if (indentOf(lt) >= 2) { body.push({ text: lt.replace(/^ {1,4}/, ''), ln: lines[k].ln }); k++; continue; }
          if (!isBlank(body[body.length - 1].text) && !interruptsParagraph(lines, k, ctx.opts)) { body.push({ text: lt, ln: lines[k].ln }); k++; continue; }
          break;
        }
        defs.push(parseBlocks(body, ctx));
        if (k < n && isBlank(lines[k].text) && k + 1 < n && RE_DEF.test(lines[k + 1].text)) k++;
      }
      items.push({ term, defs, start: term.ln, end: lines[k - 1].ln });
      j = k;
      while (j < n && isBlank(lines[j].text)) {
        // Continue only when another term-definition pair follows.
        const t2 = j + 1;
        if (t2 < n && !isBlank(lines[t2].text) && ((t2 + 1 < n && RE_DEF.test(lines[t2 + 1].text)) || (t2 + 2 < n && isBlank(lines[t2 + 1].text) && RE_DEF.test(lines[t2 + 2].text)))) { j++; break; }
        return finish();
      }
    }
    return items.length ? finish() : null;
    function finish() {
      return { block: { type: 'deflist', items, start: items[0].start, end: items[items.length - 1].end }, next: j };
    }
  }

  function postProcess(blocks) {
    const out = [];
    for (let k = 0; k < blocks.length; k++) {
      const b = blocks[k];
      // "Table: caption" next to a table becomes its caption.
      if (b.type === 'para' && b.lines.length === 1 && RE_CAPTION.test(b.lines[0].text)) {
        const prev = out[out.length - 1], next = blocks[k + 1];
        const target = prev && prev.type === 'table' && !prev.caption ? prev : next && next.type === 'table' && !next.caption ? next : null;
        if (target) {
          let cap = RE_CAPTION.exec(b.lines[0].text)[1].trim();
          const am = /\s*\{([^{}]*)\}\s*$/.exec(cap);
          if (am) { target.capAttrs = parseAttrs(am[1]); cap = cap.slice(0, am.index); }
          target.caption = { text: cap, ln: b.lines[0].ln };
          continue;
        }
      }
      // A paragraph that is only an image becomes a figure.
      if (b.type === 'para' && b.lines.length === 1) {
        const im = /^!\[((?:[^\]\\]|\\.)*)\]\(\s*<?([^\s>)]+)>?(?:\s+["'(]([^"')]*)["')])?\s*\)(\{[^}]*\})?\s*$/.exec(b.lines[0].text);
        if (im) {
          out.push({ type: 'figure', alt: im[1], url: im[2], title: im[3] || '', attrs: im[4] ? parseAttrs(im[4].slice(1, -1)) : null, ln: b.lines[0].ln, start: b.start, end: b.end });
          continue;
        }
      }
      out.push(b);
    }
    return out;
  }

  // ------------------------------------------------------------------ block rendering

  const HEADINGS = {
    part: ['part', 'chapter', 'section', 'subsection', 'subsubsection', 'paragraph'],
    chapter: ['chapter', 'section', 'subsection', 'subsubsection', 'paragraph', 'subparagraph'],
    section: ['section', 'subsection', 'subsubsection', 'paragraph', 'subparagraph', 'subparagraph']
  };

  function inlineFromLines(lines, ctx, flags) {
    let items = lines;
    if (ctx.opts.dehyphenate && lines.length > 1) {
      items = [];
      for (const l of lines) {
        const prev = items[items.length - 1];
        if (prev && /[\p{Ll}]-$/u.test(prev.text) && /^[\p{Ll}]/u.test(l.text) && !/ {2,}$/.test(prev.text)) {
          const word = /(\S+)-$/.exec(prev.text)[1] + '-' + /^\S+/.exec(l.text)[0];
          ctx.change('dehyphen', prev.ln, word, word.replace('-', ''));
          prev.parts.push({ text: l.text, ln: l.ln, joined: true });
          prev.text = prev.text.slice(0, -1) + l.text;
          continue;
        }
        items.push({ text: l.text, ln: l.ln, parts: [{ text: l.text, ln: l.ln }] });
      }
    } else items = lines.map((l) => ({ text: l.text, ln: l.ln, parts: [{ text: l.text, ln: l.ln }] }));

    // Build the paragraph source and a position → line table.
    const starts = [];
    let src = '';
    items.forEach((it, idx) => {
      if (idx) src += '\n';
      let pos = src.length;
      it.parts.forEach((p, pi) => {
        starts.push({ pos, ln: p.ln });
        pos += pi === 0 ? p.text.length - (it.parts.length > 1 ? 1 : 0) : p.text.length;
      });
      src += it.text;
    });
    const lineOf = (pos) => {
      let lo = 0, hi = starts.length - 1, ans = starts.length ? starts[0].ln : null;
      while (lo <= hi) {
        const mid = (lo + hi) >> 1;
        if (starts[mid].pos <= pos) { ans = starts[mid].ln; lo = mid + 1; } else hi = mid - 1;
      }
      return ans;
    };
    const parse = inlineParser(ctx, lineOf);
    const nodes = parse(src, 0);
    let latex = renderInlines(nodes, ctx, flags || {});
    // A break at the very start or end of a paragraph is an error in LaTeX.
    latex = latex.replace(new RegExp('^(?:\\s|' + BR + ')+'), '').replace(new RegExp('(?:\\s|' + BR + ')+$'), '');
    return { latex, nodes };
  }

  function renderBlocks(blocks, ctx, o) {
    o = o || {};
    const parts = [];
    for (const b of blocks) {
      const s = renderBlock(b, ctx, o);
      if (s === null || s === undefined || s === '') continue;
      if (o.noMap || b.start === undefined) parts.push(s);
      else {
        const id = ctx.blockMap.push({ start: b.start, end: b.end }) - 1;
        parts.push(B_OPEN + id + B_SEP + s + B_CLOSE + id + B_SEP);
      }
    }
    return parts.join(o.tight ? '\n' : '\n\n');
  }

  function renderBlock(b, ctx, o) {
    const opts = ctx.opts;
    switch (b.type) {
      case 'para': return inlineFromLines(b.lines, ctx).latex;

      case 'heading': {
        const names = HEADINGS[opts.topLevel] || HEADINGS.section;
        const cmd = names[Math.min(b.level, 6) - 1];
        const star = !opts.numbered || b.attrs.classes.includes('unnumbered') || b.attrs.classes.includes('unlisted') ? '*' : '';
        if (cmd === 'chapter' || (cmd === 'part' && opts.topLevel !== 'section')) ctx.needsChapters = true;
        const line = [{ text: b.text, ln: b.start }];
        const full = inlineFromLines(line, ctx, { heading: true });
        let title = full.latex;
        const withNotes = renderInlines(full.nodes, ctx, {}).replace(/^\s+|\s+$/g, '');
        let head;
        if (withNotes !== title) head = '\\' + cmd + star + (star ? '' : '[' + title + ']') + '{' + withNotes.replace(new RegExp(BR + '\\n?', 'g'), ' ') + '}';
        else head = '\\' + cmd + star + '{' + title + '}';
        if (b.attrs.id) head += '\\label{' + escapeLabel(b.attrs.id) + '}';
        return head;
      }

      case 'quote': {
        const kids = b.children.slice();
        let attribution = null;
        const last = kids[kids.length - 1];
        if (last && last.type === 'para' && last.lines.length === 1 && kids.length > 1) {
          const am = /^(?:—|―|--+|~)\s*(\S.*)$/.exec(last.lines[0].text);
          if (am) { attribution = { text: am[1], ln: last.lines[0].ln }; kids.pop(); }
        }
        let body = renderBlocks(kids, ctx, { noMap: o.noMap });
        if (attribution) body += '\n\n\\hspace*{\\fill}--- ' + inlineFromLines([attribution], ctx).latex;
        const paras = kids.filter((k) => k.type === 'para').length;
        const env = paras > 1 ? 'quotation' : 'quote';
        return '\\begin{' + env + '}\n' + indent(body, 2) + '\n\\end{' + env + '}';
      }

      case 'list': {
        ctx.listDepth++;
        if (b.ordered) ctx.enumDepth++;
        if (ctx.listDepth > 4) ctx.warn(b.start, 'Lists nest more than four deep; standard LaTeX stops at four');
        const env = b.ordered ? 'enumerate' : 'itemize';
        const lines = [];
        if (b.ordered && b.startNum !== 1) {
          const counter = 'enum' + ['i', 'ii', 'iii', 'iv'][Math.min(ctx.enumDepth, 4) - 1];
          lines.push('\\setcounter{' + counter + '}{' + (b.startNum - 1) + '}');
        }
        const rendered = b.items.map((it) => {
          let label = '\\item' + ITEM;
          if (it.task !== null) { ctx.use('amssymb', 'task-list boxes'); label = '\\item[' + (it.task ? '$\\boxtimes$' : '$\\square$') + ']'; }
          const kids = it.children;
          let s;
          if (kids.length && kids[0].type === 'para') {
            const first = inlineFromLines(kids[0].lines, ctx).latex;
            const rest = renderBlocks(kids.slice(1), ctx, { noMap: o.noMap });
            s = label + ' ' + first + (rest ? '\n' + (b.loose ? '\n' : '') + indent(rest, 2) : '');
          } else {
            const rest = renderBlocks(kids, ctx, { noMap: o.noMap });
            s = label + (rest ? '\n' + indent(rest, 2) : '');
          }
          if (o.noMap) return s;
          const id = ctx.blockMap.push({ start: it.start, end: it.end }) - 1;
          return B_OPEN + id + B_SEP + s + B_CLOSE + id + B_SEP;
        });
        ctx.listDepth--;
        if (b.ordered) ctx.enumDepth--;
        return '\\begin{' + env + '}\n' + indent(lines.concat(rendered).join(b.loose ? '\n\n' : '\n'), 2) + '\n\\end{' + env + '}';
      }

      case 'deflist': {
        const items = b.items.map((it) => {
          const term = inlineFromLines([it.term], ctx).latex;
          const label = /[\]]/.test(term) ? '{' + term + '}' : term;
          const defs = it.defs.map((d) => renderBlocks(d, ctx, { noMap: true })).join('\n\n');
          return '\\item[' + label + '] ' + defs.replace(/\n/g, '\n  ');
        });
        return '\\begin{description}\n' + indent(items.join('\n'), 2) + '\n\\end{description}';
      }

      case 'table': {
        const cols = Math.max(b.head.cells.length, b.align.length);
        const pad = (cells, ln) => {
          if (cells.length > cols) ctx.warn(ln, 'Table row has more cells than the header; extras dropped');
          const c = cells.slice(0, cols);
          while (c.length < cols) c.push('');
          return c;
        };
        const headCells = pad(b.head.cells, b.head.ln);
        const body = b.rows.map((r) => ({ cells: pad(r.cells, r.ln), ln: r.ln }));
        // Long text columns wrap: give them a paragraph column.
        const widths = [];
        for (let c = 0; c < cols; c++) {
          let max = headCells[c].length;
          for (const r of body) max = Math.max(max, r.cells[c].length);
          widths.push(max);
        }
        const total = widths.reduce((a, w) => a + Math.min(w, 60), 0) || 1;
        const longText = widths.some((w) => w > 40);
        const spec = b.align.slice(0, cols).concat(Array(Math.max(0, cols - b.align.length)).fill('l')).map((a, c) => {
          if (longText && widths[c] > 24) return 'p{' + (Math.min(widths[c], 60) / total * 0.9).toFixed(2) + '\\linewidth}';
          return a;
        });
        const cell = (s, ln) => inlineFromLines([{ text: s, ln }], ctx).latex;
        const row = (r) => r.cells.map((s) => cell(s, r.ln)).join(' & ') + ' \\\\';
        const grid = opts.tables === 'grid';
        if (!grid) ctx.use('booktabs', 'tables');
        const lines = [];
        lines.push('\\begin{tabular}{' + (grid ? '|' + spec.join('|') + '|' : spec.join('')) + '}');
        lines.push(grid ? '  \\hline' : '  \\toprule');
        lines.push('  ' + row({ cells: headCells, ln: b.head.ln }));
        lines.push(grid ? '  \\hline' : '  \\midrule');
        for (const r of body) { lines.push('  ' + row(r)); if (grid) lines.push('  \\hline'); }
        if (!grid) lines.push('  \\bottomrule');
        lines.push('\\end{tabular}');
        const tab = lines.join('\n');
        if (b.caption) {
          let s = '\\begin{table}[htbp]\n  \\centering\n' + indent(tab, 2) + '\n  \\caption{' + cell(b.caption.text, b.caption.ln) + '}';
          if (b.capAttrs && b.capAttrs.id) s += '\n  \\label{' + escapeLabel(b.capAttrs.id) + '}';
          return s + '\n\\end{table}';
        }
        return '\\begin{center}\n' + indent(tab, 2) + '\n\\end{center}';
      }

      case 'code': {
        const body = b.lines.map((l) => NOINDENT + l).join('\n');
        if (opts.code === 'listings') {
          ctx.use('listings', 'code blocks');
          const lang = LISTINGS_LANGS[b.lang];
          return '\\begin{lstlisting}' + (lang ? '[language=' + lang + ']' : '') + '\n' + body + '\n' + NOINDENT + '\\end{lstlisting}';
        }
        if (b.lines.some((l) => /\\end\{verbatim\}/.test(l))) ctx.warn(b.start, 'Code contains \\end{verbatim}, which ends the block early');
        return '\\begin{verbatim}\n' + body + '\n' + NOINDENT + '\\end{verbatim}';
      }

      case 'verse': {
        const stanzas = [[]];
        for (const l of b.lines) {
          if (isBlank(l.text)) { if (stanzas[stanzas.length - 1].length) stanzas.push([]); continue; }
          stanzas[stanzas.length - 1].push(l);
        }
        if (!stanzas[stanzas.length - 1].length) stanzas.pop();
        const body = stanzas.map((st) => st.map((l) => {
          const raw = l.text.replace(/\u00A0/g, ' ');
          const lead = indentOf(raw);
          const text = inlineFromLines([{ text: raw.trim().replace(/ {2,}$/, ''), ln: l.ln }], ctx).latex.replace(new RegExp(BR + '\\n?', 'g'), ' ');
          const id = ctx.blockMap.push({ start: l.ln, end: l.ln }) - 1;
          const ind = lead >= 2 ? '\\hspace*{' + (Math.round(lead / 2) * 1) + 'em}' : '';
          return B_OPEN + id + B_SEP + ind + text + B_CLOSE + id + B_SEP;
        }).join(BR + '\n')).join('\n\n');
        return '\\begin{verse}\n' + indent(body, 2) + '\n\\end{verse}';
      }

      case 'div': {
        const name = b.name || 'center';
        if (!STD_ENVS.has(name)) ctx.warn(b.start, 'Environment "' + name + '" is not standard LaTeX; make sure your preamble defines it');
        const body = renderBlocks(b.children, ctx, { noMap: o.noMap });
        let s = '\\begin{' + name + '}\n' + indent(body, 2) + '\n\\end{' + name + '}';
        if (b.attrs && b.attrs.id) s += '\\label{' + escapeLabel(b.attrs.id) + '}';
        return s;
      }

      case 'math':
        if (/^\\begin\{/.test(b.content)) return b.content.split('\n').map((l) => NOINDENT + l).join('\n');
        return '\\[\n' + indent(b.content, 2) + '\n\\]';

      case 'raw': return b.content.split('\n').map((l) => NOINDENT + l).join('\n');

      case 'comment': return b.lines.map((l) => '% ' + l.trim()).join('\n').replace(/% $/gm, '%');

      case 'hr':
        if (opts.sceneBreak === 'rule') return '\\par\\noindent\\rule{\\linewidth}{0.4pt}\\par';
        if (opts.sceneBreak === 'space') return '\\bigskip';
        return '\\begin{center}\n  *\\quad*\\quad*\n\\end{center}';

      case 'figure': {
        ctx.use('graphicx', 'images');
        const lines = ['\\begin{figure}[htbp]', '  \\centering', '  \\includegraphics' + graphicOpts(b.attrs, '[width=\\linewidth]') + '{' + escapeUrl(b.url) + '}'];
        if (b.alt.trim()) lines.push('  \\caption{' + inlineFromLines([{ text: b.alt, ln: b.ln }], ctx).latex + '}');
        if (b.attrs && b.attrs.id) lines.push('  \\label{' + escapeLabel(b.attrs.id) + '}');
        lines.push('\\end{figure}');
        return lines.join('\n');
      }
      default: return '';
    }
  }

  // ------------------------------------------------------------------ front matter

  function readFrontMatter(lines) {
    if (!lines.length || !/^---\s*$/.test(lines[0].text)) return null;
    let end = -1;
    for (let k = 1; k < lines.length; k++) if (/^(---|\.\.\.)\s*$/.test(lines[k].text)) { end = k; break; }
    if (end < 0) return null;
    const meta = {};
    let key = null;
    for (let k = 1; k < end; k++) {
      const t = lines[k].text;
      const kv = /^([A-Za-z][\w-]*):\s*(.*)$/.exec(t);
      if (kv) {
        key = kv[1].toLowerCase();
        const v = kv[2].trim().replace(/^["']|["']$/g, '');
        meta[key] = v ? { value: v, ln: lines[k].ln } : { list: [], ln: lines[k].ln };
        continue;
      }
      const item = /^\s*-\s+(.*)$/.exec(t);
      if (item && key && meta[key].list) { meta[key].list.push({ value: item[1].trim().replace(/^["']|["']$/g, ''), ln: lines[k].ln }); continue; }
      if (key && meta[key].value !== undefined && /^\s+\S/.test(t)) meta[key].value += ' ' + t.trim();
    }
    // Front matter has to look like metadata, or it is just a scene break.
    if (!Object.keys(meta).length) return null;
    return { meta, end };
  }

  // ------------------------------------------------------------------ finishing

  function finish(str, ctx) {
    const opts = ctx.opts;
    const tokRe = /\uE000(\d+)\uE001|\uE002|\uE003(\d+)\uE004|\uE005(\d+)\uE004|[\uE020-\uE024]|\uE300|\uE301|\uE200|[^\uE000-\uE005\uE020-\uE024\uE200\uE300\uE301]+/g;
    const toks = [];
    let m;
    while ((m = tokRe.exec(str))) toks.push(m);

    // Decide every quote: csquotes pairs within a paragraph at equal brace depth.
    const qOut = new Map();
    if (opts.quotes === 'csquotes') {
      let depth = 0, stack = [];
      const flushUnpaired = () => { for (const s of stack) qOut.set(s.k, null); stack = []; };
      toks.forEach((t, k) => {
        const v = t[0];
        if (v.length > 1 || !/[\uE000-\uE3FF]/.test(v)) {
          for (let x = 0; x < v.length; x++) {
            const ch = v[x];
            if (ch === '\\') { x++; continue; }
            if (ch === '{') depth++;
            else if (ch === '}') depth--;
            else if (ch === '\n' && v[x + 1] === '\n') { flushUnpaired(); }
          }
          return;
        }
        if (v === Q_OD || v === Q_OS) stack.push({ k, v, depth });
        else if (v === Q_CD || v === Q_CS) {
          const want = v === Q_CD ? Q_OD : Q_OS;
          let found = -1;
          for (let s = stack.length - 1; s >= 0; s--) if (stack[s].v === want) { found = s; break; }
          if (found >= 0 && stack[found].depth === depth && found === stack.length - 1) {
            qOut.set(stack[found].k, '\\enquote{');
            qOut.set(k, '}');
            stack.splice(found, 1);
          } else if (v === Q_CS) qOut.set(k, "'");
          else qOut.set(k, null);
        }
      });
      flushUnpaired();
      if ([...qOut.values()].some((x) => x === '\\enquote{')) ctx.use('csquotes', 'quotations');
    }
    const texQuote = { [Q_OD]: '``', [Q_CD]: "''", [Q_OS]: '`', [Q_CS]: "'", [Q_AP]: "'" };

    let out = '';
    const marks = [], markStack = [];
    const bStart = [], bEnd = [];
    let lastWasQuote = false, guard = 0; // 1 after \\ or \item: wrap a following [ (or * after \\)
    toks.forEach((t, k) => {
      const v = t[0];
      if (t[1] !== undefined) { markStack.push({ c: +t[1], start: out.length }); return; }
      if (v === M_CLOSE) {
        const mk = markStack.pop();
        if (mk) marks.push({ start: mk.start, end: out.length, kind: ctx.changes[mk.c].kind, change: mk.c });
        return;
      }
      if (t[2] !== undefined) { bStart[+t[2]] = out.length; return; }
      if (t[3] !== undefined) { bEnd[+t[3]] = out.length; return; }
      if (v === NOINDENT) return;
      if (v === BR) { out += '\\\\'; guard = 2; lastWasQuote = false; return; }
      if (v === ITEM) { guard = 1; return; }
      if (texQuote[v] !== undefined) {
        let q = qOut.has(k) ? qOut.get(k) : undefined;
        if (q === undefined || q === null) q = texQuote[v];
        if (lastWasQuote && q !== '}' && !/^\\enquote/.test(q)) out += '\\,';
        out += q;
        lastWasQuote = q !== '}';
        guard = 0;
        return;
      }
      let s = v;
      if (guard) {
        const lead = /^\s*/.exec(s)[0];
        const rest = s.slice(lead.length);
        if (rest) {
          if (rest[0] === '[') s = lead + '{[}' + rest.slice(1);
          else if (rest[0] === '*' && guard === 2) s = lead + '{*}' + rest.slice(1);
          guard = 0;
        }
      }
      out += s;
      if (s.length) lastWasQuote = false;
    });
    return { out, marks, bStart, bEnd };
  }

  function lineStartsOf(s) {
    const starts = [0];
    for (let i = 0; i < s.length; i++) if (s.charCodeAt(i) === 10) starts.push(i + 1);
    return starts;
  }
  function lineAt(starts, pos) {
    let lo = 0, hi = starts.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (starts[mid] <= pos) lo = mid; else hi = mid - 1;
    }
    return lo + 1;
  }

  // ------------------------------------------------------------------ convert

  function convert(markdown, options) {
    const t0 = typeof performance !== 'undefined' ? performance.now() : Date.now();
    const opts = Object.assign({}, DEFAULTS, options || {});
    const ctx = makeContext(opts);
    let src = String(markdown == null ? '' : markdown);
    src = src.replace(/\r\n?|\u2028|\u2029/g, '\n');
    let lines = src.split('\n').map((text, k) => ({ text: expandTabs(text), ln: k + 1 }));

    const fm = readFrontMatter(lines);
    if (fm) {
      ctx.front = fm.meta;
      lines = lines.slice(fm.end + 1);
      if (!opts.document) ctx.warn(1, 'Front matter (title, author, date) is used in Document mode only');
    }

    const blocks = parseBlocks(lines, ctx);
    let body = renderBlocks(blocks, ctx, {});

    for (const id of Object.keys(ctx.footnotes)) {
      if (!ctx.usedNotes.has(id)) ctx.warn(ctx.footnotes[id].line, 'Footnote [^' + id + '] is defined but never referenced');
    }
    if (ctx.needsChapters && opts.topLevel !== 'section' && !opts.document) {
      ctx.warn(null, 'Chapters need the book or report document class');
    }
    for (const [script, info] of ctx.unicodeNotes) {
      const lines = [...info.lines].filter((x) => x != null).sort((a, b) => a - b);
      ctx.warn(lines[0] || null, script + ' (' + info.count + ') ' + (opts.unicode === 'ascii' ? 'kept as Unicode' : 'may need XeLaTeX or LuaLaTeX') + (lines.length ? ' · line' + (lines.length > 1 ? 's ' : ' ') + lines.slice(0, 6).join(', ') + (lines.length > 6 ? '…' : '') : ''));
    }

    // Quotes are paired while finishing, after the preamble exists; decide csquotes now.
    if (opts.quotes === 'csquotes' && /[]/.test(body)) ctx.use('csquotes', 'quotations');

    let full = body;
    let preamble = '';
    if (opts.document) {
      const parts = documentParts(ctx);
      preamble = parts.head;
      full = parts.head + body + parts.tail;
    }

    const fin = finish(full, ctx);
    const latex = fin.out.replace(/[ \t]+$/gm, '').replace(/\n{3,}/g, '\n\n').replace(/^\n+/, '') + (fin.out.trim() ? '\n' : '');
    // Whitespace cleanup can only shorten the string; recompute marks against it.
    const result = remap(fin, latex, ctx);
    const t1 = typeof performance !== 'undefined' ? performance.now() : Date.now();

    return {
      latex,
      changes: ctx.changes,
      marks: result.marks,
      blocks: result.blocks,
      packages: packageList(ctx),
      warnings: ctx.warnings,
      counts: countKinds(ctx.changes),
      front: ctx.front ? Object.keys(ctx.front) : [],
      stats: {
        inLines: src ? src.split('\n').length : 0,
        outLines: latex ? latex.split('\n').length - (latex.endsWith('\n') ? 1 : 0) : 0,
        inChars: src.length,
        outChars: latex.length,
        ms: Math.round((t1 - t0) * 10) / 10
      },
      preambleLines: preamble ? preamble.split('\n').length - 1 : 0
    };
  }

  // Map offsets from the raw finished string onto the cleaned one by walking both.
  function remap(fin, clean, ctx) {
    const raw = fin.out;
    const map = new Int32Array(raw.length + 1);
    let i = 0, j = 0;
    while (i < raw.length) {
      map[i] = j;
      if (raw[i] === clean[j]) { i++; j++; }
      else i++;
    }
    map[raw.length] = j;
    const marks = fin.marks.map((mk) => ({ start: map[mk.start], end: map[mk.end], kind: mk.kind, change: mk.change }));
    const starts = lineStartsOf(clean);
    const blocks = [];
    ctx.blockMap.forEach((b, id) => {
      if (fin.bStart[id] === undefined || fin.bEnd[id] === undefined) return;
      const a = lineAt(starts, map[fin.bStart[id]]);
      const e = lineAt(starts, Math.max(map[fin.bStart[id]], map[fin.bEnd[id]] - 1));
      blocks.push({ src: [b.start, b.end], out: [a, e] });
    });
    return { marks, blocks };
  }

  function countKinds(changes) {
    const counts = {};
    for (const k of Object.keys(KINDS)) counts[k] = 0;
    for (const c of changes) counts[c.kind] = (counts[c.kind] || 0) + 1;
    return counts;
  }

  const PKG_ORDER = ['fontenc', 'babel', 'csquotes', 'amssymb', 'graphicx', 'booktabs', 'ulem', 'soul', 'listings', 'hyperref'];
  function packageList(ctx) {
    const list = [];
    for (const [name, info] of ctx.need) {
      let options = info.options;
      if (name === 'babel' && ctx.langs) options = [...ctx.langs].join(',');
      list.push({ name, options, why: info.why.join(', ') });
    }
    list.sort((a, b) => PKG_ORDER.indexOf(a.name) - PKG_ORDER.indexOf(b.name));
    return list;
  }

  function documentParts(ctx) {
    const opts = ctx.opts;
    const meta = ctx.front || {};
    const metaInline = (entry) => entry ? inlineFromLines([{ text: entry.value, ln: entry.ln }], ctx).latex : '';
    let cls = opts.docClass;
    if (cls === 'auto') cls = meta.documentclass ? meta.documentclass.value : opts.topLevel === 'section' ? 'article' : 'book';
    const head = ['\\documentclass{' + cls + '}'];
    if (opts.unicode === 'keep') {
      head.push('% Compile with XeLaTeX or LuaLaTeX.');
      head.push('\\usepackage{fontspec}');
    } else {
      head.push('\\usepackage[T1]{fontenc}');
      head.push('\\usepackage{lmodern}');
    }
    head.push('\\usepackage{microtype}');
    const lang = meta.lang && BABEL[meta.lang.value.toLowerCase()];
    if (lang) { ctx.langs = ctx.langs || new Set(); ctx.langs.add(lang); ctx.use('babel', 'document language'); }
    // Render metadata first so any packages it needs make the preamble.
    const title = metaInline(meta.title);
    const subtitle = metaInline(meta.subtitle);
    const date = meta.date ? metaInline(meta.date) : '';
    let authors = '';
    if (meta.author) {
      authors = meta.author.list ? meta.author.list.map((a) => inlineFromLines([{ text: a.value, ln: a.ln }], ctx).latex).join(' \\and ') : metaInline(meta.author);
    }
    const abstract = meta.abstract && meta.abstract.value ? metaInline(meta.abstract) : '';
    for (const p of packageList(ctx)) {
      if (p.name === 'fontenc') continue;
      head.push('\\usepackage' + (p.options ? '[' + p.options + ']' : '') + '{' + p.name + '}');
    }
    const lines = head.concat(['']);
    if (title) {
      lines.push('\\title{' + title + (subtitle ? '\\\\\n  \\large ' + subtitle : '') + '}');
      if (authors) lines.push('\\author{' + authors + '}');
      lines.push('\\date{' + (meta.date ? date : '\\today') + '}');
      lines.push('');
    }
    lines.push('\\begin{document}');
    if (title) lines.push('\\maketitle');
    if (abstract) lines.push('', '\\begin{abstract}', '  ' + abstract, '\\end{abstract}');
    lines.push('', '');
    return { head: lines.join('\n'), tail: '\n\n\\end{document}' };
  }

  // Everything a fragment needs, as preamble lines to paste.
  function preambleFor(packages) {
    return packages.map((p) => '\\usepackage' + (p.options ? '[' + p.options + ']' : '') + '{' + p.name + '}').join('\n');
  }

  return { convert, DEFAULTS, KINDS, preambleFor, version: '1.0.0' };
});
