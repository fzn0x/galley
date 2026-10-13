(function () {
  'use strict';

  const G = window.Galley;
  const EXAMPLES = window.EXAMPLES || [];
  const $ = (id) => document.getElementById(id);

  // ---------------------------------------------------------------- elements

  const app = $('app');
  const ta = $('input');
  const inHl = $('in-hl');
  const inLines = document.createElement('div');
  inLines.className = 'ed-lines code paper';
  inHl.appendChild(inLines);
  const inMeta = $('in-meta');
  const outScroll = $('out-scroll');
  const out = $('out');
  out.classList.add('code', 'paper');
  const emptyEl = $('empty');
  const staleEl = $('stale');
  const preambleEl = $('preamble');
  const preambleList = $('preamble-list');
  const cellsEl = $('cells');
  const totalEl = $('total');
  const totalLabel = $('total-label');
  const bandNav = $('band-nav');
  const bandPos = $('band-pos');
  const notesBtn = $('notes-btn');
  const notesNum = $('notes-num');
  const notesSub = $('notes-sub');
  const tabCount = $('tab-count');
  const liveEl = $('live');
  const constructEl = $('construction');
  const examplesEl = $('examples');
  const themeBtn = $('theme');
  const fileInput = $('file');
  const dropEl = $('drop');
  const toastEl = $('toast');
  const toastText = $('toast-text');
  const toastAction = $('toast-action');

  const STORE = 'galley:v1';
  const isMac = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
  const MOD = isMac ? '⌘' : 'Ctrl';
  const narrow = window.matchMedia('(max-width: 820px)');
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  const KIND_ORDER = ['escape', 'quote', 'ellipsis', 'dash', 'tie', 'space', 'shorthand', 'unicode', 'invisible', 'ligature', 'dehyphen'];
  const KIND_NOTE = {
    escape: '% & $ # _ { } ~ ^ \\ < > |',
    quote: '"…" and curly quotes',
    ellipsis: '... . . . and …',
    dash: '— – and spaced hyphens',
    tie: 'Mr.~, p.~12, initials',
    space: 'e.g.\\ and BBC\\@.',
    shorthand: 'e. g. → e.g.',
    unicode: '§ ° £ ½ and friends',
    invisible: 'Soft hyphens, odd spaces',
    ligature: 'ﬁ ﬂ from PDFs',
    dehyphen: 'tran- scription'
  };
  const KIND_SHORT = {
    escape: 'Specials', quote: 'Quotes', ellipsis: 'Ellipses', dash: 'Dashes', tie: 'Ties', space: 'Spacing',
    shorthand: 'Shorthand', unicode: 'Symbols', invisible: 'Invisibles', ligature: 'Ligatures', dehyphen: 'Rejoined'
  };
  const DOTS = 16;

  const state = {
    opts: Object.assign({}, G.DEFAULTS),
    live: false,
    construct: true,
    shape: 'fragment',
    theme: document.documentElement.getAttribute('data-theme') || 'day',
    fileName: null,
    result: null,
    converted: null,     // input text at the last conversion
    focusKind: null,
    focusIndex: -1,
    tab: 'in',
    outToBlock: null,
    srcToBlock: null,
    hoverBlock: -1,
    caretLine: 1
  };

  // ---------------------------------------------------------------- storage

  function load() {
    try { return JSON.parse(localStorage.getItem(STORE) || 'null'); } catch (e) { return null; }
  }
  let saveTimer = 0;
  function save() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      try {
        localStorage.setItem(STORE, JSON.stringify({
          input: ta.value.length < 2e6 ? ta.value : '',
          opts: state.opts, live: state.live, construct: state.construct,
          shape: state.shape, theme: state.themeChosen ? state.theme : null, fileName: state.fileName
        }));
      } catch (e) { /* quota or blocked storage: keep working without it */ }
    }, 250);
  }

  // ---------------------------------------------------------------- helpers

  const escHtml = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const plural = (n, one, many) => n === 1 ? one : (many || one + 's');
  const fmt = (n) => n.toLocaleString('en-US');

  let toastTimer = 0;
  function toast(text, action) {
    toastText.textContent = text;
    toastAction.hidden = !action;
    if (action) {
      toastAction.textContent = action.label;
      toastAction.onclick = () => { hideToast(); action.run(); };
    }
    toastEl.hidden = false;
    toastEl.style.animation = 'none';
    void toastEl.offsetWidth;
    toastEl.style.animation = '';
    clearTimeout(toastTimer);
    toastTimer = setTimeout(hideToast, action ? 6000 : 2600);
  }
  function hideToast() { toastEl.hidden = true; }

  function copyText(text) {
    if (navigator.clipboard && window.isSecureContext) return navigator.clipboard.writeText(text);
    return new Promise((resolve, reject) => {
      const t = document.createElement('textarea');
      t.value = text;
      t.setAttribute('readonly', '');
      t.className = 'sr';
      document.body.appendChild(t);
      t.select();
      try { document.execCommand('copy') ? resolve() : reject(new Error('copy failed')); } catch (e) { reject(e); }
      t.remove();
    });
  }

  function download(name, text) {
    const blob = new Blob([text], { type: 'application/x-tex;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  // ---------------------------------------------------------------- Markdown highlighting (input mirror)

  const MD_INLINE = /(`+)([^`]|[^`][\s\S]*?[^`])\1(?!`)|(\$\$?)(?=\S)(?:\\.|[^$\\])+?\3|(\\[A-Za-z@]+\*?)|(\[\^[^\]\s]+\])|(\*\*|__)(?=\S)([\s\S]+?)(\6)|(\*|_)(?=[^\s*_])([\s\S]*?[^\s\\])\9(?![\w*])|(~~)(?=\S)([\s\S]+?)\11|(!?\[)([^\]]*)(\]\()([^)\s]*)((?:\s+"[^"]*")?\))|(<!--[\s\S]*?-->)|(\[@[^\]]+\])|(<https?:[^>\s]+>)/g;

  function mdInline(s) {
    let outS = '', last = 0, m;
    // A fresh regex per call: the recursion below would clobber a shared lastIndex.
    const re = new RegExp(MD_INLINE.source, 'g');
    while ((m = re.exec(s))) {
      outS += escHtml(s.slice(last, m.index));
      if (m[1]) outS += '<span class="md-code"><span class="md-delim">' + escHtml(m[1]) + '</span>' + escHtml(m[2]) + '<span class="md-delim">' + escHtml(m[1]) + '</span></span>';
      else if (m[3]) outS += '<span class="md-math">' + escHtml(m[0]) + '</span>';
      else if (m[4]) outS += '<span class="md-tex">' + escHtml(m[4]) + '</span>';
      else if (m[5]) outS += '<span class="md-fn">' + escHtml(m[5]) + '</span>';
      else if (m[6]) outS += '<span class="md-delim">' + m[6] + '</span><span class="md-strong">' + mdInline(m[7]) + '</span><span class="md-delim">' + m[8] + '</span>';
      else if (m[9]) outS += '<span class="md-delim">' + m[9] + '</span><span class="md-em">' + mdInline(m[10]) + '</span><span class="md-delim">' + m[9] + '</span>';
      else if (m[11]) outS += '<span class="md-delim">~~</span>' + mdInline(m[12]) + '<span class="md-delim">~~</span>';
      else if (m[13]) outS += '<span class="md-punct">' + escHtml(m[13]) + '</span><span class="md-link-u">' + mdInline(m[14]) + '</span><span class="md-punct">](' + escHtml(m[16]) + escHtml(m[17]) + '</span>';
      else if (m[18]) outS += '<span class="md-com">' + escHtml(m[18]) + '</span>';
      else if (m[19]) outS += '<span class="md-fn">' + escHtml(m[19]) + '</span>';
      else if (m[20]) outS += '<span class="md-link-u">' + escHtml(m[20]) + '</span>';
      else outS += escHtml(m[0]);
      last = m.index + m[0].length;
      if (m[0].length === 0) re.lastIndex++;
    }
    return outS + escHtml(s.slice(last));
  }

  function mdLines(text) {
    const lines = text.split('\n');
    const html = new Array(lines.length);
    let fence = null, math = false, front = lines[0] === '---' && lines.slice(1).some((l) => /^(---|\.\.\.)$/.test(l));
    for (let i = 0; i < lines.length; i++) {
      const l = lines[i];
      if (front) {
        html[i] = '<span class="md-attr">' + escHtml(l) + '</span>';
        if (i > 0 && /^(---|\.\.\.)$/.test(l)) front = false;
        continue;
      }
      if (fence) {
        if (new RegExp('^ {0,3}' + fence[0] + '{' + fence.length + ',}\\s*$').test(l)) { html[i] = '<span class="md-fence">' + escHtml(l) + '</span>'; fence = null; }
        else html[i] = escHtml(l);
        continue;
      }
      if (math) {
        html[i] = '<span class="md-math">' + escHtml(l) + '</span>';
        if (/\$\$\s*$/.test(l)) math = false;
        continue;
      }
      let m = /^( {0,3})(`{3,}|~{3,})(.*)$/.exec(l);
      if (m) { fence = m[2]; html[i] = '<span class="md-fence">' + escHtml(l) + '</span>'; continue; }
      if (/^ {0,3}\$\$/.test(l)) {
        html[i] = '<span class="md-math">' + escHtml(l) + '</span>';
        if (!/^ {0,3}\$\$.*\S.*\$\$\s*$/.test(l) && !/^ {0,3}\$\$.+\$\$/.test(l)) math = true;
        continue;
      }
      m = /^( {0,3})(#{1,6})(\s+)(.*?)(\s*\{[^}]*\})?\s*$/.exec(l);
      if (m) { html[i] = m[1] + '<span class="md-hm">' + m[2] + '</span>' + m[3] + '<span class="md-h">' + mdInline(m[4]) + '</span>' + (m[5] ? '<span class="md-attr">' + escHtml(m[5]) + '</span>' : ''); continue; }
      if (/^ {0,3}([-*_])(\s*\1){2,}\s*$/.test(l)) { html[i] = '<span class="md-hr">' + escHtml(l) + '</span>'; continue; }
      if (/^ {0,3}:{3,}/.test(l)) { html[i] = '<span class="md-div">' + escHtml(l) + '</span>'; continue; }
      m = /^(\s*)((?:> ?)+)(.*)$/.exec(l);
      if (m) { html[i] = m[1] + '<span class="md-quote">' + escHtml(m[2]) + '</span>' + mdInline(m[3]); continue; }
      m = /^( {0,3})(\[\^[^\]]+\]:)(.*)$/.exec(l);
      if (m) { html[i] = m[1] + '<span class="md-fn">' + escHtml(m[2]) + '</span>' + mdInline(m[3]); continue; }
      m = /^(\s*)([-*+]|\d{1,9}[.)])(\s+)(\[[ xX]\]\s+)?(.*)$/.exec(l);
      if (m) { html[i] = m[1] + '<span class="md-list">' + escHtml(m[2]) + '</span>' + m[3] + (m[4] ? '<span class="md-list">' + escHtml(m[4]) + '</span>' : '') + mdInline(m[5]); continue; }
      m = /^( {0,3}:)(\s+)(.*)$/.exec(l);
      if (m) { html[i] = '<span class="md-list">' + escHtml(m[1]) + '</span>' + m[2] + mdInline(m[3]); continue; }
      if (/^\s*\|/.test(l) || (/\|/.test(l) && /^\s*\|?\s*:?-+/.test(lines[i + 1] || ''))) {
        html[i] = l.split(/(\|)/).map((p) => p === '|' ? '<span class="md-pipe">|</span>' : (/^\s*:?-+:?\s*$/.test(p) ? '<span class="md-punct">' + escHtml(p) + '</span>' : mdInline(p))).join('');
        continue;
      }
      html[i] = mdInline(l);
    }
    return html;
  }

  let mirrorRaf = 0;
  function renderMirror() {
    cancelAnimationFrame(mirrorRaf);
    mirrorRaf = requestAnimationFrame(() => {
      const lines = mdLines(ta.value);
      let html = '';
      for (let i = 0; i < lines.length; i++) html += '<div class="ln" data-n="' + (i + 1) + '">' + lines[i] + '</div>';
      inLines.innerHTML = html;
      syncMirror();
      applyLinks();
    });
  }
  function syncMirror() {
    inLines.style.width = ta.clientWidth + 'px';
    inLines.style.transform = 'translate(' + (-ta.scrollLeft) + 'px,' + (-ta.scrollTop) + 'px)';
  }

  function updateInMeta() {
    const text = ta.value;
    const lines = text ? text.split('\n').length : 0;
    const words = (text.match(/\S+/g) || []).length;
    inMeta.innerHTML = fmt(lines) + ' ' + plural(lines, 'line') + '<span class="meta-words"> · ' + fmt(words) + ' ' + plural(words, 'word') + '</span>';
  }

  // ---------------------------------------------------------------- LaTeX highlighting (output)

  const TEX_RE = /(%[^\n]*)|(\\(?:begin|end))(\{)([^}\n]*)(\})|(\\[A-Za-z@]+\*?)|(\\[^A-Za-z\n])|(\$\$[\s\S]*?\$\$|\$(?:\\.|[^$\\\n])+\$|\\\[[\s\S]*?\\\]|\\\([\s\S]*?\\\))|([{}[\]])|([^%\\${}[\]]+|[\s\S])/g;

  function texTokens(s) {
    const toks = [];
    // Verbatim bodies are not LaTeX: leave them plain.
    const verb = /\\begin\{(verbatim|lstlisting)\}(?:\[[^\]\n]*\])?\n([\s\S]*?)\n(?=\\end\{\1\})/g;
    let from = 0, vm;
    const push = (a, b) => tokenize(s, a, b, toks);
    while ((vm = verb.exec(s))) {
      const bodyStart = vm.index + vm[0].length - vm[2].length;
      push(from, bodyStart);
      toks.push({ s: bodyStart, e: bodyStart + vm[2].length, c: '' });
      from = bodyStart + vm[2].length;
    }
    push(from, s.length);
    return toks;
  }
  function tokenize(s, a, b, toks) {
    if (a >= b) return;
    const sub = s.slice(a, b);
    TEX_RE.lastIndex = 0;
    let m;
    while ((m = TEX_RE.exec(sub))) {
      const st = a + m.index;
      if (m[1]) toks.push({ s: st, e: st + m[0].length, c: 't-com' });
      else if (m[2]) {
        let p = st;
        toks.push({ s: p, e: p += m[2].length, c: 't-cmd' });
        toks.push({ s: p, e: p += 1, c: 't-brace' });
        toks.push({ s: p, e: p += m[4].length, c: 't-env' });
        toks.push({ s: p, e: p += 1, c: 't-brace' });
      }
      else if (m[6]) toks.push({ s: st, e: st + m[0].length, c: 't-cmd' });
      else if (m[7]) toks.push({ s: st, e: st + m[0].length, c: 't-esc' });
      else if (m[8]) toks.push({ s: st, e: st + m[0].length, c: 't-math' });
      else if (m[9]) toks.push({ s: st, e: st + m[0].length, c: 't-brace' });
      else toks.push({ s: st, e: st + m[0].length, c: '' });
    }
  }

  // Build output lines: syntax tokens and construction marks, swept together.
  function outputLines(latex, marks) {
    const toks = texTokens(latex);
    const ms = marks.slice().sort((a, b) => a.start - b.start || a.end - b.end);
    const lines = [];
    let cur = '';
    let ti = 0, mi = 0, pos = 0;
    const emit = (text, cls, mk) => {
      const parts = text.split('\n');
      parts.forEach((p, k) => {
        if (k > 0) { lines.push(cur); cur = ''; }
        if (!p) return;
        let h = escHtml(p);
        if (cls) h = '<span class="' + cls + '">' + h + '</span>';
        if (mk) h = '<mark class="mk" data-k="' + mk.kind + '" data-i="' + mk.change + '">' + h + '</mark>';
        cur += h;
      });
    };
    while (pos < latex.length) {
      while (mi < ms.length && ms[mi].end <= pos && ms[mi].start < pos) mi++;
      while (mi < ms.length && ms[mi].start === pos && ms[mi].end === pos) {
        cur += '<mark class="mk z" data-k="' + ms[mi].kind + '" data-i="' + ms[mi].change + '" title="Removed: ' + escHtml(String(state.result.changes[ms[mi].change].from)) + '"></mark>';
        mi++;
      }
      while (ti < toks.length && toks[ti].e <= pos) ti++;
      const tok = toks[ti] || { s: pos, e: latex.length, c: '' };
      const mk = ms[mi];
      let end = tok.e;
      const inMark = mk && mk.start <= pos && pos < mk.end;
      if (inMark) end = Math.min(end, mk.end);
      else if (mk && mk.start > pos) end = Math.min(end, mk.start);
      if (end <= pos) end = pos + 1;
      emit(latex.slice(pos, end), tok.c, inMark ? mk : null);
      pos = end;
      if (inMark && pos >= mk.end) mi++;
    }
    while (mi < ms.length) {
      if (ms[mi].start === ms[mi].end) cur += '<mark class="mk z" data-k="' + ms[mi].kind + '" data-i="' + ms[mi].change + '"></mark>';
      mi++;
    }
    lines.push(cur);
    if (latex.endsWith('\n')) lines.pop();
    return lines;
  }

  // ---------------------------------------------------------------- convert

  function options() {
    return Object.assign({}, state.opts, { document: state.shape === 'document' });
  }

  function convertNow(opts) {
    const text = ta.value;
    let res;
    try {
      res = G.convert(text, options());
    } catch (err) {
      out.innerHTML = '<div class="ln" data-n="!">Galley could not convert this input: ' + escHtml(String(err && err.message || err)) + '. Please report it with the input that caused it.</div>';
      return;
    }
    state.result = res;
    state.converted = text;
    if (state.focusKind && !res.counts[state.focusKind]) { state.focusKind = null; state.focusIndex = -1; }
    renderOutput();
    renderBand();
    renderPreamble();
    renderNotes();
    renderStatus();
    buildMaps();
    applyLinks();
    setStale(false);
    if (opts && opts.reveal && narrow.matches) setTab('out');
  }

  function setStale(on) {
    const stale = on && !state.live;
    staleEl.hidden = !stale;
    out.classList.toggle('is-stale', stale);
  }

  let liveTimer = 0;
  function onInput() {
    updateInMeta();
    renderMirror();
    onCaret();
    emptyEl.hidden = !!ta.value || !state.result || state.result.latex !== '';
    if (state.live) {
      clearTimeout(liveTimer);
      const delay = Math.min(600, Math.max(90, ta.value.length / 1500));
      liveTimer = setTimeout(convertNow, delay);
    } else {
      setStale(ta.value !== state.converted);
    }
    save();
  }

  function renderOutput() {
    const res = state.result;
    const lines = res.latex ? outputLines(res.latex, res.marks) : [];
    let html = '';
    for (let i = 0; i < lines.length; i++) html += '<div class="ln" data-n="' + (i + 1) + '">' + lines[i] + '</div>';
    out.innerHTML = html;
    emptyEl.hidden = !!ta.value.trim();
    applyConstruction();
  }

  function applyConstruction() {
    out.classList.toggle('construct', state.construct);
    out.classList.toggle('has-focus', !!state.focusKind);
    if (state.focusKind) out.setAttribute('data-focus', state.focusKind);
    else out.removeAttribute('data-focus');
    constructEl.checked = state.construct;
  }

  // ---------------------------------------------------------------- source ↔ output mapping

  function buildMaps() {
    const res = state.result;
    const outN = res.stats.outLines + 2;
    const srcN = (ta.value.match(/\n/g) || []).length + 3;
    const outTo = new Int32Array(outN).fill(-1);
    const srcTo = new Int32Array(srcN).fill(-1);
    const order = res.blocks.map((b, i) => i).sort((a, b) => {
      const A = res.blocks[a], B = res.blocks[b];
      return (B.out[1] - B.out[0]) - (A.out[1] - A.out[0]);
    });
    for (const i of order) {
      const b = res.blocks[i];
      for (let l = b.out[0]; l <= b.out[1] && l < outN; l++) outTo[l] = i;
    }
    const orderSrc = res.blocks.map((b, i) => i).sort((a, b) => {
      const A = res.blocks[a], B = res.blocks[b];
      return (B.src[1] - B.src[0]) - (A.src[1] - A.src[0]);
    });
    for (const i of orderSrc) {
      const b = res.blocks[i];
      for (let l = b.src[0]; l <= b.src[1] && l < srcN; l++) srcTo[l] = i;
    }
    state.outToBlock = outTo;
    state.srcToBlock = srcTo;
  }

  let linked = { src: null, out: null };
  function applyLinks() {
    // Clear previous highlights.
    for (const el of inLines.querySelectorAll('.ln.src, .ln.cur')) el.classList.remove('src', 'cur');
    for (const el of out.querySelectorAll('.ln.link')) el.classList.remove('link');
    const res = state.result;
    const caretEl = inLines.children[state.caretLine - 1];
    if (caretEl) caretEl.classList.add('cur');
    if (!res || !state.srcToBlock || ta.value !== state.converted) { linked = { src: null, out: null }; return; }
    let bi = state.hoverBlock;
    const fromHover = bi >= 0;
    if (!fromHover && document.activeElement === ta) bi = state.srcToBlock[state.caretLine] ?? -1;
    if (bi < 0 || !res.blocks[bi]) { linked = { src: null, out: null }; return; }
    const b = res.blocks[bi];
    for (let l = b.src[0]; l <= b.src[1]; l++) { const el = inLines.children[l - 1]; if (el) el.classList.add('src'); }
    for (let l = b.out[0]; l <= b.out[1]; l++) { const el = out.children[l - 1]; if (el) el.classList.add('link'); }
    linked = { src: b.src, out: b.out };
    if (!fromHover) revealOut(b.out[0], b.out[1]);
  }

  function revealOut(a, b) {
    const first = out.children[a - 1];
    const last = out.children[b - 1] || first;
    if (!first) return;
    const top = first.offsetTop, bottom = last.offsetTop + last.offsetHeight;
    const viewTop = outScroll.scrollTop, viewBottom = viewTop + outScroll.clientHeight;
    if (top >= viewTop && bottom <= viewBottom) return;
    const target = bottom - top > outScroll.clientHeight ? top - 24 : top - (outScroll.clientHeight - (bottom - top)) / 2;
    outScroll.scrollTo({ top: Math.max(0, target), behavior: reduceMotion.matches ? 'auto' : 'smooth' });
  }

  function caretLine() {
    const pos = ta.selectionStart;
    const before = ta.value.slice(0, pos);
    const line = (before.match(/\n/g) || []).length + 1;
    const col = pos - before.lastIndexOf('\n');
    return { line, col };
  }

  let caretRaf = 0;
  function onCaret() {
    cancelAnimationFrame(caretRaf);
    caretRaf = requestAnimationFrame(() => {
      const c = caretLine();
      state.caretLine = c.line;
      $('st-pos').innerHTML = 'Ln <span class="num">' + c.line + '</span>, Col <span class="num">' + c.col + '</span>';
      applyLinks();
    });
  }

  out.addEventListener('mousemove', (e) => {
    const ln = e.target.closest && e.target.closest('.ln');
    if (!ln || !state.outToBlock) return;
    const n = +ln.getAttribute('data-n');
    const bi = state.outToBlock[n] ?? -1;
    if (bi !== state.hoverBlock) { state.hoverBlock = bi; applyLinks(); }
  });
  out.addEventListener('mouseleave', () => { state.hoverBlock = -1; applyLinks(); });

  // ---------------------------------------------------------------- construction band

  function renderBand() {
    const res = state.result;
    const counts = res.counts;
    const total = res.changes.length;
    totalEl.textContent = fmt(total);
    totalLabel.textContent = plural(total, 'change');
    tabCount.textContent = fmt(total);
    const inLinesN = Math.max(1, res.stats.inLines);
    const buckets = {};
    for (const k of KIND_ORDER) buckets[k] = new Uint8Array(DOTS);
    for (const c of res.changes) {
      if (c.line == null || !buckets[c.kind]) continue;
      buckets[c.kind][Math.min(DOTS - 1, Math.floor((c.line - 1) / inLinesN * DOTS))] = 1;
    }
    let html = '';
    for (const k of KIND_ORDER) {
      const n = counts[k] || 0;
      const pressed = state.focusKind === k;
      let dots = '';
      for (let d = 0; d < DOTS; d++) dots += buckets[k][d] ? '<i class="on"></i>' : '<i></i>';
      html += '<button type="button" class="cell" data-kind="' + k + '" aria-pressed="' + pressed + '"' + (n ? '' : ' disabled') +
        ' title="' + escHtml(G.KINDS[k] + ': ' + KIND_NOTE[k]) + '">' +
        '<span class="cell-label">' + escHtml(KIND_SHORT[k]) + '</span>' +
        '<span class="cell-num num">' + fmt(n) + '</span>' +
        '<span class="cell-dots" aria-hidden="true">' + dots + '</span>' +
        '<span class="sr">, ' + plural(n, 'change') + '</span>' +
        '</button>';
    }
    cellsEl.innerHTML = html;
    renderNav();
  }

  function focusMarks() {
    if (!state.focusKind) return [];
    const seen = new Set();
    const list = [];
    for (const el of out.querySelectorAll('.mk[data-k="' + state.focusKind + '"]')) {
      const i = el.getAttribute('data-i');
      if (seen.has(i)) continue;
      seen.add(i);
      list.push(i);
    }
    return list;
  }

  function renderNav() {
    if (!state.focusKind) { bandNav.hidden = true; return; }
    const list = focusMarks();
    bandNav.hidden = false;
    const idx = state.focusIndex;
    bandPos.textContent = KIND_SHORT[state.focusKind] + ' ' + (idx >= 0 ? idx + 1 : '–') + ' / ' + list.length;
  }

  function setFocusKind(kind) {
    state.focusKind = state.focusKind === kind ? null : kind;
    state.focusIndex = -1;
    if (state.focusKind && !state.construct) { state.construct = true; save(); }
    applyConstruction();
    for (const b of cellsEl.querySelectorAll('.cell')) b.setAttribute('aria-pressed', String(b.getAttribute('data-kind') === state.focusKind));
    clearCurrent();
    if (state.focusKind) step(1);
    renderNav();
  }

  function clearCurrent() { for (const el of out.querySelectorAll('.mk.cur')) el.classList.remove('cur'); }

  function step(dir) {
    if (!state.focusKind) return;
    const list = focusMarks();
    if (!list.length) return;
    state.focusIndex = state.focusIndex < 0 ? (dir > 0 ? 0 : list.length - 1) : (state.focusIndex + dir + list.length) % list.length;
    clearCurrent();
    const id = list[state.focusIndex];
    const els = out.querySelectorAll('.mk[data-i="' + id + '"]');
    els.forEach((el) => { el.classList.add('cur'); el.classList.remove('flash'); void el.offsetWidth; el.classList.add('flash'); });
    if (els[0]) {
      const ln = els[0].closest('.ln');
      if (ln) {
        const top = ln.offsetTop - outScroll.clientHeight / 2 + 12;
        outScroll.scrollTo({ top: Math.max(0, top), behavior: reduceMotion.matches ? 'auto' : 'smooth' });
      }
    }
    if (narrow.matches && state.tab === 'band') setTab('out');
    const ch = state.result.changes[+id];
    renderNav();
    if (ch) bandPos.title = (ch.line ? 'Line ' + ch.line + ': ' : '') + ch.from + ' → ' + (ch.to === '' ? 'removed' : ch.to);
  }

  cellsEl.addEventListener('click', (e) => {
    const b = e.target.closest('.cell');
    if (b && !b.disabled) setFocusKind(b.getAttribute('data-kind'));
  });
  $('next').addEventListener('click', () => step(1));
  $('prev').addEventListener('click', () => step(-1));

  // ---------------------------------------------------------------- preamble and notes

  function renderPreamble() {
    const res = state.result;
    const pk = res.packages;
    if (state.shape === 'document' || !pk.length) { preambleEl.hidden = true; return; }
    preambleEl.hidden = false;
    preambleList.innerHTML = pk.map((p) => '<span class="t-cmd">\\usepackage</span>' + (p.options ? '[' + escHtml(p.options) + ']' : '') + '{' + escHtml(p.name) + '}').join('&ensp;');
    preambleList.title = pk.map((p) => p.name + ': ' + p.why).join('\n');
  }

  function renderNotes() {
    const w = state.result.warnings;
    notesNum.textContent = fmt(w.length);
    notesBtn.disabled = !w.length;
    notesBtn.classList.toggle('has-notes', !!w.length);
    notesSub.textContent = w.length ? 'Check before compiling' : 'Nothing to check';
    const list = $('notes-list');
    list.innerHTML = w.map((n) => '<li>' + (n.line ? '<button type="button" class="note-line" data-line="' + n.line + '">Line ' + n.line + '</button>' : '<span class="note-line">—</span>') + '<span class="note-text">' + escHtml(n.message) + '</span></li>').join('');
  }

  $('notes-list').addEventListener('click', (e) => {
    const b = e.target.closest('[data-line]');
    if (b) goToLine(+b.getAttribute('data-line'));
  });

  function goToLine(n) {
    if (narrow.matches) setTab('in');
    const lines = ta.value.split('\n');
    let pos = 0;
    for (let i = 0; i < n - 1 && i < lines.length; i++) pos += lines[i].length + 1;
    ta.focus();
    ta.setSelectionRange(pos, pos + (lines[n - 1] || '').length);
    const el = inLines.children[n - 1];
    if (el) ta.scrollTop = Math.max(0, el.offsetTop - ta.clientHeight / 3);
    onCaret();
  }

  function renderStatus() {
    const res = state.result;
    $('st-time').innerHTML = res ? 'Converted in <span class="num">' + res.stats.ms + '</span> ms' : '';
    $('st-lines').innerHTML = res ? '<span class="num">' + fmt(res.stats.inLines) + '</span> → <span class="num">' + fmt(res.stats.outLines) + '</span> lines' : '';
  }

  function renderMode() {
    app.classList.toggle('is-live', state.live);
    $('st-mode-text').textContent = state.live ? 'Live' : 'Manual';
    liveEl.checked = state.live;
    $('st-hint').innerHTML = state.live
      ? 'Converting as you type · <kbd>Alt</kbd> <kbd>L</kbd> to stop'
      : '<kbd>' + MOD + '</kbd> <kbd>Enter</kbd> convert · <kbd>Alt</kbd> <kbd>C</kbd> copy';
  }

  // ---------------------------------------------------------------- actions

  function doConvert() {
    clearTimeout(liveTimer);
    convertNow({ reveal: true });
    const btn = $('convert');
    btn.classList.add('is-done');
    setTimeout(() => btn.classList.remove('is-done'), 380);
  }

  function doCopy() {
    if (ta.value !== state.converted) convertNow();
    const text = state.result ? state.result.latex : '';
    if (!text) { toast('Nothing to copy yet'); return; }
    copyText(text).then(() => {
      const n = state.result.stats.outLines;
      toast('Copied ' + fmt(n) + ' ' + plural(n, 'line') + ' of LaTeX' + (state.shape === 'document' ? ' (full document)' : ''));
      const btn = $('copy');
      btn.classList.add('is-done');
      setTimeout(() => btn.classList.remove('is-done'), 600);
    }, () => toast('Copy was blocked by the browser. Select the output and copy it by hand.'));
  }

  function doDownload() {
    if (ta.value !== state.converted) convertNow();
    if (!state.result || !state.result.latex) { toast('Nothing to download yet'); return; }
    const base = (state.fileName || 'galley').replace(/\.(md|markdown|mdown|txt)$/i, '');
    download(base + '.tex', state.result.latex);
    toast('Saved ' + base + '.tex');
  }

  function setInput(text, name, undoLabel) {
    const prev = ta.value, prevName = state.fileName;
    ta.value = text;
    state.fileName = name || null;
    ta.scrollTop = 0;
    state.focusKind = null;
    state.focusIndex = -1;
    onInput();
    convertNow();
    resetCaret();
    outScroll.scrollTop = 0;
    if (undoLabel && prev.trim() && prev !== text) {
      toast(undoLabel, { label: 'Undo', run: () => { ta.value = prev; state.fileName = prevName; onInput(); convertNow(); resetCaret(); } });
    }
  }

  // A replaced document starts with the caret at its top, not where the old one left it.
  function resetCaret() {
    ta.setSelectionRange(0, 0);
    ta.scrollTop = 0;
    onCaret();
  }

  function loadExample(id) {
    const ex = EXAMPLES.find((e) => e.id === id);
    if (!ex) return;
    setInput(ex.md, null, 'Loaded “' + ex.name + '”');
  }

  function openFile(file) {
    if (!file) return;
    if (file.size > 20 * 1024 * 1024) { toast('That file is over 20 MB; Galley works best with smaller texts'); return; }
    const reader = new FileReader();
    reader.onload = () => setInput(String(reader.result), file.name, 'Opened ' + file.name);
    reader.onerror = () => toast('Could not read ' + file.name);
    reader.readAsText(file);
  }

  function setTab(tab) {
    state.tab = tab;
    app.setAttribute('data-tab', tab);
    for (const b of document.querySelectorAll('.tabs [role="tab"]')) b.setAttribute('aria-selected', String(b.getAttribute('data-tab') === tab));
    if (tab === 'in') requestAnimationFrame(syncMirror);
  }

  function setTheme(theme, chosen) {
    state.theme = theme;
    if (chosen) state.themeChosen = true;
    document.documentElement.setAttribute('data-theme', theme);
    themeBtn.querySelector('use').setAttribute('href', theme === 'night' ? '#i-sun' : '#i-moon');
    themeBtn.setAttribute('aria-label', theme === 'night' ? 'Switch to day theme' : 'Switch to night theme');
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', theme === 'night' ? '#111111' : '#0057FF');
    save();
  }

  // ---------------------------------------------------------------- rules sheet

  const RULES = [
    { group: 'Structure', items: [
      { key: 'topLevel', name: 'Top-level heading', type: 'select', options: [['section', '# is \\section'], ['chapter', '# is \\chapter'], ['part', '# is \\part']], desc: 'What a single <code>#</code> becomes. Chapters need the book or report class.' },
      { key: 'numbered', name: 'Numbered headings', type: 'switch', desc: 'Off gives starred headings, <code>\\section*{…}</code>. Add <code>{-}</code> to a heading to unnumber just that one.' },
      { key: 'sceneBreak', name: 'Thematic break', type: 'select', options: [['asterism', 'Asterism  * * *'], ['rule', 'Horizontal rule'], ['space', 'Blank space']], desc: 'What <code>---</code> between paragraphs becomes. Literary texts usually want a centred asterism.' },
      { key: 'tables', name: 'Tables', type: 'select', options: [['booktabs', 'booktabs rules'], ['grid', 'Ruled grid']], desc: 'booktabs gives clean horizontal rules and needs <code>\\usepackage{booktabs}</code>.' },
      { key: 'code', name: 'Code blocks', type: 'select', options: [['verbatim', 'verbatim'], ['listings', 'listings']], desc: 'listings adds the language when it knows it.' },
      { key: 'indentedCode', name: 'Indented code blocks', type: 'switch', desc: 'Off by default, so pasted text indented by four spaces stays text instead of turning into verbatim.' }
    ] },
    { group: 'Typography', items: [
      { key: 'italic', name: 'Italic', type: 'select', options: [['textit', '\\textit{…}'], ['emph', '\\emph{…}']], desc: '<code>\\emph</code> switches back to upright inside italic text.' },
      { key: 'quotes', name: 'Quotation marks', type: 'select', options: [['tex', '``TeX quotes\'\''], ['csquotes', '\\enquote{…}'], ['keep', 'Leave as typed']], desc: 'Straight and curly quotes become TeX quotes, or <code>\\enquote</code> from csquotes. Apostrophes stay apostrophes.' },
      { key: 'ellipsis', name: 'Ellipses', type: 'select', options: [['ldots', '\\ldots{}'], ['dots', '\\dots{}'], ['textellipsis', '\\textellipsis{}'], ['off', 'Leave as typed']], desc: 'Three dots, spaced dots and … all become one command, with <code>{}</code> so the space after survives.' },
      { key: 'dashes', name: 'Dashes', type: 'switch', desc: '— and – become <code>---</code> and <code>--</code>, a spaced hyphen between words becomes an en dash, and 1847-50 becomes 1847--50.' },
      { key: 'shorthand', name: 'Shorthand spacing', type: 'switch', desc: 'Ties after Mr., Dr., Wm., p., vol., ca. and between initials; a control space after e.g., i.e., cf. and vs.; <code>\\@</code> after capitals that end a sentence; e.&nbsp;g. becomes e.g.' }
    ] },
    { group: 'Cleanup', items: [
      { key: 'invisibles', name: 'Invisible characters', type: 'switch', desc: 'Removes soft hyphens, zero-width spaces and byte-order marks; turns no-break and thin spaces into <code>~</code> and <code>\\,</code>; unpacks ﬁ and ﬂ.' },
      { key: 'dehyphenate', name: 'Rejoin hyphenated words', type: 'switch', desc: 'For text copied from PDFs: joins “tran-” and “scription” across a line end. Off by default, because real compounds break at line ends too.' },
      { key: 'lineBreaks', name: 'Line breaks', type: 'select', options: [['join', 'Join lines (Markdown)'], ['keep', 'Keep every line']], desc: 'Keep is for letters, addresses and documents whose lineation matters.' }
    ] },
    { group: 'Output', items: [
      { key: 'unicode', name: 'Unicode', type: 'select', options: [['symbols', 'Symbols to commands'], ['ascii', 'ASCII only'], ['keep', 'Keep everything']], desc: 'Symbols turns § ° £ ½ and friends into commands that work everywhere. ASCII also writes accents as <code>\\\'{e}</code> for older pdfLaTeX setups. Keep is for XeLaTeX and LuaLaTeX.' },
      { key: 'rawLatex', name: 'Pass LaTeX through', type: 'switch', desc: '<code>\\commands{…}</code>, <code>$math$</code> and <code>\\begin{…}</code> blocks go through untouched. Turn off if your text has stray backslashes or dollar signs.' },
      { key: 'docClass', name: 'Document class', type: 'select', options: [['auto', 'Automatic'], ['article', 'article'], ['report', 'report'], ['book', 'book']], desc: 'Used in Document mode. Automatic picks book when headings start at chapters or parts.' }
    ] }
  ];

  function renderRules() {
    const body = $('rules-body');
    let html = '';
    for (const g of RULES) {
      html += '<section class="rule-group"><h3>' + g.group + '</h3>';
      for (const r of g.items) {
        const id = 'rule-' + r.key;
        const changed = state.opts[r.key] !== G.DEFAULTS[r.key];
        html += '<div class="rule' + (changed ? ' is-changed' : '') + '" data-key="' + r.key + '">';
        html += '<label class="rule-name" for="' + id + '">' + r.name + '</label>';
        if (r.type === 'select') {
          html += '<select id="' + id + '" data-key="' + r.key + '">' + r.options.map((o) => '<option value="' + o[0] + '"' + (state.opts[r.key] === o[0] ? ' selected' : '') + '>' + escHtml(o[1]) + '</option>').join('') + '</select>';
        } else {
          html += '<span class="switch switch-sm"><input type="checkbox" role="switch" id="' + id + '" data-key="' + r.key + '"' + (state.opts[r.key] ? ' checked' : '') + '><span class="switch-track" aria-hidden="true"><span class="switch-thumb"></span></span></span>';
        }
        html += '<p class="rule-desc" id="' + id + '-desc">' + r.desc + '</p></div>';
      }
      html += '</section>';
    }
    body.innerHTML = html;
    for (const el of body.querySelectorAll('[data-key]')) {
      if (el.id) el.setAttribute('aria-describedby', el.id + '-desc');
    }
  }

  $('rules-body').addEventListener('change', (e) => {
    const el = e.target;
    const key = el.getAttribute('data-key');
    if (!key) return;
    state.opts[key] = el.type === 'checkbox' ? el.checked : el.value;
    el.closest('.rule').classList.toggle('is-changed', state.opts[key] !== G.DEFAULTS[key]);
    convertNow();
    save();
  });
  $('rules-reset').addEventListener('click', () => {
    state.opts = Object.assign({}, G.DEFAULTS);
    renderRules();
    convertNow();
    save();
    toast('Rules reset to the defaults');
  });
  $('rules-open').addEventListener('click', () => { renderRules(); openSheet('rules', $('rules-open')); });

  // Sheets are non-modal: the work stays visible and live beside them.
  // Rules docks over the Markdown so the LaTeX shows each change; Notes and
  // Keyboard dock over the LaTeX so line links land in a visible editor.
  let sheetOpener = null;
  function openSheet(id, opener) {
    for (const d of document.querySelectorAll('dialog.sheet[open]')) if (d.id !== id) d.close();
    const d = $(id);
    if (d.open) { d.close(); return; }
    sheetOpener = opener || document.activeElement;
    d.show();
    const first = d.querySelector('.sheet-body select, .sheet-body input, .notes-list button, .sheet-close');
    if (first) first.focus();
  }
  for (const d of document.querySelectorAll('dialog.sheet')) {
    d.addEventListener('close', () => {
      if (sheetOpener && document.activeElement && (d.contains(document.activeElement) || document.activeElement === document.body)) sheetOpener.focus();
    });
  }

  // ---------------------------------------------------------------- keyboard

  const KEYS = [
    ['Convert', [MOD, 'Enter']],
    ['Copy the LaTeX', ['Alt', 'C']],
    ['Live conversion on or off', ['Alt', 'L']],
    ['Construction view on or off', ['Alt', 'M']],
    ['Fragment or full document', ['Alt', 'D']],
    ['Next change of the selected kind', ['Alt', 'N']],
    ['Previous change', ['Alt', 'Shift', 'N']],
    ['Download .tex', [MOD, 'S']],
    ['Open a Markdown file', [MOD, 'O']],
    ['Indent or outdent lines', ['Tab'], ['Shift', 'Tab']],
    ['Leave the editor', ['Esc'], ['Tab']],
    ['This list', ['?']]
  ];
  $('keys-body').innerHTML = KEYS.map((k) => '<tr><td>' + k[0] + '</td><td>' + k.slice(1).map((combo) => combo.map((x) => '<kbd>' + escHtml(x) + '</kbd>').join('')).join(' then ') + '</td></tr>').join('');
  $('keys-open').addEventListener('click', () => openSheet('keys', $('keys-open')));
  $('convert-kbd').textContent = MOD + ' ↵';
  $('convert').setAttribute('title', 'Convert (' + MOD + '+Enter)');
  $('copy').setAttribute('title', 'Copy the LaTeX (Alt+C)');

  document.addEventListener('keydown', (e) => {
    const mod = isMac ? e.metaKey : e.ctrlKey;
    if (mod && e.key === 'Enter') { e.preventDefault(); doConvert(); return; }
    if (mod && !e.shiftKey && !e.altKey && (e.key === 's' || e.key === 'S')) { e.preventDefault(); doDownload(); return; }
    if (mod && !e.shiftKey && !e.altKey && (e.key === 'o' || e.key === 'O')) { e.preventDefault(); fileInput.click(); return; }
    if (e.altKey && !mod) {
      switch (e.code) {
        case 'KeyC': e.preventDefault(); doCopy(); return;
        case 'KeyL': e.preventDefault(); liveEl.checked = !liveEl.checked; liveEl.dispatchEvent(new Event('change')); return;
        case 'KeyM': e.preventDefault(); constructEl.checked = !constructEl.checked; constructEl.dispatchEvent(new Event('change')); return;
        case 'KeyD': {
          e.preventDefault();
          const next = state.shape === 'document' ? 'fragment' : 'document';
          document.querySelector('input[name="shape"][value="' + next + '"]').click();
          return;
        }
        case 'KeyN': e.preventDefault(); if (state.focusKind) step(e.shiftKey ? -1 : 1); else toast('Pick a kind of change in the Construction band first'); return;
        default: break;
      }
    }
    const typing = /^(TEXTAREA|INPUT|SELECT)$/.test(document.activeElement && document.activeElement.tagName);
    if (e.key === 'Escape') {
      const open = document.querySelector('dialog.sheet[open]');
      if (open && (open.contains(document.activeElement) || document.activeElement === document.body || document.activeElement !== ta)) { e.preventDefault(); open.close(); return; }
    }
    if (e.key === '?' && !typing && !document.querySelector('dialog[open]')) { e.preventDefault(); openSheet('keys', $('keys-open')); }
  });

  // Tab indents inside the editor; Esc first lets Tab leave it.
  let escArmed = false;
  ta.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { escArmed = true; return; }
    if (e.key !== 'Tab' || escArmed) { if (e.key !== 'Tab') escArmed = false; return; }
    e.preventDefault();
    const v = ta.value, s = ta.selectionStart, en = ta.selectionEnd;
    const lineStart = v.lastIndexOf('\n', s - 1) + 1;
    if (s === en && !e.shiftKey) {
      ta.setRangeText('  ', s, en, 'end');
    } else {
      const block = v.slice(lineStart, en);
      const lines = block.split('\n');
      const changed = lines.map((l) => e.shiftKey ? l.replace(/^ {1,2}/, '') : '  ' + l).join('\n');
      ta.setRangeText(changed, lineStart, en, 'select');
    }
    onInput();
  });
  ta.addEventListener('blur', () => { escArmed = false; });

  // ---------------------------------------------------------------- wiring

  ta.addEventListener('input', onInput);
  ta.addEventListener('scroll', syncMirror, { passive: true });
  ta.addEventListener('keyup', onCaret);
  ta.addEventListener('click', onCaret);
  ta.addEventListener('focus', onCaret);
  ta.addEventListener('blur', () => requestAnimationFrame(applyLinks));
  document.addEventListener('selectionchange', () => { if (document.activeElement === ta) onCaret(); });
  if (window.ResizeObserver) new ResizeObserver(syncMirror).observe(ta);
  else window.addEventListener('resize', syncMirror);

  $('convert').addEventListener('click', doConvert);
  $('copy').addEventListener('click', doCopy);
  $('stale-convert').addEventListener('click', doConvert);
  $('download').addEventListener('click', doDownload);
  $('open').addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', () => { openFile(fileInput.files[0]); fileInput.value = ''; });
  $('clear').addEventListener('click', () => {
    if (!ta.value) return;
    setInput('', null, 'Cleared the Markdown');
    ta.focus();
  });
  $('preamble-copy').addEventListener('click', () => {
    const text = G.preambleFor(state.result.packages);
    copyText(text).then(() => toast('Copied ' + state.result.packages.length + ' preamble ' + plural(state.result.packages.length, 'line')));
  });

  liveEl.addEventListener('change', () => {
    state.live = liveEl.checked;
    renderMode();
    if (state.live && ta.value !== state.converted) convertNow();
    setStale(ta.value !== state.converted);
    save();
    toast(state.live ? 'Live: converting as you type' : 'Manual: convert with ' + MOD + '+Enter');
  });

  constructEl.addEventListener('change', () => {
    state.construct = constructEl.checked;
    if (!state.construct) { state.focusKind = null; state.focusIndex = -1; clearCurrent(); renderBand(); }
    applyConstruction();
    save();
  });

  for (const r of document.querySelectorAll('input[name="shape"]')) {
    r.addEventListener('change', () => {
      if (!r.checked) return;
      state.shape = r.value;
      convertNow();
      save();
    });
  }

  examplesEl.innerHTML = '<option value="">Examples…</option>' + EXAMPLES.map((e) => '<option value="' + e.id + '">' + escHtml(e.name) + ' · ' + escHtml(e.note) + '</option>').join('');
  examplesEl.addEventListener('change', () => {
    const id = examplesEl.value;
    examplesEl.value = '';
    if (id) loadExample(id);
  });
  $('empty-ex').innerHTML = EXAMPLES.slice(0, 4).map((e) => '<button type="button" class="btn btn-outline" data-ex="' + e.id + '">' + escHtml(e.name) + '</button>').join('');
  $('empty-ex').addEventListener('click', (e) => {
    const b = e.target.closest('[data-ex]');
    if (b) loadExample(b.getAttribute('data-ex'));
  });

  themeBtn.addEventListener('click', () => setTheme(state.theme === 'night' ? 'day' : 'night', true));
  // Follow the system theme until the visitor picks one.
  const darkQuery = window.matchMedia('(prefers-color-scheme: dark)');
  if (darkQuery.addEventListener) darkQuery.addEventListener('change', (e) => { if (!state.themeChosen) setTheme(e.matches ? 'night' : 'day'); });

  for (const b of document.querySelectorAll('.tabs [role="tab"]')) {
    b.addEventListener('click', () => setTab(b.getAttribute('data-tab')));
  }

  notesBtn.addEventListener('click', () => openSheet('notes', notesBtn));

  // Drag and drop onto the Markdown pane.
  const paneIn = $('pane-in');
  let dragDepth = 0;
  paneIn.addEventListener('dragenter', (e) => { if (e.dataTransfer && [...e.dataTransfer.types].includes('Files')) { dragDepth++; dropEl.hidden = false; e.preventDefault(); } });
  paneIn.addEventListener('dragover', (e) => { if (!dropEl.hidden) e.preventDefault(); });
  paneIn.addEventListener('dragleave', () => { if (--dragDepth <= 0) { dragDepth = 0; dropEl.hidden = true; } });
  paneIn.addEventListener('drop', (e) => {
    if (dropEl.hidden) return;
    e.preventDefault();
    dragDepth = 0;
    dropEl.hidden = true;
    openFile(e.dataTransfer.files[0]);
  });

  narrow.addEventListener && narrow.addEventListener('change', () => { setTab(state.tab); syncMirror(); });

  // ---------------------------------------------------------------- start

  const saved = load();
  if (saved) {
    if (saved.opts) for (const k of Object.keys(G.DEFAULTS)) if (k in saved.opts && k !== 'document') state.opts[k] = saved.opts[k];
    state.live = !!saved.live;
    state.construct = saved.construct !== false;
    state.shape = saved.shape === 'document' ? 'document' : 'fragment';
    state.fileName = saved.fileName || null;
    state.themeChosen = !!saved.theme;
  }
  setTheme(state.theme);
  document.querySelector('input[name="shape"][value="' + state.shape + '"]').checked = true;
  renderMode();
  ta.value = saved && typeof saved.input === 'string' && saved.input ? saved.input : (EXAMPLES[0] ? EXAMPLES[0].md : '');
  updateInMeta();
  renderMirror();
  convertNow();
  resetCaret();
})();
