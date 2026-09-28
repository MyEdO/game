/**
 * QC — les TROIS VUES du gabarit quadrupède/ailé, mesurées au raster (#1082).
 *
 *   npx tsx scripts/qc/quad-vues.mts           → tables lisibles
 *   npx tsx scripts/qc/quad-vues.mts --json    → JSON brut
 *
 * Script de RAPPORT, pas une garde : les écarts qu'il chiffre SONT l'état courant du socle, et
 * c'est leur DÉCROISSANCE qui se juge d'un lot à l'autre. Les cliquets qui, eux, échouent vivent
 * dans `src/gameIso/rig/quadruped/quad-vues-ratchet.test.ts`.
 *
 * Quatre mesures, chacune sur les 3 vues de chaque espèce :
 *   1. PARITÉ DE SILHOUETTE — hauteur/largeur/aire de la boîte englobante du rendu complet.
 *      L'écart relatif profil↔face dit de combien la bête « change de taille » en tournant.
 *   2. LIGNE DE SOL — y du pixel le plus bas : un flottement entre vues fait décoller/enfoncer
 *      la figurine quand elle pivote.
 *   3. DÉBORDS — pixels hors de la boîte d'authoring 120×150 (le viewBox de mesure est élargi).
 *      Le viewBox de mesure est BORNÉ (marge PAD_X=60, PAD_Y=75) : une silhouette qui touche son
 *      bord horizontal est marquée `saturé` et son débord est alors un MINORANT (le rendu est
 *      rogné par le viewBox, pas par la bête) — c'est le cas du basilic et de l'hydre de profil.
 *   4. OCCLUSION tête∩tronc — part des pixels de l'os `tete` que le `tronc` recouvrirait s'il
 *      passait devant : ce que coûterait une bascule de plan.
 *   5. MASQUAGE RÉEL — part des pixels d'un os (tête, nuque, aile) que les os de plan SUPÉRIEUR
 *      recouvrent dans le rendu courant : la mesure qui bouge quand la table `QUAD_Z` bouge.
 * Plus l'inventaire des DÉCORS MORTS (couple deco×os×vue déclaré par une def, jamais émis).
 *
 * PÉRIMÈTRE DE MESURE : tout ici (silhouettes, débords, sol, occlusion, ET le scan des décors
 * morts) est mesuré en `wings='folded'` et avec une pose d'animation VIDE (seule la posture propre
 * `stance` de la def s'applique, en profil). Ce qui n'existe qu'en `wings='spread'` ou sous une
 * pose d'animation n'est pas mesuré par ce rapport.
 */
import { Resvg } from '@resvg/resvg-js';
import { QUAD_SPECIES, WINGED_SPECIES } from '../../src/gameIso/rig/creatures';
import { resolveQuadFromProps } from '../../src/gameIso/rig/quadruped/composeQuad';
import { quadParts } from '../../src/gameIso/rig/quadruped/quadParts';
import { readQuadDecoKey, type QuadProps } from '../../src/gameIso/rig/quadruped/quadSkeleton';
import { bonesToSvg } from '../../src/gameIso/rig/renderBones';
import type { ResolvedBone } from '../../src/gameIso/rig/composeRig';
import { VIEWS, VIEW_LABEL, type View } from '../../src/gameIso/rig/facing';
import { defsGlobaux } from '../../src/gameIso/sprites';

// Boîte d'AUTHORING 120×150, mesurée dans un viewBox ÉLARGI (marge 60×75) pour voir les débords.
const BOX_W = 120, BOX_H = 150, PAD_X = 60, PAD_Y = 75;
const VB_W = BOX_W + 2 * PAD_X, VB_H = BOX_H + 2 * PAD_Y;
const RENDER_W = 480; // px ; unité boîte par pixel = VB_W / RENDER_W
const U = VB_W / RENDER_W;

interface Mask { m: Uint8Array; w: number; h: number }

/** Masque alpha du rendu. `clip` = viewBox de la boîte d'authoring SEULE (ce que le joueur voit,
 *  les débords sont rognés) ; sinon viewBox élargi (silhouette entière, débords compris). */
function maskOf(bones: ResolvedBone[], clip = false): Mask {
  const vb = clip ? `0 0 ${BOX_W} ${BOX_H}` : `${-PAD_X} ${-PAD_Y} ${VB_W} ${VB_H}`;
  const w = clip ? BOX_W : VB_W, h = clip ? BOX_H : VB_H;
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb}" ` +
    `width="${w}" height="${h}"><defs>${defsGlobaux()}</defs>${bonesToSvg(bones)}</svg>`;
  const r = new Resvg(svg, { fitTo: { mode: 'width', value: clip ? RENDER_W / 2 : RENDER_W } }).render();
  const px = r.pixels;
  const m = new Uint8Array(r.width * r.height);
  for (let i = 0; i < m.length; i++) m[i] = px[i * 4 + 3] > 32 ? 1 : 0;
  return { m, w: r.width, h: r.height };
}

interface Box { h: number; w: number; top: number; sol: number; gauche: number; droite: number; aire: number }

