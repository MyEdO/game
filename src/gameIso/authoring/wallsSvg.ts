/**
 * PEINTRE SVG D'AUTHORING des murs (frontière du module : `authoring/project.ts`) — iso losange ·
 * edge-on · vue du dessus : dessine un élément `wall`
 * du pivot en SVG, en projetant ses faces GRILLE+MÈTRES via le pont partagé (`projGP`). La ROTATION
 * caméra vit ici ; l'OMBRAGE d'orientation (arête N dans l'ombre) et les traits/liserés (dérivés de la
 * couleur de face via `shade.ts`) aussi. Les couleurs de base viennent de la def JSON par `wallPartColor`
 * (source unique avec le POV). La vue du DESSUS ('top') est la représentation SYMBOLIQUE historique
 * (traits épais / glyphe de porte), routée par `isSquareView` — elle se trace sur `el.ends`, pas les faces,
 * en DONNÉE (`dessusDuMur`) que `dessusSvg` sérialise.
 */
import { CELL, depth, diamondPath, isSquareView, tileCenter, type Dims } from '../../geometry/iso';
import { WALL_H_M, isoPxToM } from '../iso';
import { metricToLift } from '../../state/relief';
import { APPARENCE_MUR_NU } from '../../state/formeArete';
import { estBaie, estBaieFermee, habilleUneBaie } from '../../data/formesDArete';
import { structureAppearance, wallPartColor, windowLit, type StructureAppearanceDef, type WallPart } from '../catalog/structures';
import { shade, spec, tonsDArete, SIDE_N, SIDE_LIT, POST_CAP, POST_BASE } from '../shade';
import { detailOf, coursesOverlaySvg, timberOverlaySvg, verticalAccentsSvg, projTag, type DetailOpts } from './detailSvg';
import { hash32 } from '../../data/hash';
import type { Face, GP, WallEl } from '../builders/types';
import type { WallSide } from '../../state/scene';
import { projGP, type Pt2 } from './project';

// Facteurs d'ombrage et épaisseurs ÉCRAN (px) des ornements — des formes, jamais des identités de couleur.
const OUTLINE = 0.4; // liseré d'arête sombre dérivé de la face
const JAMBCAP = 1.25; // chapiteau de jambage clair (repli sans couleur de def)
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
 *  4 rotations ; vue du dessus symbolique : +0.6 (au-dessus des overlays de sol), comme l'historique. */
export function wallDepth(el: WallEl, dims: Dims): number {
  const { x, y, z } = el.cell;
  const cells: [number, number][] = el.side === 'E' ? [[x, y], [x + 1, y]] : el.side === 'N' ? [[x, y], [x, y - 1]] : [[x, y]];
  return Math.max(...cells.map(([cx, cy]) => depth(cx, cy, dims, z))) + 0.45 + (isSquareView(dims.view) ? 0.6 : 0);
}

const polyPts = (pts: Pt2[]) => pts.map((p) => `${p[0]},${p[1]}`).join(' ');
const mid = (a: Pt2, b: Pt2): Pt2 => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
const line = (a: Pt2, b: Pt2, color: string, w: number) =>
  `<line x1="${a[0]}" y1="${a[1]}" x2="${b[0]}" y2="${b[1]}" stroke="${color}" stroke-width="${w}"/>`;
const strokeAttr = (color: string, w: number) => ` stroke="${color}" stroke-width="${w}"`;

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
    `<rect x="${x}" y="${top[1]}" width="${JAMB_W}" height="${JAMB_CAP_H}" fill="${app.door?.jambCap ?? shade(app.face, JAMBCAP)}"/>`;
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
  let extra = '';
  if (part === 'face') extra = app.parapet ? strokeAttr(app.band ?? app.face, 0.8) : strokeAttr(shade(app.face, OUTLINE), 0.7);
  else if (part === 'parapet' || part === 'linteau') extra = strokeAttr(app.band ?? app.face, 0.8);
  else if (part === 'chambranle') extra = strokeAttr(shade(app.face, OUTLINE), 0.5);
  else if (part === 'gravats-tas') extra = strokeAttr(app.band ?? shade(app.face, OUTLINE), 0.6);
  let overlay = '';
  const { lod, mpt } = detailOf(opts);
  if (lod >= 1 && f.poly.length === 4 && app.detail?.courses && COURSED.has(part))
    overlay = coursesOverlaySvg({ recipe: app.detail, side: el.side, cell: el.cell, quad: p, dims, mpt });
  return `<polygon points="${polyPts(p)}" fill="${fill}"${extra}/>` + overlay;
}

/** Largeur ÉCRAN (px) minimale du liseré de BORD visible de chaque côté du cœur, (bord − cœur) / 2 : sur
 *  un fond proche du cœur, seul ce liseré porte le contraste. */
