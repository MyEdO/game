/**
 * PEINTRE SVG D'AUTHORING des murs (frontière du module : `authoring/project.ts`) — iso losange ·
 * edge-on · vue du dessus : dessine un élément `wall`
 * du pivot en SVG, en projetant ses faces GRILLE+MÈTRES via le pont partagé (`projGP`). La ROTATION
 * caméra vit ici ; l'OMBRAGE d'orientation (arête N dans l'ombre) et les traits/liserés (dérivés de la
 * couleur de face via `shade.ts`) aussi. Les couleurs de base viennent de la def JSON par `wallPartColor`
 * (source unique avec le POV). La vue du DESSUS ('top'), routée par `isSquareView`, est la COUPE
 * HORIZONTALE des faces (`builders/walls.ts:coupeDuMur`), en DONNÉE (`dessusDuMur`) que `dessusSvg`
 * sérialise.
 */
import { depth, isSquareView, type Dims } from '../../geometry/iso';
import { WALL_H_M, isoPxToM } from '../iso';
import { APPARENCE_MUR_NU } from '../../state/formeArete';
import { estBaie } from '../../data/formesDArete';
import { jambCapColor, structureAppearance, wallPartColor, wallPartOutline, windowLit, type StructureAppearanceDef, type WallPart } from '../catalog/structures';
import { shade, spec, tonsDArete, SIDE_N, SIDE_LIT, POST_CAP, POST_BASE } from '../shade';
import { detailOf, coursesOverlaySvg, timberOverlaySvg, verticalAccentsSvg, projTag, type DetailOpts } from './detailSvg';
import { hash32 } from '../../data/hash';
import type { Face, GP, WallEl } from '../builders/types';
import { coupeDuMur, HAUTEUR_DE_COUPE_M, type ClasseDeCoupe, type TronconDeCoupe } from '../builders/walls';
import type { WallSide } from '../../state/scene';
import { projGP, type Pt2 } from './project';
import { ECHELLE_ECRAN } from '../echelleEcran';

// Épaisseurs ÉCRAN (px) des ornements — des formes, jamais des identités de couleur.
const POST_W = 3.8, POST_CAP_H = 2.4, POST_BASE_H = 3; // montant d'extrémité
const JAMB_W = 3.6, JAMB_CAP_H = 1.8; // jambage de porte
const FRAME_W = 1.3, BAR_W = 1.7; // moulure bois / barreau de claire-voie (lignes médianes)

/** Parties ombrées par ORIENTATION (arête N assombrie). La PIERRE (hex
 *  depuis la palette unifiée du JSON) est désormais ombrée comme le bois : sa face N recule dans l'ombre,
 *  la lecture 3D « dessiné main » prime sur l'ancien aplat brut. */
const TINTED: ReadonlySet<WallPart> = new Set([
  'face', 'panneau', 'moulure', 'plinthe', 'couronnement',
  'meneau', 'vantail', 'vantail-planche', 'poignee', // fenêtre (meneau) + vantail : bois/pierre, ombrés par l'orientation
]);

/** Parties MAÇONNÉES recevant le motif d'appareillage quand la def porte une recette — SOURCE UNIQUE
 *  du peintre SVG (motif LOD ≥ 1 ci-dessous). Le monde volumique n'interroge PAS ce jeu : il décide l'appareillage par
 *  SURFACE (`backends/webgl/sceneMeshes.faceGroup` : `recipe.courses` + `uvScaleM`, tracé métrique de
 *  `detail/courses` rasterisé par `backends/webgl/periodTexture.ts`). */
export const COURSED: ReadonlySet<WallPart> = new Set(['face', 'parapet', 'linteau']);

/** Profondeur de tri : MAX sur les deux cases bordant l'arête → le mur reste devant son sol proche aux
 *  4 rotations ; vue du dessus : +0.6 (au-dessus des overlays de sol), comme l'historique. */
export function wallDepth(el: WallEl, dims: Dims): number {
  const { x, y, z } = el.cell;
  const cells: [number, number][] = el.side === 'E' ? [[x, y], [x + 1, y]] : el.side === 'N' ? [[x, y], [x, y - 1]] : [[x, y]];
  return Math.max(...cells.map(([cx, cy]) => depth(cx, cy, dims, z))) + 0.45 + (isSquareView(dims.view) ? 0.6 : 0);
}

