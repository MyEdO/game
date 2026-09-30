/** Couture des planches de QC AVEUGLE (`scripts/_qc-blind.mts`, `scripts/_qc-all-blind.mts`) et du
 *  rendu mono-créature (`scripts/qc/render-creature.mts`) : dossier de sortie EXPLICITE, rendu d'une
 *  case par ID STABLE qui LÈVE sur toute référence non résolue, et mise en planche où chaque rig TIENT
 *  dans sa case (échelle réduite sur sa boîte englobante). */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { Resvg } from '@resvg/resvg-js';
import { findCreatureById, findTrappingById } from '../../src/data';
import { bonesToSvg } from '../../src/gameIso/rig/renderBones';
import { resolveRig } from '../../src/gameIso/rig/composeRig';
import { entityRigProfile } from '../../src/gameIso/rig/enemyProfile';
import { planById, resolveById, resolveSpecies } from '../../src/gameIso/rig/bodyPlan';
import { defById } from '../../src/gameIso/rig/creatures';
import { defsGlobaux } from '../../src/gameIso/sprites';
import { hashSeed } from '../../src/engine/dice';
import type { View } from '../../src/gameIso/rig/facing';

/** Dossier de sortie `dossier` (un argument de la ligne de commande), créé au besoin ; absent → `usage`
 *  sur la sortie d'erreur et sortie en erreur. */
export function dossierDeSortie(dossier: string | undefined, usage: string): string {
  if (!dossier) {
    console.error(`usage: ${usage}`);
    process.exit(1);
  }
  mkdirSync(dossier, { recursive: true });
  return dossier;
}

/** Case aveugle : `id` = def de créature NON bipède, ou record de créature bipède ; `arme` = id de
 *  Possession (arme du catalogue), bipède seulement. */
export interface CaseAveugle { id: string; arme?: string }

/** Gabarit rendu d'une case (écrit dans la vérité privée). */
export function planDe(c: CaseAveugle): string {
  const def = defById(c.id);
  return def && def.plan !== 'biped' ? def.plan : 'biped';
}

/** SVG (repère du rig) d'une def NON bipède pour une vue, et son échelle de gabarit. LÈVE si `id` ne
 *  nomme pas une def non bipède, ou si son espèce est absente de son plan. */
export function svgDeDef(id: string, view: View): { svg: string; sl: number } {
  const def = defById(id);
  if (!def || def.plan === 'biped') throw new Error(`« ${id} » : aucune def de créature non bipède`);
  const plan = planById(def.plan);
  if (!plan.speciesNames().includes(id)) throw new Error(`« ${id} » : espèce absente du plan « ${def.plan} »`);
  const r = resolveSpecies(id);
  return { svg: bonesToSvg(plan.resolve(r.species, view, plan.restPose(), {})), sl: r.scale };
}

/** SVG d'une case pour une vue, et son échelle de gabarit (`sl`, 1 pour un bipède). LÈVE si l'id ne
 *  résout ni une def non bipède, ni un record bipède à espèce, ou si l'arme n'est pas une arme du catalogue. */
export function svgDeCase(c: CaseAveugle, view: View, idx: number): { svg: string; sl: number } {
  if (planDe(c) !== 'biped') {
    if (c.arme) throw new Error(`case « ${c.id} » : une arme ne se pose que sur un bipède`);
    return svgDeDef(c.id, view);
  }
  const r = resolveById(c.id);
  if (!findCreatureById(c.id) || r.kind !== 'rig' || r.repli) throw new Error(`case « ${c.id} » : ni def non bipède, ni record bipède à espèce`);
  const arme = c.arme ? findTrappingById(c.arme) : undefined;
  if (c.arme && (arme?.categorie !== 'melee' && arme?.categorie !== 'ranged')) throw new Error(`case « ${c.id} » : « ${c.arme} » n'est pas une arme du catalogue`);
  const prof = entityRigProfile(c.id, hashSeed(c.id + idx), c.arme ? { weapon: c.arme } : {});
  if (!prof) throw new Error(`case « ${c.id} » : aucun profil de rig`);
  return { svg: bonesToSvg(resolveRig(prof.appearance, prof.equip, {}, prof.tenue, view)), sl: 1 };
}

