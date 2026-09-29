// Sonde lecture seule : évalue les déclarations :root de combat-console.css (+ base.css) à un viewport,
// avec surcharges de tranche, et calcule la largeur INTRINSÈQUE de la rangée (cases réelles).
import { readFileSync } from 'node:fs';
const W = '/home/user/game/.wt-1919-H2/src/ui/styles/';
const CC = readFileSync(W + 'combat-console.css', 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
const BASE = readFileSync(W + 'base.css', 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
const rootBlock = CC.slice(CC.indexOf(':root {'), CC.indexOf('}', CC.indexOf(':root {')));
const vars = {};
for (const m of rootBlock.matchAll(/(--[\w-]+):\s*([^;]+);/g)) vars[m[1]] = m[2].trim();
function mediaRoot(q) {
  const i = CC.indexOf(q); const j = CC.indexOf(':root {', i); const k = CC.indexOf('}', j);
  const o = {}; for (const m of CC.slice(j, k).matchAll(/(--[\w-]+):\s*([^;]+);/g)) o[m[1]] = m[2].trim(); return o;
}
function ev(expr, vw, vh, V, d = 0) {
  let e = expr;
  for (let i = 0; i < 10 && e.includes('var('); i++) e = e.replace(/var\((--[\w-]+)\)/g, (_, n) => {
    const v = V[n] ?? new RegExp(`${n}:\\s*([^;]+);`).exec(BASE)?.[1]; if (!v) throw new Error(n);
    return `(${ev(v, vw, vh, V, d + 1)})`; });
  e = e.replace(/\bclamp\(/g, 'CLAMP(').replace(/\bmin\(/g, 'Math.min(').replace(/\bmax\(/g, 'Math.max(').replace(/\bcalc\(/g, '(')
    .replace(/(-?[\d.]+)vw/g, (_, n) => String(n * vw / 100)).replace(/(-?[\d.]+)vh/g, (_, n) => String(n * vh / 100)).replace(/(-?[\d.]+)px/g, '$1');
  const CLAMP = (a, v, b) => Math.min(Math.max(v, a), b);
  return Function('CLAMP', 'Math', `return (${e});`)(CLAMP, Math);
}
const m700 = mediaRoot('@media (max-width: 700px)');
const m560 = mediaRoot('@media (max-width: 560px)');
const coarse = mediaRoot('@media (pointer: coarse)');
function mesure(vw, vh, touch) {
  const V = { ...vars, ...(vw <= 700 ? m700 : {}), ...(vw <= 560 ? m560 : {}), ...(touch ? coarse : {}) };
  const L = (n) => ev(`var(${n})`, vw, vh, V);
  const cell = L('--cc-cell'), gap = L('--cc-gap');
  const sets = touch ? 44 : cell * L('--cc-sets-part');
  const deck = L('--cc-deck-h');
  let rangee = null;
  if (vw > 700) rangee = 11 * cell + sets + L('--cc-arch-w') + L('--cc-rangee-fixe');
  else if (vw > 560) rangee = 11 * cell + sets + L('--cc-rangee-fixe');
  return { vw, vh, touch, cell: +cell.toFixed(1), deck: +deck.toFixed(1), part: +(100 * (deck + L('--cc-saillie')) / vh).toFixed(1), rangee: rangee && +rangee.toFixed(1), deborde: rangee && +(rangee - vw).toFixed(1) };
}
for (const [w, h] of [[1707, 780], [1366, 650], [1024, 768], [901, 780], [900, 780], [834, 1112], [820, 1180], [768, 1024], [701, 780], [700, 780], [640, 780], [600, 960], [360, 740], [360, 650], [560, 650]])
  for (const t of [false, true]) console.log(JSON.stringify(mesure(w, h, t)));