export const LISERE_VISIBLE_MIN = 1;

/** Largeurs ÉCRAN (px) [bord, cœur] des traits d'arête de la vue du dessus — la FORME se lit à la largeur,
 *  aux tirets et au glyphe. Chacune laisse `LISERE_VISIBLE_MIN` de liseré de part et d'autre. `dessusSvg`
 *  les trace en `non-scaling-stroke` : elles valent ces pixels à toute échelle du groupe qui porte le
 *  trait (caméra du jeu, `stage/stageCam` ; `meet` du plan de station, `TopoScene`). */
export const TRAITS_D_ARETE = {
  mur: [8, 5],
  courtine: [11, 7],
  breche: [6, 3.5],
  jambage: [7, 4],
  baie: [4, 2],
  barreau: [3, 1],
  case: [3.5, 1.5],
} as const satisfies Record<string, readonly [number, number]>;
const TIRETS_BRECHE = '3 5';

/** TRAIT D'ARÊTE de la vue du dessus : la PART de mur `part` vue d'en haut, un BORD de largeur `larg[0]`
 *  puis un CŒUR de largeur `larg[1]`, aux deux tons de `tonsDArete(wallPartColor(app, part))` — le cœur
 *  est la couleur que le volume donne à cette part. Le long d'un SEGMENT p→q, ou le pourtour d'un CHEMIN
 *  fermé `d` rempli de `fond`. `dash` : tirets de la brèche. */
export interface TraitDuDessus {
  quoi: 'trait';
  part: WallPart;
  geo: { p: Pt2; q: Pt2 } | { d: string; fond: string };
  larg: readonly [number, number];
  tons: { coeur: string; bord: string };
  dash?: string;
}
/** APLAT de la vue du dessus : le renfoncement du corps de garde. */
interface AplatDuDessus {
  quoi: 'aplat';
  x: number;
  y: number;
  w: number;
  h: number;
  fond: string;
}
/** Un élément de la vue du dessus, dans l'ORDRE DE PEINTURE. */
export type ElementDuDessus = TraitDuDessus | AplatDuDessus;

const trait = (geo: TraitDuDessus['geo'], larg: readonly [number, number], app: StructureAppearanceDef, part: WallPart, dash?: string): TraitDuDessus =>
  ({ quoi: 'trait', part, geo, larg, tons: tonsDArete(wallPartColor(app, part)), ...(dash ? { dash } : {}) });

/** Vue du DESSUS symbolique d'un élément de mur, en DONNÉE : chaque trait est une part que `wallFaces`
 *  (`builders/walls.ts`) dessine sur la même arête — face du mur ou de la courtine, barreaux d'une
 *  claire-voie, gravats de la brèche (seuil d'un corps de garde abattu), jambages d'une porte et, sous
 *  eux, le vantail ou les barreaux d'une baie FERMÉE ; le corps de garde = case pleine au linteau + glyphe
 *  de herse. Seule la porte ouverte laisse le vide. `dessusSvg` la sérialise. */
export function dessusDuMur(el: WallEl, dims: Dims): ElementDuDessus[] {
  const app = structureAppearance(el.appearance);
  const [a, b] = el.ends.map((gp) => projGP(gp, dims));
  const lerp = (t: number): Pt2 => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
  const breche = (part: WallPart) => [trait({ p: a, q: b }, TRAITS_D_ARETE.breche, app, part, TIRETS_BRECHE)];
  if (app.parapet) {
    if (habilleUneBaie(app) && estBaie(el.forme)) {
      if (el.states.down) return breche('seuil');
      const lift = metricToLift(el.ends[0].h);
      const { cx, cy } = tileCenter(el.cell.x, el.cell.y, dims, lift);
      const h = CELL / 2;
      const glyphe: ElementDuDessus[] = [
        trait({ d: diamondPath(el.cell.x, el.cell.y, dims, lift), fond: wallPartColor(app, 'linteau') }, TRAITS_D_ARETE.case, app, 'linteau'),
        { quoi: 'aplat', x: cx - h * 0.46, y: cy - h, w: h * 0.92, h: 2 * h, fond: app.recess ?? app.face },
      ];
      const bars = estBaieFermee(el.forme) ? app.claireVoie?.bars ?? 0 : 0;
      for (let i = 1; i < bars; i++) {
        const ly = cy - h + 2 * h * (i / bars);
        glyphe.push(trait({ p: [cx - h * 0.46, ly], q: [cx + h * 0.46, ly] }, TRAITS_D_ARETE.barreau, app, 'barreau'));
      }
      return glyphe;
    }
    if (el.states.down) return breche('gravats');
    return [trait({ p: a, q: b }, TRAITS_D_ARETE.courtine, app, 'face')];
  }
  if (el.states.down) return breche('gravats');
  if (estBaie(el.forme)) {
    const bouchee = estBaieFermee(el.forme)
      ? [trait({ p: lerp(0.3), q: lerp(0.7) }, TRAITS_D_ARETE.baie, app, app.claireVoie ? 'barreau' : 'vantail')]
      : [];
    return [...bouchee, trait({ p: a, q: lerp(0.3) }, TRAITS_D_ARETE.jambage, app, 'jambage'), trait({ p: lerp(0.7), q: b }, TRAITS_D_ARETE.jambage, app, 'jambage')];
  }
  return [trait({ p: a, q: b }, TRAITS_D_ARETE.mur, app, el.forme !== 'mur-fenetre' && app.claireVoie ? 'barreau' : 'face')];
}