/** Libellé d'affichage de la vérité privée : record, sinon def. */
export function libelleDe(c: CaseAveugle): string {
  return findCreatureById(c.id)?.label ?? defById(c.id)?.label ?? c.id;
}

/** Rectangle `x, y, l(argeur), h(auteur)`. */
export interface Boite { x: number; y: number; l: number; h: number }

/** Ancre du repère de rig (cadre 120×150) : la ligne des pieds. */
const ANCRE_RIG = { y: 150 } as const;
/** Demi-côté du canevas de mesure : un rig y tient quelle que soit son échelle de gabarit. */
const DEMI_CANEVAS = 4000;

/** Boîte englobante d'un SVG de rig, dans le repère du rig, mesurée par Resvg. LÈVE sur un rig vide. */
function boiteDuRig(svg: string): Boite {
  const c = 2 * DEMI_CANEVAS;
  const b = new Resvg(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${c}" height="${c}" viewBox="0 0 ${c} ${c}"><defs>${defsGlobaux()}</defs>` +
      `<g transform="translate(${DEMI_CANEVAS},${DEMI_CANEVAS})">${svg}</g></svg>`,
  ).getBBox();
  if (!b || !(b.width > 0) || !(b.height > 0)) throw new Error('rig sans boîte englobante (rien de visible)');
  return { x: b.x - DEMI_CANEVAS, y: b.y - DEMI_CANEVAS, l: b.width, h: b.height };
}

type Point = { x: number; y: number };

/** Plus grande échelle ≤ `voulue` à laquelle un rig de boîte `b` (repère du rig), pieds sur `ancre.y` et
 *  boîte centrée sur `ancre.x`, tient dans `cadre`. LÈVE si l'ancre sort du cadre. */
function echelleQuiTient(b: Boite, voulue: number, ancre: Point, cadre: Boite): number {
  if (ancre.x < cadre.x || ancre.x > cadre.x + cadre.l || ancre.y < cadre.y || ancre.y > cadre.y + cadre.h)
    throw new Error(`ancre (${ancre.x}, ${ancre.y}) hors de son cadre`);
  const limite = (place: number, debord: number) => (debord > 0 ? place / debord : Infinity);
  return Math.min(
    voulue,
    limite(2 * Math.min(ancre.x - cadre.x, cadre.x + cadre.l - ancre.x), b.l),
    limite(ancre.y - cadre.y, ANCRE_RIG.y - b.y),
    limite(cadre.y + cadre.h - ancre.y, b.y + b.h - ANCRE_RIG.y),
  );
}

/** `<g>` qui pose un rig de boîte `b` à `echelle`, pieds sur `ancre.y` et boîte centrée sur `ancre.x` ;
 *  et sa boîte posée. */
function poser(svg: string, b: Boite, echelle: number, ancre: Point): { g: string; boite: Boite } {
  const tx = ancre.x - (b.x + b.l / 2) * echelle, ty = ancre.y - ANCRE_RIG.y * echelle;
  return {
    g: `<g transform="translate(${tx},${ty}) scale(${echelle})">${svg}</g>`,
    boite: { x: tx + b.x * echelle, y: ty + b.y * echelle, l: b.l * echelle, h: b.h * echelle },
  };
}

/** Grille d'une planche aveugle : `cols` cases de `cw`×`ch` par rangée, une sous-case par vue, pieds à
 *  `pieds` du haut de la case, échelle voulue d'un rig selon son échelle de gabarit. */
export interface GrillePlanche {
  titre: string; vues: View[]; cols: number; cw: number; ch: number; pieds: number;
  echelle: (sl: number) => number;
}

