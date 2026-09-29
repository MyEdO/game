#!/usr/bin/env node
// GARDE NAVIGATEUR du trait de la vue du dessus (#1883) : ce que jsdom n'évalue pas (`max()`/`calc()`
// sur `var(--k)`), mesuré sur un vrai rendu Chrome headless (kit `scripts/recette/lib.mjs`).
//   node scripts/recette/plancher-trait.mjs
// Chemin RÉEL : `buildWalls` → `wallSvg` (vue du dessus) sous le style du groupe caméra
// (`stageCamStyle`, seul écrivain de `--k`), rastérisé à l'échelle écran s. Mesures :
//  - PLANCHER du cœur (mur nu coupé), EN TRAVERS de l'arête : épaisseur = max(largeur monde × s, plancher) ;
//  - LISERÉ : (bord − cœur) / 2 ≥ le liseré de chaque côté ;
//  - PLANCHER LE LONG de l'arête d'un barreau de herse et d'un montant de mur nu : étendue =
//    max(longueur monde × s, plancher le long) ;
//  - toute dimension mesurée, et le JOUR entre deux barreaux de herse au dézoom, ≥ `VISIBLE_MIN_PX` ;
//  - TIRETS du surplomb : même nombre sur arête cardinale et diagonale.
// Une épaisseur ou un jour se mesure par COUVERTURE SOMMÉE (Σ (255 − R) / 255 le long d'une ligne de
// pixels, traits forcés au noir sur fond blanc), jamais par seuil ; seul le COMPTE de tirets seuille.
// Sortie : une ligne par mesure, code 1 au premier écart.
import { tsImport } from 'tsx/esm/api';
import { launchSession, evaluate } from './lib.mjs';

const src = (p) => tsImport(new URL(`../../src/${p}`, import.meta.url).href, import.meta.url);
const { buildWalls, coupeDuMur, HAUTEUR_DE_COUPE_M } = await src('gameIso/builders/walls.ts');
const { wallSvg, dessusDeLaCoupe, dessusSvg, PLANCHER_DU_COEUR_PX, PLANCHER_LE_LONG_PX, LISERE_PX } = await src('gameIso/authoring/wallsSvg.ts');
const { projGP } = await src('gameIso/authoring/project.ts');
const { stageCamStyle, stageScreenPixel } = await src('gameIso/stage/stageCam.ts');
const { VW, VH } = await src('gameIso/stage/useStageCamera.ts');
const { emptyScene, sceneMetresPerTile } = await src('state/scene.ts');

/** Échelles écran (px par unité de viewBox) mesurées au jeu (#1883 c12) : dézoom, nominal, zoom max. */
const ECHELLES = [0.411, 1, 4.03];
const TOLERANCE_PX = 0.15;
/** Plus petite dimension écran (px) qu'un œil distingue — seuil de la GARDE, pas une constante du rendu. */
const VISIBLE_MIN_PX = 1;
/** Sur-échantillonnage du raster de mesure : l'erreur de quantification d'une couverture sommée reste
 *  sous 1 / SUR px, sous `TOLERANCE_PX`. */
const SUR_ECHANTILLONNAGE = 10;
const CANVAS = { w: VW, h: VH };
const DIMS = { w: 6, h: 6, view: 'top' };

const element = (side, appearance) => {
  const s = emptyScene(6, 6);
  s.walls = [{ x: 2, y: 2, side, structure: 'mur-en-bois', ...(appearance ? { appearance } : {}) }];
  return { el: buildWalls(s)[0], mpt: sceneMetresPerTile(s) };
};

/** Un élément rendu à l'échelle `k`, caméra centrée sur le milieu de son arête : le SVG complet, et les
 *  pixels écran de ses extrémités. */
function cadre(el, svgMur, k) {
  const [a, b] = el.ends.map((gp) => projGP(gp, DIMS));
  const milieu = { x: (a[0] + b[0]) / 2, y: (a[1] + b[1]) / 2 };
  const cam = { x: VW / 2 - milieu.x, y: VH / 2 - milieu.y };
  const style = Object.entries(stageCamStyle(cam, k, CANVAS)).map(([p, v]) => `${p}:${v}`).join(';');
  const px = (p) => stageScreenPixel({ cx: p[0], cy: p[1] }, cam, k, CANVAS);
  return { svg: `<g style="${style}">${svgMur}</g>`, A: px(a), B: px(b) };
}

const murNu = element('N');
const diagonale = element('\\');
const herse = element('N', 'herse');
const largeurMur = (() => {
  const [a, b] = murNu.el.ends.map((gp) => projGP(gp, DIMS));
  const vbParM = Math.hypot(b[0] - a[0], b[1] - a[1]) / murNu.mpt;
  return coupeDuMur(murNu.el.faces, murNu.el.ends, HAUTEUR_DE_COUPE_M, murNu.mpt).find((e) => e.part === 'face').epaisseurM * vbParM;
})();
/** Les tronçons d'une part, SEULS, sérialisés : leur SVG, leurs milieux (t) et leur longueur monde
 *  (unités de viewBox) le long de l'arête. */
