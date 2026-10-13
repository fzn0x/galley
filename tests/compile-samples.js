// Writes every example as a full .tex document (with a few rule variants) into
// build/samples/ so CI can compile them with pdflatex. Run: node tests/compile-samples.js
'use strict';

const fs = require('fs');
const path = require('path');
const G = require('../js/galley.js');

global.window = {};
require('../js/examples.js');

const VARIANTS = [
  { name: 'default', opts: {} },
  { name: 'csquotes-ascii', opts: { quotes: 'csquotes', unicode: 'ascii', italic: 'emph', dehyphenate: true } },
  { name: 'book-grid-listings', opts: { topLevel: 'chapter', tables: 'grid', code: 'listings', sceneBreak: 'rule', ellipsis: 'textellipsis' } }
];

const dir = path.join(__dirname, '..', 'build', 'samples');
fs.mkdirSync(dir, { recursive: true });
let count = 0;
for (const ex of window.EXAMPLES) {
  for (const v of VARIANTS) {
    const r = G.convert(ex.md, Object.assign({ document: true }, v.opts));
    fs.writeFileSync(path.join(dir, ex.id + '-' + v.name + '.tex'), r.latex);
    count++;
  }
}
console.log('wrote ' + count + ' documents to ' + path.relative(process.cwd(), dir));