const polyPts = (pts: Pt2[]) => pts.map((p) => `${p[0]},${p[1]}`).join(' ');
const mid = (a: Pt2, b: Pt2): Pt2 => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
const line = (a: Pt2, b: Pt2, color: string, w: number) =>
  `<line x1="${a[0]}" y1="${a[1]}" x2="${b[0]}" y2="${b[1]}" stroke="${color}" stroke-width="${w}"/>`;
const lisereAttr = (l: { couleur: string; largeur: number } | undefined) => (l ? ` stroke="${l.couleur}" stroke-width="${l.largeur}"` : '');

/** Montant plein (poteau) du haut [0] au bas [1] : rect + chapiteau clair + socle sombre. */
function postSvg(top: Pt2, bot: Pt2, app: StructureAppearanceDef): string {
  const x = top[0] - POST_W / 2;
  return `<rect x="${x}" y="${top[1]}" width="${POST_W}" height="${bot[1] - top[1]}" fill="${app.post}"/>` +
    `<rect x="${x}" y="${top[1]}" width="${POST_W}" height="${POST_CAP_H}" fill="${shade(app.post, POST_CAP)}"/>` +
    `<rect x="${x}" y="${bot[1] - POST_BASE_H}" width="${POST_W}" height="${POST_BASE_H}" fill="${shade(app.post, POST_BASE)}"/>`;
}

/** Jambage de porte (montant fin aux couleurs de la def de porte, repli dérivé de la face). */
function jambSvg(top: Pt2, bot: Pt2, app: StructureAppearanceDef): string {
  const x = top[0] - JAMB_W / 2;
  return `<rect x="${x}" y="${top[1]}" width="${JAMB_W}" height="${bot[1] - top[1]}" fill="${wallPartColor(app, 'jambage')}"/>` +
    `<rect x="${x}" y="${top[1]}" width="${JAMB_W}" height="${JAMB_CAP_H}" fill="${jambCapColor(app)}"/>`;
}

/** VITRE d'une croisée : verre FROID le jour (léger reflet en haut-gauche via `spec`), AMBRÉ ÉMISSIF la
 *  nuit (halo + scintillement, classes `glow`/`warm` — signal de
 *  bâtiment fort). Le poly = [hautA, hautB, basB, basA] projeté. */
function glassSvg(p: Pt2[], app: StructureAppearanceDef, tintK: number, night: boolean): string {
  const poly = polyPts(p);
  if (night) {
    const lit = windowLit(app);
    const cx = (p[0][0] + p[1][0] + p[2][0] + p[3][0]) / 4, cy = (p[0][1] + p[1][1] + p[2][1] + p[3][1]) / 4;
    const r = Math.hypot(p[1][0] - p[0][0], p[1][1] - p[0][1]) * 0.7 + 3;
    return `<circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="${r.toFixed(1)}" fill="${lit}" opacity="0.4" class="glow"/>` +
      `<polygon points="${poly}" fill="${lit}" class="warm"/>`;
  }
  const day = shade(wallPartColor(app, 'vitre'), tintK);
  const sheen = `<polygon points="${polyPts([p[0], mid(p[0], p[1]), mid(p[0], p[3])])}" fill="${spec(0.16)}"/>`; // reflet du coin haut-gauche
  return `<polygon points="${poly}" fill="${day}"/>` + sheen;
}

/** Une face du pivot en SVG. Quads = polygones remplis (+ liseré par partie) ; montants (2 points) =
 *  rects de largeur fixe ; moulure/barreau = leur LIGNE MÉDIANE (trait historique 1.3/1.7 px). Une
 *  partie MAÇONNÉE d'une def à recette reçoit PAR-DESSUS son motif d'appareillage partagé (LOD ≥ 1). */
function faceSvg(f: Face, el: WallEl, app: StructureAppearanceDef, tintK: number, dims: Dims, opts?: DetailOpts): string {
  const part = f.material.part as WallPart;
  const p = f.poly.map((gp) => projGP(gp, dims));
  if (part === 'poteau') return postSvg(p[0], p[1], app);
  if (part === 'jambage') return jambSvg(p[0], p[1], app);
  if (part === 'vitre') return glassSvg(p, app, tintK, !!opts?.night);
  if (part === 'moulure') return line(mid(p[0], p[3]), mid(p[1], p[2]), shade(wallPartColor(app, part), tintK), FRAME_W);
  if (part === 'barreau') return line(mid(p[2], p[3]), mid(p[0], p[1]), wallPartColor(app, part), BAR_W);
  const base = wallPartColor(app, part);
  const fill = TINTED.has(part) ? shade(base, tintK) : base;
  const extra = lisereAttr(wallPartOutline(app, part));
  let overlay = '';
  const { lod, mpt } = detailOf(opts);
  if (lod >= 1 && f.poly.length === 4 && app.detail?.courses && COURSED.has(part))
    overlay = coursesOverlaySvg({ recipe: app.detail, side: el.side, cell: el.cell, quad: p, dims, mpt });
  return `<polygon points="${polyPts(p)}" fill="${fill}"${extra}/>` + overlay;
}