/**
 * TRAIT de FRONTIÈRE d'une TUILE À BLOC PLEIN en vue du dessus (#1176, P3-5b) : le MÊME trait
 * symbolique que le mur sur arête (`TraitDuDessus`), posé sur une arête de case.
 *
 * Un obstacle s'auteure de DEUX façons — un segment `WallSeg` sur une arête, ou une tuile de terrain à
 * `solidHeightM > 0` (le muret de couvert d'une scène à grille). En volume ce sont deux formes
 * distinctes et c'est juste ; en PLAN, ce sont le même fait — « on ne passe pas, on ne voit pas » — et
 * ils doivent donc se lire pareil. Sans ce trait, un bloc plein vu du dessus rend sa face du dessus :
 * une dalle pâle, lue comme du SOL.
 */
export function dessusDuBlocPlein(a: Pt2, b: Pt2): ElementDuDessus[] {
  return [trait({ p: a, q: b }, TRAITS_D_ARETE.mur, structureAppearance(APPARENCE_MUR_NU), 'face')];
}

/** Épaisseur de trait en pixels d'ÉCRAN, hors de l'échelle du groupe porteur — la convention des traits
 *  de carte du dépôt (`ui/WorldMapView.tsx`, routes). */
const TRAIT_ECRAN = ' vector-effect="non-scaling-stroke"';

/** SÉRIALISE une vue du dessus en SVG, dans l'ordre de ses éléments : un trait peint son BORD puis son
 *  CŒUR par-dessus, chacun à sa largeur ÉCRAN (`TRAIT_ECRAN`). */
export function dessusSvg(elements: readonly ElementDuDessus[]): string {
  const peint = (e: ElementDuDessus): string => {
    if (e.quoi === 'aplat') return `<rect x="${e.x}" y="${e.y}" width="${e.w}" height="${e.h}" fill="${e.fond}"/>`;
    const { geo, larg, tons, dash } = e;
    if ('d' in geo)
      return `<path d="${geo.d}" fill="${geo.fond}" stroke="${tons.bord}" stroke-width="${larg[0]}"${TRAIT_ECRAN}/>` +
        `<path d="${geo.d}" fill="none" stroke="${tons.coeur}" stroke-width="${larg[1]}"${TRAIT_ECRAN}/>`;
    const ligne = (w: number, col: string) =>
      `<line x1="${geo.p[0]}" y1="${geo.p[1]}" x2="${geo.q[0]}" y2="${geo.q[1]}" stroke="${col}" stroke-width="${w}" stroke-linecap="round"${dash ? ` stroke-dasharray="${dash}"` : ''}${TRAIT_ECRAN}/>`;
    return ligne(larg[0], tons.bord) + ligne(larg[1], tons.coeur);
  };
  return `<g>${elements.map(peint).join('')}</g>`;
}

/** SVG d'un élément de mur : iso/edge-on = faces dans l'ORDRE DE PEINTURE du builder, ombrées par
 *  l'orientation MONDE de l'arête ; vue du dessus = représentation symbolique. COLOMBAGE (recette
 *  `timber`, LOD ≥ 1) : pans de bois PAR-DESSUS la façade assemblée (poteaux + écharpes devant le
 *  panneau) — jamais sur une travée de porte (l'ouverture couperait les écharpes) ni une brèche. */
export function wallSvg(el: WallEl, dims: Dims, opts?: DetailOpts): string {
  const app = structureAppearance(el.appearance);
  if (isSquareView(dims.view)) return dessusSvg(dessusDuMur(el, dims));
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
 *  à pans de bois.
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
  const body = `<polygon points="${polyPts(pts)}" fill="${shade(wallPartColor(app, 'face'), tintK)}"${strokeAttr(shade(app.face, OUTLINE), 0.7)}/>`;
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
