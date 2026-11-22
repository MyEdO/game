/**
 * La cour du combat, portée de la maquette de combat du kit (`combat/cour.js` et `combat/socle.js` de la branche
 * `chantier/4585-catalogue`) : la carte du noyau en dalles isométriques, et autour d'elle, hors des cases jouables, les
 * murets, la lisière, le brasero et les accessoires. Chaque destination a son sol et sa pierre.
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

interface Palette { dalle: [string, string]; mousse: [string, string]; joint: string; pierre: [string, string, string]; nuit: [string, string]; arbres: [string, string]; brasero: boolean; banniere: boolean; menhirs?: boolean }
const PALETTES: Record<string, Palette> = {
  reikwald: { dalle: ['#3e4a2e', '#4d5a36'], mousse: ['#566a3a', '#62743f'], joint: '#1e2416', pierre: ['#7a8070', '#555a4c', '#2f332a'], nuit: ['#0a0e10', '#121a16'], arbres: ['#0b100c', '#16201a'], brasero: false, banniere: false },
  tertres: { dalle: ['#45434f', '#5d5a66'], mousse: ['#4a4f47', '#565b4f'], joint: '#1b1921', pierre: ['#8a8694', '#5c5966', '#33313c'], nuit: ['#0a0c16', '#15131a'], arbres: ['#0c0e18', '#1a1d2b'], brasero: true, banniere: false },
  hardes: { dalle: ['#4a4230', '#5c523a'], mousse: ['#4d5634', '#5a6440'], joint: '#221c12', pierre: ['#8a8470', '#5e5946', '#36322a'], nuit: ['#0e0c0a', '#1a1612'], arbres: ['#100e0a', '#1e1a14'], brasero: true, banniere: false, menhirs: true },
  autel: { dalle: ['#4a3a3a', '#5e4844'], mousse: ['#4a3430', '#58403a'], joint: '#1e1212', pierre: ['#8a7a78', '#5e4c4a', '#33282a'], nuit: ['#140a0a', '#1e1012'], arbres: ['#120a0a', '#1e1214'], brasero: true, banniere: true },
};

/** Une boîte isométrique : dessus, face sud-ouest éclairée, face sud-est à l'ombre (`boite` de `cour.js`). */
function boite(cx: number, cy: number, a: number, b: number, h: number, [dessus, so, se]: readonly string[], assises = 0): string {
  const tr = 'stroke="#15131a" stroke-width=".9" stroke-linejoin="round"';
  let s = p(`M${cx - a},${cy - h}L${cx},${cy + b - h}L${cx},${cy + b}L${cx - a},${cy}Z`, so, tr)
    + p(`M${cx},${cy + b - h}L${cx + a},${cy - h}L${cx + a},${cy}L${cx},${cy + b}Z`, se, tr)
    + p(`M${cx},${cy - b - h}L${cx + a},${cy - h}L${cx},${cy + b - h}L${cx - a},${cy - h}Z`, dessus, tr);
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
    + p(`M${x - 22},${y - 4}L${x - 22},${y + 2}A22,10 0 0 0 ${x + 22},${y + 2}L${x + 22},${y - 4}Z`, '#4a4753', 'stroke="#15131a" stroke-width=".9"')
    + p(`M${x - 16},${y - 66}L${x - 16},${y - 4}A16,7 0 0 0 ${x + 16},${y - 4}L${x + 16},${y - 52}L${x + 8},${y - 60}L${x + 2},${y - 50}L${x - 6},${y - 64}Z`, '#6a6773', 'stroke="#15131a" stroke-width=".9"')
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
    <radialGradient id="c-coeur"><stop offset="0" stop-color="#fff3c8" stop-opacity=".95"/><stop offset=".3" stop-color="#ffc76e" stop-opacity=".6"/><stop offset="1" stop-color="#ff9a3a" stop-opacity="0"/></radialGradient>
    <radialGradient id="c-froid"><stop offset="0" stop-color="#2a3a6a" stop-opacity="0"/><stop offset="1" stop-color="#2a3a6a" stop-opacity=".55"/></radialGradient>
    <linearGradient id="c-bois" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#8a6a44"/><stop offset=".55" stop-color="#3f2c1a"/><stop offset="1" stop-color="#291c11"/></linearGradient>
    <filter id="c-f2" x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur stdDeviation="2"/></filter>
  </defs><rect width="${largeur}" height="${hauteur}" fill="url(#c-nuit)"/>`;
  // la lisière, derrière les murs du fond
  const arbres: [number, number, number, number][] = [];
  for (let n = 0; n < 140; n++) {
    const t = r();
    const [x, y] = t < 0.5 ? P(-marge + 0.2 + r() * (w + 2 * marge - 1), -marge - 0.6) : P(-marge - 0.6, -marge + 0.2 + r() * (h + 2 * marge - 1));
    arbres.push([x + (r() - 0.5) * 30, y - r() * 60, 50 + r() * 80, r()]);
  }
  arbres.sort((a, b) => a[1] - b[1]);
  for (const [x, y, ht, t] of arbres) {
    const lw = ht * 0.34; let d = `M${x},${y - ht}`;
    for (let k = 1; k <= 5; k++) { const yy = y - ht + (ht * 0.94 * k) / 5, ww = (lw * k) / 5; d += `L${x + ww * 0.55},${yy - ht * 0.035}L${x + ww},${yy}L${x + ww * 0.35},${yy - ht * 0.02}`; }
    for (let k = 5; k >= 1; k--) { const yy = y - ht + (ht * 0.94 * k) / 5, ww = (lw * k) / 5; d += `L${x - ww * 0.35},${yy - ht * 0.02}L${x - ww},${yy}L${x - ww * 0.55},${yy - ht * 0.035}`; }
    s += p(`${d}Z`, melange(pal.arbres[0], pal.arbres[1], t * 0.8));
  }
  // le sol : les dalles de la carte et l'anneau qui la borde
  let sol = `<g stroke="${pal.joint}" stroke-width="1.3" stroke-linejoin="round">`;
  for (let i = -marge; i < w + marge; i++) for (let j = -marge; j < h + marge; j++) {
    const [x, y] = P(i, j);
    const dedans = i >= 0 && j >= 0 && i < w && j < h;
    const t = r(); const mousse = r() < (dedans ? 0.13 : 0.35);
    const teinte = mousse ? melange(pal.mousse[0], pal.mousse[1], t) : melange(pal.dalle[0], pal.dalle[1], t);
    sol += `<path d="${losange(x, y)}" fill="${dedans ? teinte : melange(teinte, '#000000', 0.32)}"/>`;
    const k = r();
    if (k < 0.22) sol += `<path d="M${x - A / 2},${y - B / 2}L${x + A / 2},${y + B / 2}" opacity=".8"/>`;
    else if (k < 0.4) sol += `<path d="M${x + A / 2},${y - B / 2}L${x - A / 2},${y + B / 2}" opacity=".8"/>`;
    else if (k < 0.47) sol += `<path d="M${x - 14},${y - 4}l9,5l-3,6l8,4" fill="none" opacity=".7" stroke-width="1"/>`;
    if (r() < 0.08) sol += `<path d="M${x - 10 + r() * 20},${y + 4}q2,-9 4,0q2,-7 4,0" fill="none" stroke="#6a7355" stroke-width="1.2" opacity=".8"/>`;
  }
  s += `${sol}</g>`;
  // le liseré de la carte : où s'arrêtent les cases jouables
  const [c0, c1, c2, c3] = [P(-0.5, -0.5), P(w - 0.5, -0.5), P(w - 0.5, h - 0.5), P(-0.5, h - 0.5)];
  s += `<path d="M${c0}L${c1}L${c2}L${c3}Z" fill="none" stroke="#efe2bd" stroke-opacity=".22" stroke-width="2"/>`;
  // la lumière : le brasero, ou la lune sur la clairière
  const feu = P(-1, Math.floor(h / 2));
  s += `<ellipse cx="${pal.brasero ? feu[0] : P(w / 2, h / 2)[0]}" cy="${(pal.brasero ? feu[1] : P(w / 2, h / 2)[1]) + 40}" rx="${pal.brasero ? 560 : 700}" ry="${pal.brasero ? 300 : 360}" fill="url(#c-feu)" opacity="${pal.brasero ? 1 : 0.35}" style="mix-blend-mode:screen"/>`;
  s += `<ellipse cx="${P(w / 2, h / 2)[0]}" cy="${P(w / 2, h / 2)[1] + 80}" rx="${largeur}" ry="${hauteur * 0.7}" fill="url(#c-froid)" style="mix-blend-mode:soft-light"/>`;
  // les murets du fond (ou les rochers, ou les menhirs)
  const murs: [number, number, number][] = [];
  for (let i = -marge; i < w + marge; i++) { let ht = 30 + r() * 10; if (r() < 0.12) ht = 70 + r() * 20; if (r() < 0.15) ht = 12; murs.push([i, -marge, pal.menhirs && r() < 0.3 ? 90 : ht]); }
  for (let j = -marge + 1; j < h + marge; j++) { let ht = 30 + r() * 10; if (r() < 0.12) ht = 70 + r() * 20; if (r() < 0.15) ht = 12; murs.push([-marge, j, pal.menhirs && r() < 0.3 ? 90 : ht]); }
  murs.sort((a, b) => a[0] + a[1] - (b[0] + b[1]));
  for (const [i, j, ht] of murs) { const [x, y] = P(i, j); const t = r(); s += boite(x, y, pal.menhirs && ht === 90 ? A * 0.5 : A, pal.menhirs && ht === 90 ? B * 0.5 : B, ht, pal.pierre.map((c) => melange(c, '#2a2833', t * 0.35)), ht > 30 ? 3 : 1); }
  if (pal.banniere) { const [x, y] = P(Math.floor(w / 2), -marge); const t = y - 80; s += p(`M${x - 39},${t + 9}L${x - 7},${t + 25}L${x - 7},${t + 70}L${x - 15},${t + 60}L${x - 23},${t + 68}L${x - 31},${t + 54}L${x - 39},${t + 58}Z`, '#7c1f14', 'stroke="#2a0b06" stroke-width=".9"'); }
  // les accessoires, sur l'anneau, du fond vers l'avant
  const objets: [number, number, string][] = [];
  const poser = (i: number, j: number, f: (x: number, y: number) => string) => { const [x, y] = P(i, j); objets.push([i + j, y, f(x, y)]); };
  if (pal.brasero) { poser(-1, Math.floor(h / 2), brasero); poser(w, Math.floor(h / 3), brasero); }
  if (terrain === 'reikwald') { poser(-2, 1, souche); poser(w + 1, h - 2, souche); poser(3, -2, souche); poser(-1, h, tonneau); }
  else { poser(-2, h - 2, colonne); poser(w + 1, 1, caisses); poser(w + 1, 2, tonneau); poser(Math.floor(w * 0.6), -2, colonne); }
  objets.sort((a, b) => a[0] - b[0]);
  for (const [, , dessin] of objets) s += dessin;
  const gauche = P(-0.5, h + 0.5)[0] - A, droite = P(w + 0.5, -0.5)[0] + A;
  const haut = P(-marge, -marge)[1] - 110, bas = P(w, h)[1] + 20;
  const cadrage = { x: gauche, y: haut, largeur: droite - gauche, hauteur: bas - haut };
  return { svg: `<svg class="cour-sol" viewBox="0 0 ${largeur} ${hauteur}" width="${largeur}" height="${hauteur}" aria-hidden="true">${s}</svg>`, largeur, hauteur, cadrage, centre: (x, y, n) => P(x + (n - 1) / 2, y + (n - 1) / 2) };
}