/** PLANCHER ÉCRAN (px) d'un tronçon de la vue du dessus EN TRAVERS de l'arête (son cœur) — valeur UI
 *  révisable, calibrée par la garde navigateur `scripts/recette/plancher-trait.mjs`, qui l'importe. */
export const PLANCHER_DU_COEUR_PX = 3;
/** PLANCHER ÉCRAN (px) d'un tronçon LE LONG de l'arête (montant, barreau) — valeur UI révisable, bornée
 *  par le jour entre deux barreaux de herse au dézoom (garde `scripts/recette/plancher-trait.mjs`). */
export const PLANCHER_LE_LONG_PX = 2;
/** LISERÉ (px écran) du bord de chaque côté du cœur. */
export const LISERE_PX = 1;
/** Tirets du SURPLOMB : motif (trait, jour) en unités d'une arête longue de `arete`, calé sur son origine. */
const TIRETS_DU_SURPLOMB = { arete: 56, motif: '3 5' };

/** TRAIT de la vue du dessus : une classe de la coupe (`coupeDuMur`) le long de ses tronçons [t0, t1]
 *  de l'arête, projetés en [de, a]. `largeur` = épaisseur MONDE du cœur (unités de viewBox) ; les deux
 *  tons de `tonsDArete`, cœur et bord, à toute classe. */
export interface TraitDuDessus {
  classe: ClasseDeCoupe;
  troncons: readonly { t0: number; t1: number; de: Pt2; a: Pt2 }[];
  largeur: number;
  tons: { coeur: string; bord: string };
}

/** Union d'intervalles [t0, t1], triée. */
function unionDIntervalles(ivs: readonly (readonly [number, number])[]): [number, number][] {
  const out: [number, number][] = [];
  for (const [a, b] of [...ivs].sort((x, y) => x[0] - y[0])) {
    const der = out[out.length - 1];
    if (der && a <= der[1]) der[1] = Math.max(der[1], b);
    else out.push([a, b]);
  }
  return out;
}

/** SÉRIALISE une coupe en traits de la vue du dessus, dans l'ordre de peinture `sous` → `surplomb` →
 *  `coupe`, sur l'arête `ends` projetée ; épaisseurs (m) converties en viewBox par `mpt`. Le surplomb
 *  donne UN trait par COULEUR, union des tronçons de ses parts, à la plus forte épaisseur de celles-ci,
 *  dans l'ordre de première apparition. */
export function dessusDeLaCoupe(coupe: readonly TronconDeCoupe[], ends: readonly [GP, GP], dims: Dims, mpt: number): TraitDuDessus[] {
  const [a, b] = ends.map((gp) => projGP(gp, dims));
  const vbParM = Math.hypot(b[0] - a[0], b[1] - a[1]) / (Math.hypot(ends[1].x - ends[0].x, ends[1].y - ends[0].y) * mpt);
  const at = (t: number): Pt2 => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
  const troncon = (t0: number, t1: number) => ({ t0, t1, de: at(t0), a: at(t1) });
  const couleur = (e: TronconDeCoupe) => wallPartColor(structureAppearance(e.apparence), e.part);
  const seul = (e: TronconDeCoupe): TraitDuDessus =>
    ({ classe: e.classe, troncons: [troncon(e.t0, e.t1)], largeur: e.epaisseurM * vbParM, tons: tonsDArete(couleur(e)) });
  const parCouleur = new Map<string, TronconDeCoupe[]>();
  for (const e of coupe.filter((x) => x.classe === 'surplomb')) parCouleur.set(couleur(e), [...(parCouleur.get(couleur(e)) ?? []), e]);
  const surplomb = [...parCouleur].map(([c, es]): TraitDuDessus => ({
    classe: 'surplomb',
    troncons: unionDIntervalles(es.map((e) => [e.t0, e.t1] as const)).map(([t0, t1]) => troncon(t0, t1)),
    largeur: Math.max(...es.map((e) => e.epaisseurM)) * vbParM,
    tons: tonsDArete(c),
  }));
  return [...coupe.filter((e) => e.classe === 'sous').map(seul), ...surplomb, ...coupe.filter((e) => e.classe === 'coupe').map(seul)];
}

