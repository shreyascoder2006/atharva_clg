// Inline fonts (base64), icons (SVG) and the demo hash into demo.html.
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const React = require('react'), RDS = require('react-dom/server'), LU = require('react-icons/lu');
const dir = __dirname, F = (p) => path.join(dir, 'node_modules/@fontsource', p);
const LATIN = 'U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD';
const LATEXT = 'U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+1D00-1DBF,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20C0,U+2113,U+2C60-2C7F,U+A720-A7FF';
const face = (fam, file, w, st, range) => `@font-face{font-family:'${fam}';font-style:${st};font-weight:${w};font-display:block;src:url(data:font/woff2;base64,${fs.readFileSync(file).toString('base64')}) format('woff2');unicode-range:${range}}`;
let css = '';
for (const w of [400, 500, 600, 700]) for (const [sub, r] of [['latin', LATIN], ['latin-ext', LATEXT]]) css += face('Inter', F(`inter/files/inter-${sub}-${w}-normal.woff2`), w, 'normal', r) + '\n';
for (const w of [400, 500, 600]) for (const st of ['normal', 'italic']) for (const [sub, r] of [['latin', LATIN], ['latin-ext', LATEXT]]) css += face('Fraunces', F(`fraunces/files/fraunces-${sub}-${w}-${st}.woff2`), w, st, r) + '\n';
css += face('JetBrains Mono', F('jetbrains-mono/files/jetbrains-mono-latin-500-normal.woff2'), '400 700', 'normal', LATIN) + '\n';
const names = ['MessagesSquare', 'Factory', 'Ship', 'Stamp', 'Truck', 'Package', 'ScanLine', 'LockOpen', 'Lock', 'Network', 'Sparkles', 'Handshake', 'Leaf', 'FileText', 'CircleCheck', 'MapPin', 'Check', 'Camera', 'ArrowRight', 'BadgeCheck', 'Clock', 'Siren', 'Radar', 'Globe', 'Boxes', 'Wallet', 'Tag', 'IdCard', 'Landmark', 'Receipt', 'Anchor', 'FileCheck', 'Fingerprint', 'Smartphone'];
const icons = {};
for (const n of names) { const C = LU['Lu' + n]; if (!C) throw new Error('icon ' + n); icons[n] = RDS.renderToStaticMarkup(React.createElement(C, { size: 24 })); }
const h = crypto.createHash('sha256').update('SHP-2611-0482|KMOL-047W-0482|gross 12,850 kg|HS 8708.40').digest('hex');
const short = h.slice(0, 12) + '…' + h.slice(-6);
let html = fs.readFileSync(path.join(dir, 'template.html'), 'utf8');
html = html.replace('/*FONTS*/', css).replace('/*ICONS*/', JSON.stringify(icons)).replace("'/*HASH*/'", JSON.stringify(short));
fs.writeFileSync(path.join(dir, 'demo.html'), html);
console.log('demo.html', (html.length / 1024).toFixed(0) + ' KB', 'hash', h);