function tronconsSeuls({ el, mpt }, part) {
  const coupe = coupeDuMur(el.faces, el.ends, HAUTEUR_DE_COUPE_M, mpt).filter((e) => e.part === part);
  const [a, b] = el.ends.map((gp) => projGP(gp, DIMS));
  const arete = Math.hypot(b[0] - a[0], b[1] - a[1]);
  return {
    svg: dessusSvg(dessusDeLaCoupe(coupe, el.ends, DIMS, mpt)),
    t: coupe.map((e) => (e.t0 + e.t1) / 2),
    longueurs: coupe.map((e) => (e.t1 - e.t0) * arete),
  };
}
const barreaux = tronconsSeuls(herse, 'barreau');
const montants = tronconsSeuls(murNu, 'poteau');

const cas = ECHELLES.map((k) => ({
  k,
  mur: cadre(murNu.el, wallSvg(murNu.el, DIMS, { mpt: murNu.mpt }), k),
  diag: cadre(diagonale.el, wallSvg(diagonale.el, DIMS, { mpt: diagonale.mpt }), k),
  herse: cadre(herse.el, barreaux.svg, k),
  montants: cadre(murNu.el, montants.svg, k),
}));

/** Côté navigateur : rastérise et mesure. Fonction SÉRIALISÉE dans la page. */
async function mesurer({ cas, SUR, MARGE, tBarreaux, tMontants }) {
  /** Rastérise, en VECTORIEL et SUR-échantillonné `SUR` fois, la région de l'écran qui entoure [A, B]
   *  (marge `MARGE` px) : une mesure en px écran ne dépend plus de la grille de pixels. */
  const raster = async (inner, css, A, B) => {
    const x0 = Math.min(A.sx, B.sx) - MARGE, y0 = Math.min(A.sy, B.sy) - MARGE;
    const w = Math.abs(B.sx - A.sx) + 2 * MARGE, h = Math.abs(B.sy - A.sy) + 2 * MARGE;
    const W = Math.ceil(w * SUR), H = Math.ceil(h * SUR);
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="${x0} ${y0} ${W / SUR} ${H / SUR}"><style>path{stroke:#000 !important}${css}</style><rect x="${x0}" y="${y0}" width="${W / SUR}" height="${H / SUR}" fill="#fff"/>${inner}</svg>`;
    const img = new Image();
    img.src = 'data:image/svg+xml,' + encodeURIComponent(svg);
    await img.decode();
    const c = document.createElement('canvas');
    c.width = W; c.height = H;
    const g = c.getContext('2d');
    g.drawImage(img, 0, 0);
    return { x0, y0, W, H, data: g.getImageData(0, 0, W, H).data };
  };
  /** Couverture (0..1) au point écran (x, y) ; hors de la région rastérisée, fond. */
  const couv = (r, x, y) => {
    const i = Math.floor((x - r.x0) * SUR), j = Math.floor((y - r.y0) * SUR);
    return i < 0 || j < 0 || i >= r.W || j >= r.H ? 0 : (255 - r.data[(j * r.W + i) * 4]) / 255;
  };
  /** Couverture sommée (px écran) le long du segment [p, q] : un échantillon au milieu de chaque pas d'un
   *  sous-pixel au plus, pondéré par la longueur du pas. */
  const somme = (g, p, q) => {
    const L = Math.hypot(q.sx - p.sx, q.sy - p.sy);
    const n = Math.ceil(L * SUR);
    let s = 0;
    for (let i = 0; i < n; i++) s += couv(g, p.sx + ((q.sx - p.sx) * (i + 0.5)) / n, p.sy + ((q.sy - p.sy) * (i + 0.5)) / n);
    return (s * L) / n;
  };
  /** Épaisseur du trait au milieu de [A, B], mesurée sur la perpendiculaire. */
  const epaisseur = (g, A, B) => {
    const m = { sx: (A.sx + B.sx) / 2, sy: (A.sy + B.sy) / 2 };
    const L = Math.hypot(B.sx - A.sx, B.sy - A.sy);
    const n = { x: -(B.sy - A.sy) / L, y: (B.sx - A.sx) / L };
    return somme(g, { sx: m.sx - 40 * n.x, sy: m.sy - 40 * n.y }, { sx: m.sx + 40 * n.x, sy: m.sy + 40 * n.y });
  };
  /** Nombre de tirets le long de [A, B] (échantillon ≥ 0,5 = trait). */
  const tirets = (g, A, B) => {
    const n = Math.ceil(Math.hypot(B.sx - A.sx, B.sy - A.sy) * SUR);
    let runs = 0, prev = false;
    for (let i = 0; i <= n; i++) {
      const on = couv(g, A.sx + ((B.sx - A.sx) * i) / n, A.sy + ((B.sy - A.sy) * i) / n) >= 0.5;
      if (on && !prev) runs++;
      prev = on;
    }
    return runs;
  };
  const at = (A, B, t) => ({ sx: A.sx + (B.sx - A.sx) * t, sy: A.sy + (B.sy - A.sy) * t });
  /** Étendue LE LONG de [A, B] de chaque tronçon centré en `ts` : couverture sommée sur la droite de
   *  l'arête, de la mi-distance au voisin de gauche à celle au voisin de droite (demi-arête aux bouts). */
  const etendues = (g, A, B, ts) => ts.map((t, i) => somme(g,
    at(A, B, i > 0 ? (ts[i - 1] + t) / 2 : t - 0.5),
    at(A, B, i < ts.length - 1 ? (t + ts[i + 1]) / 2 : t + 0.5)));
  const out = [];
  for (const { k, mur, diag, herse, montants } of cas) {
    const coeur = epaisseur(await raster(mur.svg, '.mur-sous,.mur-surplomb,.mur-bord{display:none}', mur.A, mur.B), mur.A, mur.B);
    const bord = epaisseur(await raster(mur.svg, '.mur-sous,.mur-surplomb{display:none}', mur.A, mur.B), mur.A, mur.B);
    const surplomb = '.mur-sous,.mur-coupe,.mur-bord{display:none}';
    const dCard = tirets(await raster(mur.svg, surplomb, mur.A, mur.B), mur.A, mur.B);
    const dDiag = tirets(await raster(diag.svg, surplomb, diag.A, diag.B), diag.A, diag.B);
    const gH = await raster(herse.svg, '', herse.A, herse.B);
    const jours = [];
    for (let i = 1; i < tBarreaux.length; i++) {
      const p = at(herse.A, herse.B, tBarreaux[i - 1]), q = at(herse.A, herse.B, tBarreaux[i]);
      jours.push(Math.hypot(q.sx - p.sx, q.sy - p.sy) - somme(gH, p, q));
    }
    const barreaux = etendues(gH, herse.A, herse.B, tBarreaux);
    const poteaux = etendues(await raster(montants.svg, '', montants.A, montants.B), montants.A, montants.B, tMontants);
    out.push({ k, coeur, bord, dCard, dDiag, jourMin: Math.min(...jours), barreaux, poteaux });
  }
  return out;
}

const session = await launchSession({ width: VW, height: VH });
let mesures;
try {
  mesures = await evaluate(session, `(${mesurer.toString()})(${JSON.stringify({ cas, SUR: SUR_ECHANTILLONNAGE, MARGE: 60, tBarreaux: barreaux.t, tMontants: montants.t })})`, { timeoutMs: 60000 });
} finally {
  await session.close();
}

const ecarts = [];
/** Une dimension mesurée confrontée à max(monde × s, plancher) et au seuil de visibilité. */
const confronter = (quoi, k, mesure, mondeVb, plancher) => {
  const attendu = Math.max(mondeVb * k, plancher);
  if (Math.abs(mesure - attendu) > TOLERANCE_PX) ecarts.push(`s=${k} : ${quoi} ${mesure.toFixed(2)} ≠ max(${(mondeVb * k).toFixed(2)}, ${plancher}) = ${attendu.toFixed(2)}`);
  if (mesure < VISIBLE_MIN_PX) ecarts.push(`s=${k} : ${quoi} ${mesure.toFixed(2)} < ${VISIBLE_MIN_PX} px`);
  return `${mesure.toFixed(2)} px (attendu ${attendu.toFixed(2)})`;
};
for (const { k, coeur, bord, dCard, dDiag, jourMin, barreaux: bs, poteaux } of mesures) {
  const lisere = (bord - coeur) / 2;
  const coeurLu = confronter('cœur', k, coeur, largeurMur, PLANCHER_DU_COEUR_PX);
  const barreauxLus = bs.map((m, i) => confronter(`barreau ${i} le long`, k, m, barreaux.longueurs[i], PLANCHER_LE_LONG_PX));
  const montantsLus = poteaux.map((m, i) => confronter(`montant ${i} le long`, k, m, montants.longueurs[i], PLANCHER_LE_LONG_PX));
  console.log(`s=${k} : cœur ${coeurLu} · liseré ${lisere.toFixed(2)} px/côté · tirets cardinal ${dCard} / diagonal ${dDiag} · jour min entre barreaux ${jourMin.toFixed(2)} px`);
  console.log(`  barreaux le long : ${barreauxLus.join(' · ')}`);
  console.log(`  montants le long : ${montantsLus.join(' · ')}`);
  if (lisere < LISERE_PX - TOLERANCE_PX) ecarts.push(`s=${k} : liseré ${lisere.toFixed(2)} < ${LISERE_PX} px`);
  if (dCard !== dDiag || dCard < 2) ecarts.push(`s=${k} : tirets ${dCard} (cardinal) ≠ ${dDiag} (diagonal)`);
  if (k === ECHELLES[0] && jourMin < VISIBLE_MIN_PX) ecarts.push(`s=${k} : jour entre barreaux ${jourMin.toFixed(2)} < ${VISIBLE_MIN_PX} px`);
}
if (ecarts.length) {
  console.error(`ÉCARTS (${ecarts.length}) :\n  ${ecarts.join('\n  ')}`);
  process.exit(1);
}
console.log('plancher-trait : OK');