/** Vue du DESSUS d'un élément de mur : la sérialisation de la COUPE de ses faces
 *  (`coupeDuMur`, `HAUTEUR_DE_COUPE_M`). `mpt` = mètres par case de la scène. */
export function dessusDuMur(el: WallEl, dims: Dims, mpt: number): TraitDuDessus[] {
  return dessusDeLaCoupe(coupeDuMur(el.faces, el.ends, HAUTEUR_DE_COUPE_M, mpt), el.ends, dims, mpt);
}

/**
 * Vue du dessus d'une TUILE À BLOC PLEIN (#1176, P3-5b), sur l'arête `ends` de sa frontière : la MÊME
 * coupe que le mur sur arête, d'UNE face verticale de `hauteurM` m à l'apparence du mur nu.
 *
 * Un obstacle s'auteure de DEUX façons — un segment `WallSeg` sur une arête, ou une tuile de terrain à
 * `solidHeightM > 0` (le muret de couvert d'une scène à grille). En volume ce sont deux formes
 * distinctes et c'est juste ; en PLAN, ce sont le même fait — « on ne passe pas, on ne voit pas ».
 * Sans ce trait, un bloc plein vu du dessus rend sa face du dessus : une dalle pâle, lue comme du SOL.
 */
export function dessusDuBlocPlein(ends: readonly [GP, GP], hauteurM: number, dims: Dims, mpt: number): TraitDuDessus[] {
  const [A, B] = ends;
  const face: Face = {
    poly: [{ ...A, h: A.h + hauteurM }, { ...B, h: B.h + hauteurM }, B, A],
    material: { domain: 'structure', id: APPARENCE_MUR_NU, part: 'face' },
    oriented: false,
  };
  return dessusDeLaCoupe(coupeDuMur([face], ends, HAUTEUR_DE_COUPE_M, mpt), ends, dims, mpt);
}

/** SÉRIALISE une vue du dessus en SVG, dans l'ordre de ses traits : un trait peint son BORD puis son
 *  CŒUR, un chemin par tronçon. Chaque tronçon est le segment UNITÉ `M-0.5 0L0.5 0` posé en STYLE sur
 *  son milieu, tourné selon l'arête et étiré LE LONG d'elle à max(longueur monde, `PLANCHER_LE_LONG_PX`
 *  écran) ; la largeur EN TRAVERS, en style aussi : cœur = max(largeur monde, `PLANCHER_DU_COEUR_PX`
 *  écran), bord = cœur + `LISERE_PX` écran de chaque côté. Écran lu sur `var(ECHELLE_ECRAN)` du groupe
 *  porteur ; l'étirement n'agit que sur l'axe de l'arête, la largeur du trait n'en dépend pas.
 *  Écart au verdict de design c13 (bord = max(bord monde, cœur + 2 px / k, plancher / k)), déclaré :
 *  aucun bord MONDE n'existe en donnée (`TronconDeCoupe` ne porte que `epaisseurM`,
 *  `builders/walls.ts:coupeDuMur` ; `TraitDuDessus` que `largeur`), et le terme plancher / k est dominé,
 *  cœur ≥ `PLANCHER_DU_COEUR_PX` / k > `PLANCHER_LE_LONG_PX` / k.
 *  Le surplomb en tirets `butt` dont `pathLength` et `stroke-dashoffset` calent la phase sur l'origine
 *  de l'arête : même nombre de tirets à toute longueur d'arête, et deux tronçons ne se chevauchent pas. */