function boxOf(mask: Mask, padX = PAD_X, padY = PAD_Y): Box {
  let x0 = Infinity, y0 = Infinity, x1 = -1, y1 = -1, n = 0;
  for (let y = 0; y < mask.h; y++)
    for (let x = 0; x < mask.w; x++)
      if (mask.m[y * mask.w + x]) {
        n++;
        if (x < x0) x0 = x; if (x > x1) x1 = x;
        if (y < y0) y0 = y; if (y > y1) y1 = y;
      }
  if (n === 0) return { h: 0, w: 0, top: 0, sol: 0, gauche: 0, droite: 0, aire: 0 };
  return {
    h: (y1 - y0) * U, w: (x1 - x0) * U,
    top: y0 * U - padY, sol: y1 * U - padY,
    gauche: x0 * U - padX, droite: x1 * U - padX,
    aire: n * U * U,
  };
}

const inter = (a: Uint8Array, b: Uint8Array) => { let n = 0; for (let i = 0; i < a.length; i++) if (a[i] && b[i]) n++; return n; };
const count = (a: Uint8Array) => { let n = 0; for (let i = 0; i < a.length; i++) n += a[i]; return n; };
const bonesOf = (bones: ResolvedBone[], id: string) => bones.filter((b) => b.id === id);

const ALL: Record<string, QuadProps> = { ...QUAD_SPECIES, ...WINGED_SPECIES };

interface Row {
  espece: string;
  /** silhouette ENTIÈRE (viewBox élargi) : sert aux débords et à la ligne de sol réelle. */
  box: Record<View, Box>;
  /** silhouette VISIBLE (rognée à la boîte 120×150) : ce que le joueur voit à l'écran. */
  vu: Record<View, Box>;
  /** écart relatif de HAUTEUR VISIBLE profil vs face, en % (négatif = la bête RAPETISSE de profil). */
  ecartH: number;
  /** écart relatif d'AIRE VISIBLE profil vs face, en %. */
  ecartAire: number;
  /** amplitude de flottement de la ligne de sol entre les 3 vues (unités boîte). */
  flottementSol: number;
  /** `sature` : la silhouette touche un bord HORIZONTAL du viewBox de mesure → gauche/droite
   *  sont des MINORANTS du débord réel (le rendu est rogné par le viewBox). */
  debords: { view: View; top: number; sol: number; gauche: number; droite: number; sature: boolean }[];
  /** part (%) des pixels de `tete` recouverts par `tronc`, par vue — mesure de GÉOMÉTRIE
   *  (indépendante des plans : ce que coûterait une bascule de z). */
  occlusionTete: Record<View, number>;
  /** MASQUAGE RÉEL par vue : part (%) des pixels d'un os que les os peints PAR-DESSUS (z
   *  supérieur) recouvrent effectivement dans le rendu — dépend de la table `QUAD_Z`. */
  masque: Record<View, Record<'tete' | 'nuque' | 'aile', number>>;
}

/** % des pixels de l'os `id` recouverts par les os de plan STRICTEMENT supérieur. -1 = os absent. */
function masquageReel(bones: ResolvedBone[], id: string): number {
  const os = bonesOf(bones, id);
  if (!os.length) return -1;
  const z = Math.max(...os.map((b) => b.z));
  const dessus = bones.filter((b) => b.z > z);
  const m = maskOf(os).m, n = count(m);
  if (!n) return -1;
  if (!dessus.length) return 0;
  return (100 * inter(m, maskOf(dessus).m)) / n;
}

const rows: Row[] = [];
for (const [espece, p] of Object.entries(ALL)) {
  const box = {} as Record<View, Box>;
  const vu = {} as Record<View, Box>;
  const occlusionTete = {} as Record<View, number>;
  const masque = {} as Row['masque'];
  const debords: Row['debords'] = [];
  for (const view of VIEWS) {
    const bones = resolveQuadFromProps(p, view);
    box[view] = boxOf(maskOf(bones));
    vu[view] = boxOf(maskOf(bones, true), 0, 0);
    const tete = bonesOf(bones, 'tete'), tronc = bonesOf(bones, 'tronc');
    if (tete.length && tronc.length) {
      const mT = maskOf(tete).m, mB = maskOf(tronc).m;
      const nT = count(mT);
      occlusionTete[view] = nT ? (100 * inter(mT, mB)) / nT : 0;
    } else occlusionTete[view] = 0;
    masque[view] = {
      tete: masquageReel(bones, 'tete'),
      nuque: masquageReel(bones, 'nuque'),
      aile: masquageReel(bones, 'aileD'),
    };
    const b = box[view];
    const sature = b.gauche <= -PAD_X || b.droite >= BOX_W + PAD_X;
    if (b.top < 0 || b.sol > BOX_H || b.gauche < 0 || b.droite > BOX_W)
      debords.push({ view, top: b.top, sol: b.sol, gauche: b.gauche, droite: b.droite, sature });
  }
  const sols = VIEWS.map((v) => box[v].sol);
  rows.push({
    espece,
    box,
    vu,
    ecartH: (100 * (vu.profile.h - vu.front.h)) / vu.front.h,
    ecartAire: (100 * (vu.profile.aire - vu.front.aire)) / vu.front.aire,
    flottementSol: Math.max(...sols) - Math.min(...sols),
    debords,
    occlusionTete,
    masque,
  });
}