/** Pose d'une vue d'une case sur la planche. */
export interface PoseDeCase { cell: number; vue: View; cadre: Boite; boite: Boite; echelle: number }

/** Marges de la planche : bord, bandeau de titre, bandeau du n° de case, retrait intérieur d'une sous-case. */
const BORD = 10, TITRE = 36, NUMERO = 24, RETRAIT = 4;

/** SVG de la planche : cases numérotées, sans nom. Les vues d'une case partagent UNE échelle, la plus
 *  grande ≤ la voulue où chacune tient dans sa sous-case. */
export function planche(cases: CaseAveugle[], g: GrillePlanche): { svg: string; largeur: number; poses: PoseDeCase[] } {
  const sub = g.cw / g.vues.length;
  const cells: string[] = [];
  const poses: PoseDeCase[] = [];
  cases.forEach((c, idx) => {
    const ox = BORD + (idx % g.cols) * g.cw, oy = TITRE + Math.floor(idx / g.cols) * g.ch;
    const lCase = g.cw - 8, hCase = g.ch - 10;
    cells.push(`<rect x="${ox}" y="${oy}" width="${lCase}" height="${hCase}" fill="#2b3142" stroke="#3a4156"/>`);
    cells.push(`<text x="${ox + 8}" y="${oy + 18}" font-size="15" fill="#e8c25a" font-family="sans-serif" font-weight="bold">#${idx + 1}</text>`);
    const vues = g.vues.map((vue, i) => {
      const { svg, sl } = svgDeCase(c, vue, idx);
      const x0 = ox + i * sub + RETRAIT, x1 = Math.min(ox + (i + 1) * sub, ox + lCase) - RETRAIT;
      const cadre = { x: x0, y: oy + NUMERO, l: x1 - x0, h: hCase - NUMERO - RETRAIT };
      return { vue, svg, sl, b: boiteDuRig(svg), cadre, ancre: { x: ox + i * sub + sub / 2, y: oy + g.pieds } };
    });
    const echelle = Math.min(...vues.map((v) => echelleQuiTient(v.b, g.echelle(v.sl), v.ancre, v.cadre)));
    for (const v of vues) {
      const pose = poser(v.svg, v.b, echelle, v.ancre);
      cells.push(pose.g);
      poses.push({ cell: idx + 1, vue: v.vue, cadre: v.cadre, boite: pose.boite, echelle });
    }
  });
  const largeur = BORD + g.cols * g.cw, hauteur = TITRE + Math.ceil(cases.length / g.cols) * g.ch + BORD;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${largeur} ${hauteur}"><defs>${defsGlobaux()}</defs>` +
    `<rect width="${largeur}" height="${hauteur}" fill="#171b24"/>` +
    `<text x="${BORD}" y="22" font-size="15" fill="#9fb0c8" font-family="sans-serif">${g.titre}</text>${cells.join('')}</svg>`;
  return { svg, largeur, poses };
}

/** Écrit sous `dossier` la planche `noms.png` (largeur en pixels ≤ `pxMax`) et sa vérité PRIVÉE
 *  `noms.verite` (`[{ cell, plan, id, truth }]`) ; rend le chemin de la planche. */
export function ecrirePlanche(
  dossier: string, noms: { png: string; verite: string }, cases: CaseAveugle[], g: GrillePlanche, pxMax = Infinity,
): string {
  const { svg, largeur } = planche(cases, g);
  const png = join(dossier, noms.png);
  writeFileSync(png, new Resvg(svg, { background: '#171b24', fitTo: { mode: 'width', value: Math.min(pxMax, largeur * 2) } }).render().asPng());
  writeFileSync(join(dossier, noms.verite), JSON.stringify(cases.map((c, i) => ({ cell: i + 1, plan: planDe(c), id: c.id, truth: libelleDe(c) })), null, 2));
  return png;
}