export function dessusSvg(traits: readonly TraitDuDessus[]): string {
  const k = `var(${ECHELLE_ECRAN})`;
  const peint = ({ classe, troncons, largeur, tons }: TraitDuDessus): string => {
    const coeur = `max(${largeur}, ${PLANCHER_DU_COEUR_PX} / ${k})`;
    const trace = (role: 'bord' | 'coeur', couleur: string, w: string) => troncons.map(({ t0, t1, de, a }) => {
      const tirets = classe === 'surplomb'
        ? ` pathLength="${(t1 - t0) * TIRETS_DU_SURPLOMB.arete}" stroke-dasharray="${TIRETS_DU_SURPLOMB.motif}" stroke-dashoffset="${t0 * TIRETS_DU_SURPLOMB.arete}"`
        : '';
      const pose = `translate(${(de[0] + a[0]) / 2}px, ${(de[1] + a[1]) / 2}px) rotate(${Math.atan2(a[1] - de[1], a[0] - de[0])}rad) ` +
        `scale(max(${Math.hypot(a[0] - de[0], a[1] - de[1])}, ${PLANCHER_LE_LONG_PX} / ${k}), 1)`;
      return `<path d="M-0.5 0L0.5 0" fill="none" stroke="${couleur}" stroke-linecap="butt"${tirets} class="mur-${classe} mur-${role}" style="transform:${pose};stroke-width:${w}"/>`;
    }).join('');
    return trace('bord', tons.bord, `calc(${coeur} + ${2 * LISERE_PX} / ${k})`) + trace('coeur', tons.coeur, coeur);
  };
  return `<g>${traits.map(peint).join('')}</g>`;
}

/** SVG d'un élément de mur : iso/edge-on = faces dans l'ORDRE DE PEINTURE du builder, ombrées par
 *  l'orientation MONDE de l'arête ; vue du dessus = sérialisation de sa coupe (`dessusDuMur`). COLOMBAGE (recette
 *  `timber`, LOD ≥ 1) : pans de bois PAR-DESSUS la façade assemblée (poteaux + écharpes devant le
 *  panneau) — jamais sur une travée de porte (l'ouverture couperait les écharpes) ni une brèche. */
export function wallSvg(el: WallEl, dims: Dims, opts?: DetailOpts): string {
  const app = structureAppearance(el.appearance);
  if (isSquareView(dims.view)) return dessusSvg(dessusDuMur(el, dims, detailOf(opts).mpt));
  const tintK = el.side === 'N' ? SIDE_N : SIDE_LIT;
  const renderFaces = (faces: Face[]) => faces.map((f) => {
    const faceApp = structureAppearance(f.material.id);
    const rendered = faceSvg(f, el, faceApp, tintK, dims, opts);
    return f.architectureFeatureId
      ? `<g data-architecture-feature="${f.architectureFeatureId}">${rendered}</g>`
      : rendered;
  }).join('');
  const physicalFaces = el.faces.filter((face) => !face.architectureFeatureId);
  const featureFaces = el.faces.filter((face) => face.architectureFeatureId);
  let svg = renderFaces(physicalFaces);
  const { lod, mpt } = detailOf(opts);
  if (lod >= 1 && app.detail?.timber && !estBaie(el.forme) && !el.states.down) {
    const f = physicalFaces.find((x) => x.material.part === 'face');
    if (f) {
      const [A, B] = el.ends;
      svg += timberOverlaySvg({
        recipe: app.detail,
        quad: f.poly.map((gp) => projGP(gp, dims)),
        faceWM: Math.hypot(B.x - A.x, B.y - A.y) * mpt,
        faceHM: f.poly[0].h - f.poly[3].h,
        dims,
      });
    }
  }
  svg += renderFaces(featureFaces);
  return `<g>${svg}</g>`;
}

/** UNE face de matière de MUR posée HORS d'un `WallEl` : la FERMETURE de comble d'une nappe (pignon,
 *  `builders/roofs.ts`). Elle PROLONGE un mur sans être un segment de scène, elle en porte donc la MÊME
 *  matière — appareillage ET colombage compris, sans quoi un pignon reste un aplat posé sur une façade
 *  à pans de bois. Son LISERÉ est celui de la face du mur (`wallPartOutline(app, 'face')`) : le pignon
 *  d'une apparence à `parapet` porte la bande du mur, unification voulue (#1883).
 *
 *  Les motifs se posent sur le QUAD ENGLOBANT en MONDE (l'emprise au sol de la face × sa plage de
 *  hauteur : un rectangle vertical, exactement ce qu'attendent `coursesOverlaySvg`/`timberOverlaySvg`)
 *  puis se CLIPPENT au polygone réel — un pignon triangulaire garde ainsi des poteaux d'aplomb et des
 *  écharpes à la bonne échelle, coupés net par les rampants, au lieu d'un motif déformé sur trois points. */
