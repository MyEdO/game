/**
 * Le terrain du combat et de l'expédition : la carte du noyau en cases isométriques, et autour d'elle, hors des cases
 * jouables, le décor de la destination (lisière, tertres, pierres levées des hardes, autel).
 */

export const A = 46;
export const B = 23;

const alea = (graine: number) => () => {
  graine = (graine + 0x6d2b79f5) | 0;
  let t = Math.imul(graine ^ (graine >>> 15), 1 | graine);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
/** Mélange de deux teintes `#rrggbb`, `t` de 0 (a) à 1 (b). */
const melange = (a: string, b: string, t: number) => {
  const c = (h: string, k: number) => parseInt(h.slice(1 + 2 * k, 3 + 2 * k), 16);
  return `#${[0, 1, 2].map((k) => Math.round(c(a, k) + (c(b, k) - c(a, k)) * t).toString(16).padStart(2, '0')).join('')}`;
};
const losange = (x: number, y: number, a = A, b = B) => `M${x},${y - b}L${x + a},${y}L${x},${y + b}L${x - a},${y}Z`;
const p = (d: string, fill: string, extra = '') => `<path d="${d}" fill="${fill}"${extra ? ` ${extra}` : ''}/>`;

type Sol = 'herbe' | 'dalles' | 'terre' | 'ardoise';
type Pierre = readonly string[];
interface Palette { sol: Sol; dalle: [string, string]; mousse: [string, string]; joint: string; pierre: [string, string, string]; nuit: [string, string]; arbres: [string, string]; feu: boolean }
const PALETTES: Record<string, Palette> = {
  reikwald: { sol: 'herbe', dalle: ['#3f5230', '#4c6238'], mousse: ['#587040', '#667e46'], joint: '#26331c', pierre: ['#868a78', '#5c6052', '#34382e'], nuit: ['#0a1014', '#142018'], arbres: ['#0b130e', '#182619'], feu: false },
  tertres: { sol: 'dalles', dalle: ['#474552', '#5f5c69'], mousse: ['#4a5347', '#58604f'], joint: '#1b1921', pierre: ['#8e8a98', '#5e5b68', '#34323d'], nuit: ['#0a0c18', '#17152a'], arbres: ['#0c0e18', '#1a1d2b'], feu: true },
  hardes: { sol: 'terre', dalle: ['#4f4330', '#62543a'], mousse: ['#4d5634', '#5a6440'], joint: '#2a2114', pierre: ['#8a8470', '#5e5946', '#36322a'], nuit: ['#0e0c0a', '#1c1712'], arbres: ['#100e0a', '#201a12'], feu: true },
  autel: { sol: 'ardoise', dalle: ['#3d3238', '#4e3f44'], mousse: ['#4a2c2c', '#5a3434'], joint: '#170e12', pierre: ['#75666a', '#4c3d42', '#291f24'], nuit: ['#14080a', '#220e12'], arbres: ['#12080a', '#201014'], feu: true },
};
const TR = 'stroke="#15131a" stroke-width=".9" stroke-linejoin="round"';

/** Une boîte isométrique : dessus, face sud-ouest éclairée, face sud-est à l'ombre. */
function boite(cx: number, cy: number, a: number, b: number, h: number, [dessus, so, se]: Pierre, assises = 0): string {
  let s = p(`M${cx - a},${cy - h}L${cx},${cy + b - h}L${cx},${cy + b}L${cx - a},${cy}Z`, so, TR)
    + p(`M${cx},${cy + b - h}L${cx + a},${cy - h}L${cx + a},${cy}L${cx},${cy + b}Z`, se, TR)
    + p(`M${cx},${cy - b - h}L${cx + a},${cy - h}L${cx},${cy + b - h}L${cx - a},${cy - h}Z`, dessus, TR);
  for (let k = 1; k <= assises; k++) { const t = (h * k) / (assises + 1); s += `<path d="M${cx - a},${cy - h + t}L${cx},${cy + b - h + t}L${cx + a},${cy - h + t}" fill="none" stroke="#15131a" stroke-width=".8" opacity=".55"/>`; }
  return s;
}

const ombre = (x: number, y: number, rx: number, ry: number, o = 0.45) => `<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" fill="#000" opacity="${o}" filter="url(#c-f2)"/>`;

function brasero(x: number, y: number): string {
  return ombre(x, y + 3, 20, 9, 0.5)
    + `<path d="M${x - 13},${y + 2}L${x - 5},${y - 30}M${x + 13},${y + 2}L${x + 5},${y - 30}M${x},${y + 7}L${x},${y - 30}" stroke="#141214" stroke-width="3.2" stroke-linecap="round"/>`
    + p(`M${x - 19},${y - 40}Q${x},${y - 12} ${x + 19},${y - 40}Z`, '#1b181a', 'stroke="#0a0909"')
    + `<ellipse cx="${x}" cy="${y - 40}" rx="19" ry="6.5" fill="#3a1c0c" stroke="#0a0909"/>`
    + `<circle cx="${x}" cy="${y - 52}" r="62" fill="url(#c-coeur)" style="mix-blend-mode:screen"/>`
    + `<g class="flamme">${p(`M${x - 11},${y - 41}C${x - 15},${y - 56} ${x - 5},${y - 60} ${x - 6},${y - 74}C${x + 2},${y - 66} ${x + 1},${y - 58} ${x + 5},${y - 66}C${x + 13},${y - 56} ${x + 13},${y - 48} ${x + 10},${y - 41}Z`, '#f08a2c')}${p(`M${x - 6},${y - 41}C${x - 8},${y - 52} ${x - 1},${y - 54} ${x - 1},${y - 63}C${x + 6},${y - 55} ${x + 7},${y - 48} ${x + 5},${y - 41}Z`, '#ffd778')}</g>`;
}
function colonne(x: number, y: number): string {
  return ombre(x + 6, y + 5, 26, 11)
    + p(`M${x - 22},${y - 4}L${x - 22},${y + 2}A22,10 0 0 0 ${x + 22},${y + 2}L${x + 22},${y - 4}Z`, '#4a4753', TR)
    + p(`M${x - 16},${y - 66}L${x - 16},${y - 4}A16,7 0 0 0 ${x + 16},${y - 4}L${x + 16},${y - 52}L${x + 8},${y - 60}L${x + 2},${y - 50}L${x - 6},${y - 64}Z`, '#6a6773', TR)
    + `<path d="M${x + 3},${y - 50}L${x + 3},${y + 3}M${x + 10},${y - 56}L${x + 10},${y + 1}" stroke="#33313c" stroke-width="5" opacity=".55"/>`;
}
const BOIS = ['#8a6a44', '#6a4c2e', '#3f2c1a'] as const;
function caisses(x: number, y: number): string {
  return ombre(x + 6, y + 8, 40, 16, 0.4) + boite(x - 10, y - 2, 27, 13.5, 32, BOIS, 2) + boite(x + 20, y + 9, 22, 11, 24, BOIS, 1) + boite(x - 8, y - 34, 19, 9.5, 20, BOIS, 1);
}
function tonneau(x: number, y: number): string {
  return ombre(x + 14, y + 8, 22, 9, 0.4)
    + p(`M${x - 4},${y - 36}Q${x - 8},${y - 16} ${x - 4},${y + 3}A15,6.5 0 0 0 ${x + 26},${y + 3}Q${x + 30},${y - 16} ${x + 26},${y - 36}Z`, 'url(#c-bois)', 'stroke="#15100a" stroke-width=".9"')
    + `<ellipse cx="${x + 11}" cy="${y - 36}" rx="15" ry="6.5" fill="#6a4c2e" stroke="#15100a" stroke-width=".9"/>`
    + `<path d="M${x - 6},${y - 24}A17,7 0 0 0 ${x + 28},${y - 24}M${x - 6},${y - 8}A17,7 0 0 0 ${x + 28},${y - 8}" fill="none" stroke="#1d1b1a" stroke-width="2.4"/>`;
}
function souche(x: number, y: number): string {
  return ombre(x + 4, y + 4, 22, 9, 0.4) + p(`M${x - 16},${y}L${x - 14},${y - 22}A14,6 0 0 1 ${x + 14},${y - 22}L${x + 16},${y}A16,7 0 0 1 ${x - 16},${y}Z`, '#5a3f26', 'stroke="#1d130b" stroke-width=".9"')
    + `<ellipse cx="${x}" cy="${y - 22}" rx="14" ry="6" fill="#a07a4a" stroke="#1d130b" stroke-width=".9"/><ellipse cx="${x}" cy="${y - 22}" rx="7" ry="3" fill="none" stroke="#6a4c2e"/>`;
}
/** Un sapin en quatre étages, le flanc gauche pris par la lune. */
function sapin(x: number, y: number, h: number, [sombre, clair]: Pierre): string {
  let s = ombre(x + 8, y + 3, h * 0.2, h * 0.07, 0.4) + p(`M${x - 4},${y}L${x - 2.5},${y - h * 0.3}H${x + 2.5}L${x + 4},${y}Z`, '#2a1c12', TR);
  for (let k = 0; k < 4; k++) {
    const bas = y - h * (0.16 + k * 0.2), haut = bas - h * 0.38, l = h * 0.19 * (1 - k * 0.19);
    s += p(`M${x},${haut}L${x + l},${bas}L${x + l * 0.4},${bas - h * 0.03}L${x},${bas + h * 0.03}L${x - l * 0.4},${bas - h * 0.03}L${x - l},${bas}Z`, sombre, TR)
      + p(`M${x},${haut}L${x - l},${bas}L${x - l * 0.4},${bas - h * 0.03}L${x - l * 0.1},${bas - h * 0.2}Z`, clair);
  }
  return s;
}
function rocher(x: number, y: number, e: number, [dessus, so, se]: Pierre): string {
  const q = (dx: number, dy: number) => `${x + dx * e},${y + dy * e}`;
  return ombre(x + 6, y + 4, 22 * e, 8 * e, 0.4) + p(`M${q(-18, 0)}L${q(-14, -16)}L${q(2, -12)}L${q(6, 6)}L${q(-8, 5)}Z`, so, TR)
    + p(`M${q(2, -12)}L${q(12, -18)}L${q(18, -2)}L${q(6, 6)}Z`, se, TR) + p(`M${q(-14, -16)}L${q(-2, -24)}L${q(12, -18)}L${q(2, -12)}Z`, dessus, TR);
}
const FEUILLAGE = ['#22361f', '#3f5a30'] as const;
const buisson = (x: number, y: number) => ombre(x + 4, y + 2, 24, 8, 0.4)
  + `<g ${TR}><circle cx="${x - 11}" cy="${y - 8}" r="11" fill="${FEUILLAGE[0]}"/><circle cx="${x + 9}" cy="${y - 10}" r="13" fill="${FEUILLAGE[0]}"/><circle cx="${x - 2}" cy="${y - 17}" r="11" fill="${FEUILLAGE[1]}"/></g>`;
function stele(x: number, y: number, h: number, penche: number, [dessus, , se]: Pierre): string {
  return ombre(x + 8, y + 3, 16, 6, 0.4) + `<g transform="rotate(${penche} ${x} ${y})">${p(`M${x + 9},${y - h + 8}l5,-3V${y - 3}L${x + 9},${y}Z`, se, TR)}`
    + p(`M${x - 9},${y}V${y - h + 8}Q${x - 9},${y - h} ${x},${y - h}Q${x + 9},${y - h} ${x + 9},${y - h + 8}V${y}Z`, dessus, TR)
    + `<path d="M${x},${y - h + 7}v13M${x - 4},${y - h + 12}h8M${x - 5},${y - 8}l4,-5" stroke="#2a2833" stroke-width="1.4" fill="none" opacity=".7"/></g>`;
}
/** Un tertre : la butte, son linteau, sa porte où luit le feu follet. */
function tumulus(x: number, y: number, [dessus, so, se]: Pierre): string {
  return p(`M${x - 84},${y + 8}C${x - 72},${y - 66} ${x + 72},${y - 66} ${x + 84},${y + 8}Z`, '#27302a', TR)
    + `<path d="M${x - 58},${y - 26}C${x - 30},${y - 52} ${x + 20},${y - 54} ${x + 44},${y - 38}" stroke="#46543f" stroke-width="5" fill="none" stroke-linecap="round" opacity=".7"/>`
    + p(`M${x - 13},${y + 9}V${y - 26}H${x + 13}V${y + 9}Z`, '#07060a') + `<ellipse cx="${x}" cy="${y - 4}" rx="11" ry="16" fill="#6adf7a" opacity=".14"/>`
    + p(`M${x - 21},${y + 9}V${y - 27}h8V${y + 9}Z`, so, TR) + p(`M${x + 13},${y + 9}V${y - 27}h8V${y + 9}Z`, se, TR) + p(`M${x - 25},${y - 26}l3,-10h44l3,10Z`, dessus, TR);
}
const arbreMort = (x: number, y: number) => ombre(x + 5, y + 2, 14, 5, 0.4)
  + `<g stroke="#17131c" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M${x},${y}C${x - 3},${y - 30} ${x + 5},${y - 52} ${x},${y - 82}" stroke-width="7"/><path d="M${x + 2},${y - 44}l18,-22l2,-16M${x + 13},${y - 57}l13,-5M${x - 1},${y - 56}l-16,-18l-3,-18M${x - 11},${y - 67}l-11,2M${x},${y - 80}l7,-20" stroke-width="3"/></g>`;
function menhir(x: number, y: number, h: number, [dessus, , se]: Pierre): string {
  return ombre(x + 8, y + 5, 22, 8, 0.45) + p(`M${x + 4},${y - h + 4}L${x + 14},${y - h * 0.7}L${x + 16},${y + 1}L${x + 2},${y + 8}Z`, se, TR)
    + p(`M${x - 14},${y + 3}L${x - 16},${y - h * 0.6}L${x - 8},${y - h}L${x + 4},${y - h + 4}L${x + 2},${y + 8}Z`, dessus, TR)
    + `<path d="M${x - 9},${y - h * 0.5}q4,-9 8,0q-4,9 -7,-1M${x - 10},${y - h * 0.28}h9" stroke="#a8321f" stroke-width="2" fill="none" stroke-linecap="round"/>`;
}
const crane = (x: number, y: number, r: number) => `<circle cx="${x}" cy="${y}" r="${r}" fill="#d8d2bf" ${TR}/><path d="M${x - r * 0.45},${y - r * 0.1}v.1M${x + r * 0.45},${y - r * 0.1}v.1" stroke="#15131a" stroke-width="${r * 0.5}" stroke-linecap="round"/>`;
/** Le mât des hardes : un crâne cornu, des haillons à la traverse. */
const totem = (x: number, y: number) => ombre(x + 5, y + 2, 14, 5, 0.4)
  + `<path d="M${x},${y}V${y - 88}M${x - 19},${y - 64}H${x + 19}" stroke="#3a2a1a" stroke-width="5" stroke-linecap="round"/>`
  + p(`M${x - 17},${y - 63}l2,24l4,-8l3,11l3,-27ZM${x + 6},${y - 63}l2,20l4,-7l4,9l1,-22Z`, '#6a1c12', TR)
  + p(`M${x - 6},${y - 96}C${x - 16},${y - 99} ${x - 19},${y - 108} ${x - 15},${y - 114}C${x - 13},${y - 107} ${x - 9},${y - 103} ${x - 3},${y - 100}ZM${x + 6},${y - 96}C${x + 16},${y - 99} ${x + 19},${y - 108} ${x + 15},${y - 114}C${x + 13},${y - 107} ${x + 9},${y - 103} ${x + 3},${y - 100}Z`, '#d8cdb4', TR)
  + crane(x, y - 93, 7.5);
/** Une palissade de pieux le long d'un bord (`sens` : +1 vers la droite, -1 vers la gauche). */
function pieux(x: number, y: number, sens: number): string {
  let s = '';
  for (let k = 0; k < 4; k++) { const px = x + sens * (k - 1.5) * 23, py = y + (k - 1.5) * 11.5, h = 46 + ((k * 7) % 3) * 6; s += p(`M${px - 5},${py + 2}L${px - 4},${py - h}L${px},${py - h - 12}L${px + 4},${py - h}L${px + 5},${py + 2}Z`, k % 2 ? '#5a3f26' : '#6a4c2e', TR); }
  return ombre(x + 6, y + 6, 44, 12, 0.35) + s + `<path d="M${x - sens * 36},${y - 42}L${x + sens * 36},${y - 6}" stroke="#2a1d12" stroke-width="3" opacity=".8"/>`;
}
/** L'autel : deux degrés de pierre noire, l'étoile à huit branches, les crânes au pied. */
function autelDuChaos(x: number, y: number, pierre: Pierre): string {
  let etoile = '';
  for (let k = 0; k < 4; k++) { const a = (k * Math.PI) / 4, dx = Math.cos(a) * 20, dy = Math.sin(a) * 10; etoile += `M${x - dx},${y - 42 - dy}L${x + dx},${y - 42 + dy}`; }
  return ombre(x + 8, y + 8, 60, 22, 0.5) + boite(x, y, A * 0.95, B * 0.95, 16, pierre, 0) + boite(x, y - 16, A * 0.62, B * 0.62, 26, pierre, 1)
    + `<circle cx="${x}" cy="${y - 50}" r="70" fill="url(#c-sang)" style="mix-blend-mode:screen"/><path d="${etoile}" stroke="#ff5a3a" stroke-width="2.2" stroke-linecap="round"/><ellipse cx="${x}" cy="${y - 42}" rx="12" ry="6" fill="none" stroke="#ff5a3a" stroke-width="1.6"/>`
    + crane(x - 34, y + 12, 6) + crane(x - 24, y + 17, 5) + crane(x + 36, y + 8, 6);
}
function banniere(x: number, y: number): string {
  const t = y - 96;
  return `<path d="M${x - 39},${y}V${t}" stroke="#1a1216" stroke-width="4"/>` + p(`M${x - 39},${t + 6}L${x - 5},${t + 22}L${x - 5},${t + 70}L${x - 13},${t + 60}L${x - 21},${t + 68}L${x - 29},${t + 54}L${x - 39},${t + 58}Z`, '#7c1f14', 'stroke="#2a0b06" stroke-width=".9"')
    + `<path d="M${x - 30},${t + 26}l16,22M${x - 30},${t + 44}l16,-12M${x - 22},${t + 20}v32" stroke="#e2c06a" stroke-width="1.6" opacity=".8"/>`;
}

/** `cadrage` : la fenêtre à montrer, la carte et le fond de la cour, sans les angles vides du losange. */
export interface Cour { svg: string; largeur: number; hauteur: number; cadrage: { x: number; y: number; largeur: number; hauteur: number }; centre: (x: number, y: number, n: number) => [number, number] }

/** La cour d'une carte de `w` × `h` cases au terrain `terrain` (id de destination). */
export function dessinerLaCour(w: number, h: number, terrain: string): Cour {
  const pal = PALETTES[terrain] ?? PALETTES.tertres;
  const marge = 3;
  const OX = (h + marge) * A + 40;
  const OY = marge * B + 170;
  const P = (i: number, j: number): [number, number] => [OX + (i - j) * A, OY + (i + j) * B];
  const largeur = (w + h + 2 * marge) * A + 80;
  const hauteur = (w + h + 2 * marge) * B + 260;
  const r = alea(terrain.length * 31 + w * 7 + h);
  let s = `<defs>
    <linearGradient id="c-nuit" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${pal.nuit[0]}"/><stop offset="1" stop-color="${pal.nuit[1]}"/></linearGradient>
    <radialGradient id="c-feu"><stop offset="0" stop-color="#ffdf9a" stop-opacity=".8"/><stop offset=".16" stop-color="#ffb65a" stop-opacity=".5"/><stop offset=".45" stop-color="#e07a2c" stop-opacity=".18"/><stop offset="1" stop-color="#e07a2c" stop-opacity="0"/></radialGradient>
    <radialGradient id="c-lune"><stop offset="0" stop-color="#cfe0c8" stop-opacity=".3"/><stop offset=".5" stop-color="#9ab8a8" stop-opacity=".1"/><stop offset="1" stop-color="#9ab8a8" stop-opacity="0"/></radialGradient>
    <radialGradient id="c-sang"><stop offset="0" stop-color="#ff7a4a" stop-opacity=".7"/><stop offset=".4" stop-color="#c8281a" stop-opacity=".3"/><stop offset="1" stop-color="#c8281a" stop-opacity="0"/></radialGradient>
    <radialGradient id="c-coeur"><stop offset="0" stop-color="#fff3c8" stop-opacity=".95"/><stop offset=".3" stop-color="#ffc76e" stop-opacity=".6"/><stop offset="1" stop-color="#ff9a3a" stop-opacity="0"/></radialGradient>
    <radialGradient id="c-froid"><stop offset="0" stop-color="#2a3a6a" stop-opacity="0"/><stop offset="1" stop-color="#2a3a6a" stop-opacity=".55"/></radialGradient>
    <linearGradient id="c-bois" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#8a6a44"/><stop offset=".55" stop-color="#3f2c1a"/><stop offset="1" stop-color="#291c11"/></linearGradient>
    <filter id="c-f2" x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur stdDeviation="2"/></filter>
  </defs><rect width="${largeur}" height="${hauteur}" fill="url(#c-nuit)"/>`;
  // la lisière : des silhouettes de sapins, de buttes ou de pics derrière le bord du fond
  const fond: [number, number, number, number][] = [];
  for (let n = 0; n < 150; n++) {
    const [x, y] = r() < 0.5 ? P(-marge + 0.2 + r() * (w + 2 * marge - 1), -marge - 0.9) : P(-marge - 0.9, -marge + 0.2 + r() * (h + 2 * marge - 1));
    fond.push([x + (r() - 0.5) * 30, y - r() * 70, 60 + r() * 90, r()]);
  }
  fond.sort((a, b) => a[1] - b[1]);
  for (const [x, y, ht, t] of fond) {
    const l = ht * (pal.sol === 'dalles' ? 1.1 : 0.2), teinte = melange(pal.arbres[0], pal.arbres[1], t * 0.8);
    s += pal.sol === 'dalles' ? p(`M${x - l},${y}Q${x},${y - ht * 0.9} ${x + l},${y}Z`, teinte)
      : pal.sol === 'ardoise' ? p(`M${x - l},${y}L${x - l * 0.3},${y - ht * 0.6}L${x},${y - ht}L${x + l * 0.5},${y - ht * 0.4}L${x + l},${y}Z`, teinte)
        : p(`M${x},${y - ht}L${x + l},${y - ht * 0.5}L${x + l * 0.5},${y - ht * 0.52}L${x + l * 1.5},${y}H${x - l * 1.5}L${x - l * 0.5},${y - ht * 0.52}L${x - l},${y - ht * 0.5}Z`, teinte);
  }
  // le sol : les cases de la carte et l'anneau qui la borde, à la matière du lieu
  const herbe = pal.sol === 'herbe', terre = pal.sol === 'terre', sentier = Math.floor(h / 2);
  let sol = `<g stroke="${pal.joint}" stroke-width="${herbe || terre ? 0.9 : 1.3}" stroke-linejoin="round">`, brins = '';
  for (let i = -marge; i < w + marge; i++) for (let j = -marge; j < h + marge; j++) {
    const [x, y] = P(i, j);
    const dedans = i >= 0 && j >= 0 && i < w && j < h;
    const t = r(); const mousse = r() < (dedans ? 0.16 : 0.35);
    const foule = herbe && j === sentier;
    const teinte = foule ? melange('#5a4c34', '#6a593c', t) : mousse ? melange(pal.mousse[0], pal.mousse[1], t) : melange(pal.dalle[0], pal.dalle[1], t);
    sol += `<path d="${losange(x, y)}" fill="${dedans ? teinte : melange(teinte, '#000000', 0.34)}"/>`;
    const k = r(), dx = (r() - 0.5) * 40, dy = (r() - 0.5) * 16;
    if (herbe || terre) {
      if (k < 0.3) sol += `<path d="M${x - 16},${y + 2}l10,4M${x + 4},${y - 6}l9,4" fill="none" opacity=".45"/>`;
      else if (k < 0.4) sol += `<ellipse cx="${x + dx}" cy="${y + dy}" rx="4" ry="2" fill="${pal.pierre[1]}" stroke-width=".7"/>`;
      if (r() < (herbe && !foule ? 0.55 : 0.12)) brins += `M${x + dx},${y + dy}q1.5,-9 3,0q2,-7 3.5,0q1,-5 3,0`;
      if (terre && k > 0.93) sol += `<path d="M${x - 9},${y}h14M${x - 10},${y - 2}v4M${x + 6},${y - 2}v4" stroke="#d8d2bf" stroke-width="2.2" stroke-linecap="round" fill="none"/>`;
      if (herbe && k > 0.9) sol += `<circle cx="${x + dx}" cy="${y - dy}" r="1.5" fill="#e9dcc0" stroke="none"/><circle cx="${x + dx + 5}" cy="${y - dy + 3}" r="1.2" fill="#d79a4c" stroke="none"/>`;
    } else {
      if (k < 0.22) sol += `<path d="M${x - A / 2},${y - B / 2}L${x + A / 2},${y + B / 2}" opacity=".8"/>`;
      else if (k < 0.4) sol += `<path d="M${x + A / 2},${y - B / 2}L${x - A / 2},${y + B / 2}" opacity=".8"/>`;
      else if (k < 0.5) sol += `<path d="M${x - 14},${y - 4}l9,5l-3,6l8,4" fill="none" opacity=".7" stroke-width="1"/>`;
      else if (k > 0.94 && pal.sol === 'ardoise') sol += `<path d="M${x - 6},${y - 3}l6,3l6,-3M${x},${y}v5" fill="none" stroke="#c8452c" stroke-width="1.4" opacity=".75"/>`;
      if (r() < 0.1) brins += `M${x + dx},${y + dy}q2,-8 4,0q2,-6 4,0`;
    }
  }
  s += `${sol}</g><path d="${brins}" fill="none" stroke="${melange(pal.mousse[1], '#c8d48a', 0.3)}" stroke-width="1.2" stroke-linecap="round" opacity=".85"/>`;
  // le cercle de l'autel, peint au sol
  if (pal.sol === 'ardoise') {
    const [x, y] = P((w - 1) / 2, (h - 1) / 2), ry = Math.min(w, h) * B * 0.62, rx = ry * 2;
    let d = '';
    for (let k = 0; k < 8; k++) { const a = (k * Math.PI) / 4, b = ((k + 3) * Math.PI) / 4; d += `M${x + Math.cos(a) * rx},${y + Math.sin(a) * ry}L${x + Math.cos(b) * rx},${y + Math.sin(b) * ry}`; }
    s += `<g fill="none" stroke="#c8452c" opacity=".3"><ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" stroke-width="3"/><path d="${d}" stroke-width="2"/></g>`;
  }
  // le liseré de la carte : où s'arrêtent les cases jouables
  const [c0, c1, c2, c3] = [P(-0.5, -0.5), P(w - 0.5, -0.5), P(w - 0.5, h - 0.5), P(-0.5, h - 0.5)];
  s += `<path d="M${c0}L${c1}L${c2}L${c3}Z" fill="none" stroke="#efe2bd" stroke-opacity=".22" stroke-width="2"/>`;
  // la lumière : le brasero, ou la lune sur la clairière
  const milieu = P(w / 2, h / 2), feu = pal.feu ? P(-1, Math.floor(h / 2)) : milieu;
  s += `<ellipse cx="${feu[0]}" cy="${feu[1] + 40}" rx="${pal.feu ? 560 : 700}" ry="${pal.feu ? 300 : 360}" fill="url(#${pal.feu ? 'c-feu' : 'c-lune'})" style="mix-blend-mode:screen"/>`;
  s += `<ellipse cx="${milieu[0]}" cy="${milieu[1] + 80}" rx="${largeur}" ry="${hauteur * 0.7}" fill="url(#c-froid)" style="mix-blend-mode:soft-light"/>`;
  // le bord du fond et les accessoires de l'anneau, du fond vers l'avant
  const objets: [number, string][] = [];
  const poser = (i: number, j: number, f: (x: number, y: number) => string) => { const [x, y] = P(i, j); objets.push([i + j, f(x, y)]); };
  const pierre = (t: number) => pal.pierre.map((c) => melange(c, '#2a2833', t * 0.35));
  const mur = (ht: number, pointes: boolean, t: number) => (x: number, y: number) => boite(x, y, A, B, ht, pierre(t), ht > 30 ? 3 : 1)
    + (pointes ? `<path d="M${x - 30},${y - ht - 4}l3,-15l3,17M${x - 4},${y - ht + 9}l3,-16l3,17M${x + 22},${y - ht - 2}l3,-15l3,14" fill="#1a1216" stroke="#0a0608" stroke-width=".8"/>` : '');
  const bord = (i: number, j: number, sens: number) => {
    const k = r(), t = r(), dx = (r() - 0.5) * 24;
    if (herbe) {
      poser(i - 0.45, j - 0.45, (x, y) => sapin(x + dx, y, 120 + t * 70, [melange(pal.arbres[1], '#000000', 0.25), '#22362a']));
      poser(i, j, (x, y) => (k < 0.62 ? sapin(x - dx, y, 100 + t * 60, ['#1a2a1e', '#35503a']) : k < 0.8 ? rocher(x, y, 0.9 + t * 0.6, pierre(t)) : buisson(x, y)));
    } else if (pal.sol === 'dalles') poser(i, j, k < 0.42 ? mur(k < 0.1 ? 68 : 22 + t * 22, false, t) : k < 0.72 ? (x, y) => stele(x + dx, y, 38 + t * 18, (t - 0.5) * 24, pierre(t)) : k < 0.86 ? arbreMort : (x, y) => rocher(x, y, 1, pierre(t)));
    else if (terre) poser(i, j, k < 0.36 ? (x, y) => menhir(x, y, 70 + t * 50, pierre(t)) : k < 0.74 ? (x, y) => pieux(x, y, sens) : k < 0.88 ? totem : (x, y) => rocher(x, y, 1.2, pierre(t)));
    else poser(i, j, k < 0.7 ? mur(k < 0.14 ? 84 : 30 + t * 26, true, t) : k < 0.86 ? (x, y) => menhir(x, y, 96, pierre(t)) : (x, y) => rocher(x, y, 1.3, pierre(t)));
  };
  for (let i = -marge; i < w + marge; i++) bord(i, -marge, 1);
  for (let j = -marge + 1; j < h + marge; j++) bord(-marge, j, -1);
  const au = Math.floor(w / 2);
  if (pal.feu) { poser(-1, Math.floor(h / 2), brasero); poser(w, Math.floor(h / 3), brasero); }
  if (herbe) { poser(-2, 1, souche); poser(w + 1, h - 2, souche); poser(3, -2, souche); poser(-1, h, tonneau); poser(w + 0.6, 0, (x, y) => rocher(x, y, 1.1, pal.pierre)); poser(1, h + 1, buisson); }
  else if (pal.sol === 'dalles') {
    poser(Math.floor(w * 0.3), -marge + 0.6, (x, y) => tumulus(x, y, pal.pierre)); poser(-marge + 0.6, Math.floor(h * 0.6) - 1.2, (x, y) => tumulus(x, y, pal.pierre));
    poser(-2, h - 2, colonne); poser(w + 1, 1, (x, y) => stele(x, y, 44, -9, pal.pierre)); poser(w + 1, 2.2, (x, y) => stele(x, y, 36, 12, pal.pierre)); poser(Math.floor(w * 0.6), -2, colonne);
  } else if (terre) {
    poser(au, -2, (x, y) => menhir(x, y, 140, pal.pierre) + crane(x - 26, y + 8, 6) + crane(x + 24, y + 12, 5)); poser(au - 1.2, -1.8, totem); poser(au + 1.2, -1.8, totem);
    poser(-2, h - 2, totem); poser(w + 1, 1, caisses); poser(w + 1, 2, tonneau);
  } else {
    poser(au, -2, (x, y) => autelDuChaos(x, y, pal.pierre)); poser(au, -marge + 0.01, banniere);
    poser(-2, h - 2, colonne); poser(w + 1, 1, (x, y) => menhir(x, y, 80, pal.pierre)); poser(w + 1, 2.4, (x, y) => crane(x, y, 6) + crane(x + 12, y + 5, 5) + crane(x - 9, y + 7, 5));
  }
  objets.sort((a, b) => a[0] - b[0]);
  for (const [, dessin] of objets) s += dessin;
  const gauche = P(-0.5, h + 0.5)[0] - A, droite = P(w + 0.5, -0.5)[0] + A;
  const haut = P(-marge, -marge)[1] - 110, bas = P(w, h)[1] + 20;
  const cadrage = { x: gauche, y: haut, largeur: droite - gauche, hauteur: bas - haut };
  return { svg: `<svg class="cour-sol" viewBox="0 0 ${largeur} ${hauteur}" width="${largeur}" height="${hauteur}" aria-hidden="true">${s}</svg>`, largeur, hauteur, cadrage, centre: (x, y, n) => P(x + (n - 1) / 2, y + (n - 1) / 2) };
}