/** Décors MORTS : couple deco×os×vue déclaré par une def mais jamais émis par l'assemblage. */
const decosMorts: { espece: string; view: View; cle: string; os: string }[] = [];
let decosApplicables = 0;
for (const [espece, p] of Object.entries(ALL)) {
  if (!p.deco) continue;
  for (const view of VIEWS) {
    const nu = quadParts({ ...p, deco: undefined }, view);
    for (const cle of Object.keys(p.deco)) {
      const { bone: os, views } = readQuadDecoKey(cle);
      if (!views.includes(view)) continue;
      decosApplicables++;
      if (!nu[os]) decosMorts.push({ espece, view, cle, os });
    }
  }
}

if (process.argv.includes('--json')) {
  console.log(JSON.stringify({ rows, decosApplicables, decosMorts }, null, 1));
} else {
  const n = (v: number, d = 1) => v.toFixed(d).padStart(7);
  /** En-têtes des colonnes par vue, dans l'ordre de `VIEWS`, préfixés de la grandeur. */
  const parVue = (grandeur: string) => VIEWS.map((v) => `${grandeur}${VIEW_LABEL[v]}`.padStart(7)).join(' ');
  rows.sort((a, b) => Math.abs(b.ecartH) - Math.abs(a.ecartH));
  console.log(`\n== PARITÉ DE SILHOUETTE VISIBLE (${rows.length} espèces ; boîte 120×150, unités boîte) ==`);
  console.log(`${'espèce'.padEnd(28)} ${parVue('h')} ${'    Δh%'} ${' Δaire%'}`);
  console.log('-'.repeat(76));
  for (const r of rows)
    console.log(`${r.espece.padEnd(28)} ${VIEWS.map((v) => n(r.vu[v].h)).join(' ')} ${n(r.ecartH)} ${n(r.ecartAire)}`);

  console.log('\n== LIGNE DE SOL PAR VUE (y du pixel le plus bas, silhouette entière ; sol de boîte = 150) ==');
  const parSol = [...rows].sort((a, b) => b.flottementSol - a.flottementSol);
  console.log(`${'espèce'.padEnd(28)} ${parVue('sol')} ${' flott.'}`);
  console.log('-'.repeat(76));
  for (const r of parSol)
    console.log(`${r.espece.padEnd(28)} ${VIEWS.map((v) => n(r.box[v].sol)).join(' ')} ${n(r.flottementSol, 2)}`);

  console.log('\n== DÉBORDS DE LA BOÎTE 120×150 (silhouette entière hors boîte) ==');
  console.log(`   viewBox de mesure : x ∈ [${-PAD_X}, ${BOX_W + PAD_X}] — « saturé » = bord atteint, gauche/droite sont des MINORANTS`);
  const deb = rows.flatMap((r) => r.debords.map((d) => ({ espece: r.espece, ...d })));
  if (!deb.length) console.log('  (aucun)');
  for (const d of deb)
    console.log(`  ${d.espece.padEnd(28)} ${d.view.padEnd(8)} haut=${n(d.top)} sol=${n(d.sol)} gauche=${n(d.gauche)} droite=${n(d.droite)}${d.sature ? '  saturé' : ''}`);

  console.log('\n== OCCLUSION tête∩tronc (% des pixels de `tete` que le tronc recouvrirait) ==');
  const parOcc = [...rows].sort((a, b) => b.occlusionTete.back - a.occlusionTete.back);
  console.log(`${'espèce'.padEnd(28)} ${parVue('')}`);
  console.log('-'.repeat(60));
  for (const r of parOcc)
    console.log(`${r.espece.padEnd(28)} ${VIEWS.map((v) => n(r.occlusionTete[v])).join(' ')}`);

  console.log('\n== MASQUAGE RÉEL (% des pixels d\'un os couverts par les os peints PAR-DESSUS) ==');
  console.log('   « — » = l\'os ne porte pas d\'art dans cette vue ; `aile` = aileD (proche/droite).');
  console.log(`${'espèce'.padEnd(28)} ${'têteDos'} ${'nuqDos'} ${'aileDos'} ${'aileFac'} ${'têtePro'}`);
  console.log('-'.repeat(76));
  const q = (v: number) => (v < 0 ? '      —' : n(v));
  for (const r of [...rows].sort((a, b) => b.masque.back.aile - a.masque.back.aile))
    console.log(`${r.espece.padEnd(28)} ${q(r.masque.back.tete)} ${q(r.masque.back.nuque)} ${q(r.masque.back.aile)} ${q(r.masque.front.aile)} ${q(r.masque.profile.tete)}`);

  console.log(`\n== DÉCORS MORTS : ${decosMorts.length} / ${decosApplicables} couples applicables ==`);
  for (const d of decosMorts) console.log(`  ${d.espece.padEnd(28)} ${d.view.padEnd(8)} deco[${d.cle}] → os '${d.os}' sans art dans cette vue`);
}