export function structureFaceSvg(f: Face, keyTag: string, cell: { x: number; y: number; z: number }, dims: Dims, opts?: DetailOpts): string {
  const pts = f.poly.map((gp) => projGP(gp, dims));
  if (pts.length < 3) return '';
  const app = structureAppearance(f.material.id);
  const side: WallSide = f.side === 'N' || f.side === 'S' ? 'N' : 'E';
  const tintK = side === 'N' ? SIDE_N : SIDE_LIT;
  const body = `<polygon points="${polyPts(pts)}" fill="${shade(wallPartColor(app, 'face'), tintK)}"${lisereAttr(wallPartOutline(app, 'face'))}/>`;
  const { lod, mpt } = detailOf(opts);
  if (lod < 1 || !app.detail || isSquareView(dims.view)) return body;
  const hLo = Math.min(...f.poly.map((p) => p.h));
  const hHi = Math.max(...f.poly.map((p) => p.h));
  if (hHi - hLo < 1e-9) return body;
  // Extrémités de l'emprise AU SOL (la face est verticale : tous ses points partagent une droite xy).
  let a = f.poly[0], b = f.poly[0], span = -1;
  for (const p of f.poly)
    for (const q of f.poly) {
      const d = Math.hypot(q.x - p.x, q.y - p.y);
      if (d > span) { span = d; a = p; b = q; }
    }
  if (span <= 0) return body;
  const at = (p: GP, h: number) => projGP({ x: p.x, y: p.y, h }, dims);
  const quad = [at(a, hHi), at(b, hHi), at(b, hLo), at(a, hLo)];
  let overlay = '';
  if (app.detail.courses) overlay += coursesOverlaySvg({ recipe: app.detail, side, cell, quad, dims, mpt });
  if (app.detail.timber) overlay += timberOverlaySvg({ recipe: app.detail, quad, faceWM: span * mpt, faceHM: hHi - hLo, dims });
  if (!overlay) return body;
  const clip = `sfc-${projTag(dims)}-${keyTag.replace(/[^a-zA-Z0-9_-]/g, '-')}`;
  return `${body}<clipPath id="${clip}"><polygon points="${polyPts(pts)}"/></clipPath><g clip-path="url(#${clip})">${overlay}</g>`;
}

/** COUCHE D'ACCENTS d'un mur (LOD 2) : blocs nuancés ALIGNÉS sur l'appareillage + mouchetis d'usure de
 *  la GRANDE face (part `face`), aux tons du fill teinté. SÉPARÉE de `wallSvg` : le stage ne l'étend
 *  qu'APRÈS le culling écran (jamais dans le memo pleine-carte), et la met en cache par élément. */
export function wallAccentsSvg(el: WallEl, dims: Dims, opts?: DetailOpts): string {
  const { lod, mpt } = detailOf(opts);
  if (lod < 2 || isSquareView(dims.view) || el.states.down) return '';
  const tintK = el.side === 'N' ? SIDE_N : SIDE_LIT;
  const hasFeatureFaces = el.faces.some((face) => face.architectureFeatureId);
  // Les FERRURES (bandes de fortification) se posent PAR-DESSUS la maçonnerie : leurs intervalles
  // (mètres depuis le HAUT de la face) sont réservés — un accent s'arrête à la ferrure, ne la couvre pas.
  let svg = '';
  for (const f of el.faces) {
    if (f.material.part !== 'face' || f.poly.length !== 4) continue;
    if (hasFeatureFaces && !f.architectureFeatureId) continue;
    const app = structureAppearance(f.material.id);
    if (!app.detail) continue;
    const thick = isoPxToM(app.parapet?.bandThickPx ?? 0);
    const reservedV = (app.parapet?.bands ?? []).map((t): [number, number] => [WALL_H_M * (1 - t) - thick, WALL_H_M * (1 - t)]);
    const quad = f.poly.map((gp) => projGP(gp, dims));
    const faceWM = Math.hypot(f.poly[1].x - f.poly[0].x, f.poly[1].y - f.poly[0].y) * mpt;
    const faceHM = f.poly[0].h - f.poly[3].h;
    svg += verticalAccentsSvg({
      recipe: app.detail,
      side: el.side,
      cell: el.cell,
      quad,
      faceWM,
      faceHM,
      base: shade(wallPartColor(app, 'face'), tintK),
      seed: hash32('wall', el.cell.x, el.cell.y, el.cell.z, el.side),
      dims,
      mpt,
      reservedV,
    });
    // COLOMBAGE re-tracé PAR-DESSUS les nuances de planches : cette couche se peint APRÈS `wallSvg`,
    // une planche nuancée recouvrirait sinon les pans de bois (le colombage vit DEVANT le bardage).
    if (svg && app.detail.timber && !estBaie(el.forme)) svg += timberOverlaySvg({ recipe: app.detail, quad, faceWM, faceHM, dims });
  }
  return svg;
}
