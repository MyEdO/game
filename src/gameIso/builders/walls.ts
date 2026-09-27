/**
 * BUILDER de MURS — produit les éléments `wall` du pivot (cf. ./types) : pour chaque `WallSeg` de la
 * scène, les FACES MONDE (GP : grille + MÈTRES) de son assemblage — courtine/panneau de face, plinthe/
 * bandes/arase, parapet + merlons, montants d'extrémité, ouverture/linteau de porte, barreaux +
 * traverses de claire-voie, tas de gravats d'une structure ABATTUE — et les VÉRITÉS DE SCÈNE (visible/down/
 * open). TOUT vient des CHAMPS de l'apparence d'arête partagée (`apparenceDeLArete`, def JSON iso+POV) : parapet/porte/
 * bois routés par la PRÉSENCE des champs, jamais par un id/type en dur. PUR et projection-agnostique :
 * SOURCE UNIQUE de l'assemblage pour les DEUX backends (iso et POV) — ils dessinent ces mêmes faces,
 * chacun à sa résolution.
 */
import { heightAt, tileAt, doorIsOpen, structureIsDown, crenellatedAt, isCrenellated, isWalkable, structureAt, edgeOf, type Scene, type WallSeg, type WallSide } from '../../state/scene';
import { apparenceDeLArete, formeRendue, estBaie } from '../../state/formeArete';
import { interiorCells } from '../../state/planDefects';
import { memoByRef } from '../../state/sceneMemo';
import { estAbsent } from '../../state/terrain';
import { viewedBuilder, type Viewed } from './viewTruth';
import { effectiveArchitecture } from '../../state/sceneEdit';
import { structureAppearance, type StructureAppearanceDef, type WallPart } from '../catalog/structures';
import { facadeWallFeatureAppearance } from '../catalog/facades';
import { MISSING_ID } from '../catalog/missing';
import { KINDS_DE_DECOR } from '../../data/facadePresets';
import { WALL_H_M, isoPxToM } from '../iso';
import { METRES_PER_LEVEL, gradeBetween } from '../../state/relief';
import { DIR4_ORDER, type Dir4 } from '../../state/dir8';
import type { Face, GP, WallEl } from './types';
import type { FloorView } from './floors';
import {
  closureAppearance, fieldHeightAt, massFootprintCells, massSpaceCells, nappeKey, resolveNappes,
  WALL_NB, type RoofField,
} from './roofs';
import { facadeDeLArete, type FacadeEdge } from '../../state/facadeEdges';
import { cleArete } from '../../geometry/arete';

// ── Constantes de FORME (fractions de WALL_H / de l'arête, épaisseurs px-iso converties en mètres) ──
/** Ouverture d'une baie dont l'apparence ne déclare pas de bloc `door` : arête que `validateScene` refuse
 *  (`formesAdmises`), ou apparence absente du catalogue (repli visible `catalog/missing.ts`). */
const DOOR_FRAC = 0.52;
/** Panneau bois encastré : tronçon [T0,T1] de l'arête × [LO,HI] de la hauteur ; moulure au sommet. */
const PANEL_T0 = 0.2, PANEL_T1 = 0.8, PANEL_LO = 0.2, PANEL_HI = 0.78;
const SKIRT_FRAC = 0.11; // plinthe
const CAP_FRAC = 0.86; // couronnement (bande haute)
const CAP_LIP_PX = 4; // lèvre du couronnement, DÉBORDANTE au-dessus du sommet (cf. `capped` de `wallFaces`)
const FRAME_PX = 1.3; // épaisseur de la moulure (trait historique)
const CHAMBRANLE_PX = 4; // linteau de porte bois
// VANTAIL d'une porte FERMÉE : panneau bois entre les jambages [LEAF_T0,LEAF_T1], 3 joints de planches
// verticaux (demi-largeur PLANK_HALF_T) et une poignée [HANDLE_T0,HANDLE_T1] à mi-hauteur.
const LEAF_T0 = 0.16, LEAF_T1 = 0.84, PLANK_HALF_T = 0.012;
const PLANK_TS = [0.34, 0.5, 0.66]; // positions des joints de planches (fraction d'arête)
const HANDLE_T0 = 0.74, HANDLE_T1 = 0.8, HANDLE_LO = 0.42, HANDLE_HI = 0.56; // poignée
// FENÊTRE (croisée) = vraie OUVERTURE dans la face : carreau AJOURÉ [WIN_T0,WIN_T1]×[WIN_LO,WIN_HI]
// (fraction d'arête × de WALL_H), encadré par les morceaux de `face`, meneau + traverse (demi-tailles).
const WIN_T0 = 0.3, WIN_T1 = 0.7, WIN_LO = 0.42, WIN_HI = 0.8;
const MULLION_HALF_T = 0.02, MULLION_HALF_PX = 2;
const TRAVERSE_PX = 2; // traverse d'une claire-voie
/** Demi-largeur d'un BARREAU de claire-voie (fraction d'arête) — l'affine retrace la ligne médiane (1.7 px). */
const BAR_HALF_T = 0.02;
/** Seuil d'éboulis d'un corps de garde ABATTU (fraction de WALL_H). */
const GATE_SILL_FRAC = 0.12;
/** Forme de BRÈCHE — UNE paramétrisation bois+pierre (les deux matières tiennent dans le même jeu de
 *  fractions, bois 0.3/0.36/0.64/0.5 ≈ pierre, écart ≤ ~1 px) : hauteur du tas + dentelure +
 *  moignons de poteau. */
const BREACH_H = 0.32, BREACH_M1 = 0.34, BREACH_M2 = 0.62, BREACH_POST_A = 0.7, BREACH_POST_B = 0.55;
/** Tolérance de comparaison de hauteurs (m) — sauts de toiture réputés coplanaires en-deçà (`roofSeamGeometry`). */
const EPS = 1e-9;

type GXY = { x: number; y: number };

/** Extrémités A,B (coins de GRILLE, ±0.5) de l'arête d'un segment — l'aiguillage UNIQUE N/E/`\`/`/`
 *  (SOURCE UNIQUE des extrémités d'arête pour l'iso comme pour le POV).
 *  Cardinales = les MÊMES coins que `tileEdge` (iso.ts) → un backend affine qui projette ces points
 *  retombe sur la géométrie d'arête historique ; le POV les multiplie par `mpt`. */
export function wallEnds(w: Pick<WallSeg, 'x' | 'y' | 'side'>): [GXY, GXY] {
  const { x, y } = w;
  switch (w.side) {
    case 'N': return [{ x: x - 0.5, y: y - 0.5 }, { x: x + 0.5, y: y - 0.5 }];
    case 'E': return [{ x: x + 0.5, y: y - 0.5 }, { x: x + 0.5, y: y + 0.5 }];
    case '\\': return [{ x: x - 0.5, y: y - 0.5 }, { x: x + 0.5, y: y + 0.5 }];
    default: return [{ x: x + 0.5, y: y - 0.5 }, { x: x - 0.5, y: y + 0.5 }]; // '/'
  }
}

/** COURONNE crénelée (parapet dressé + ferrure + arase + merlons) posée à partir de la hauteur `baseH`,
 *  le long de l'arête A→B. SOURCE UNIQUE : (a) le sommet d'une fortification `wallFaces` (baseH = haut de
 *  la face pleine) ET (b) la crête de PÉRIMÈTRE d'une zone rempart (baseH = surface de la zone). Merlons =
 *  1 tronçon / `merlonStep` (fraction 0..1 de CETTE arête → motif périodique par case). */
export function crownFaces(app: StructureAppearanceDef, A: GXY, B: GXY, baseH: number): Face[] {
  const par = app.parapet;
  if (!par) return [];
  const at = (t: number): GXY => ({ x: A.x + (B.x - A.x) * t, y: A.y + (B.y - A.y) * t });
  const mat = (part: WallPart) => ({ domain: 'structure' as const, id: app.id, part });
  const span = (part: WallPart, t0: number, t1: number, hLo: number, hHi: number): Face => {
    const P0 = at(t0), P1 = at(t1);
    return { poly: [{ ...P0, h: hHi }, { ...P1, h: hHi }, { ...P1, h: hLo }, { ...P0, h: hLo }], material: mat(part), oriented: false };
  };
  const slab = (part: WallPart, hLo: number, hHi: number): Face => span(part, 0, 1, hLo, hHi);
  const P = par.heightLevelFrac * METRES_PER_LEVEL; // hauteur dressée du parapet (LEVEL_H·frac px ⇔ m)
  const bandLo = baseH + P * par.parapetBandFrac;
  const crest: Face[] = [
    slab('parapet', baseH, baseH + P),
    slab('bande', bandLo, bandLo + isoPxToM(par.bandThickPx)),
    slab('arase', baseH + P - isoPxToM(par.arasePx), baseH + P),
  ];
  for (let i = 0; i < par.merlonCount; i += par.merlonStep)
    crest.push(span('merlon', i / par.merlonCount, (i + 1) / par.merlonCount, baseH + P, baseH + P + isoPxToM(par.merlonHeightPx)));
  return crest;
}

/** Faces d'un segment, dans l'ORDRE DE PEINTURE (montant A, fond → détail, montant B). Hauteurs en
 *  MÈTRES depuis `b` (surface porteuse). `wallHeightM` = hauteur de la face PLEINE (défaut `WALL_H_M` =
 *  `METRES_PER_LEVEL` = 4 m depuis l'unification `WALL_H = LEVEL_H` — un mur atteint le plafond ; une
 *  PORTE/courtine de rempart passe le DROP de sa zone pour monter jusqu'au chemin de ronde). Les hauteurs
 *  px des defs passent par `isoPxToM` (une seule vérité px⇔m). Un montant (poteau/jambage) = 2 points
 *  [haut, bas] — le backend lui donne sa largeur. `capped` = un ÉTAGE repose sur ce mur (`storeyAbove`) :
 *  la lèvre débordante du couronnement est alors omise, elle percerait le plancher du dessus. */
function wallFaces(seg: WallSeg, app: StructureAppearanceDef, b: number, down: boolean, wallHeightM = WALL_H_M, open = false, capped = false): Face[] {
  const [A, B] = wallEnds(seg);
  const at = (t: number): GXY => ({ x: A.x + (B.x - A.x) * t, y: A.y + (B.y - A.y) * t });
  const mat = (part: WallPart) => ({ domain: 'structure' as const, id: app.id, part });
  /** Quad vertical [A@haut, B@haut, B@bas, A@bas] sur le tronçon [t0,t1] de l'arête. */
  const span = (part: WallPart, t0: number, t1: number, hLo: number, hHi: number): Face => {
    const P0 = at(t0), P1 = at(t1);
    return { poly: [{ ...P0, h: hHi }, { ...P1, h: hHi }, { ...P1, h: hLo }, { ...P0, h: hLo }], material: mat(part), oriented: false };
  };
  const slab = (part: WallPart, hLo: number, hHi: number): Face => span(part, 0, 1, hLo, hHi);
  const upright = (part: WallPart, t: number, hLo: number, hHi: number): Face => {
    const P = at(t);
    return { poly: [{ ...P, h: hHi }, { ...P, h: hLo }], material: mat(part), oriented: false };
  };
  /** BRÈCHE (structure abattue) : tas de gravats dentelé laissant le passage + moignons de poteau. */
  const breach = (): Face[] => {
    const hr = wallHeightM * BREACH_H;
    const heap: Face = {
      poly: [{ ...A, h: b }, { ...at(BREACH_M1), h: b + hr }, { ...at(BREACH_M2), h: b + hr * 0.7 }, { ...B, h: b }],
      material: mat('gravats-tas'),
      oriented: false,
    };
    return [slab('gravats', b, b + hr * 0.5), heap, upright('poteau', 0, b, b + hr * BREACH_POST_A), upright('poteau', 1, b, b + hr * BREACH_POST_B)];
  };

  const H1 = b + wallHeightM; // sommet de la face pleine
  const forme = formeRendue(seg, open);
  /** CLAIRE-VOIE (`app.claireVoie`) : barreaux + traverses, SOURCE UNIQUE des deux branches. */
  const claireVoie = (): Face[] => {
    const cv = app.claireVoie;
    if (!cv) return [];
    const lo = b + wallHeightM * cv.bottomFrac, hi = b + wallHeightM * cv.topFrac;
    const out: Face[] = [];
    for (let k = 0; k <= cv.bars; k++) {
      const t = k / cv.bars;
      out.push(span('barreau', Math.max(0, t - BAR_HALF_T), Math.min(1, t + BAR_HALF_T), lo, hi));
    }
    for (const f of cv.traverseFracs) out.push(slab('traverse', lo + (hi - lo) * f, lo + (hi - lo) * f + isoPxToM(TRAVERSE_PX)));
    return out;
  };

  if (app.parapet) {
    // FORTIFICATION de pierre : courtine ferrée + couronne crénelée (parapet + ferrure + arase + merlons).
    const par = app.parapet;
    const P = par.heightLevelFrac * METRES_PER_LEVEL; // hauteur dressée du parapet (poteaux montant à H1+P)
    const crest = crownFaces(app, A, B, H1);

    if (app.corpsDeGarde && estBaie(forme)) {
      // CORPS DE GARDE : passage béant barré de sa claire-voie (fermé), libre (ouvert) ou seuil d'éboulis
      // (abattu) + linteau.
      const passage = down ? [slab('seuil', b, b + wallHeightM * GATE_SILL_FRAC)] : forme === 'porte-ouverte' ? [] : claireVoie();
      return [...passage, slab('linteau', H1 - isoPxToM(app.corpsDeGarde.lintelPx), H1), ...crest];
    }
    if (down) return breach();
    return [
      upright('poteau', 0, b, H1 + P),
      slab('face', b, H1),
      ...par.bands.map((t) => slab('bande', b + wallHeightM * t, b + wallHeightM * t + isoPxToM(par.bandThickPx))),
      ...crest,
      upright('poteau', 1, b, H1 + P),
    ];
  }

  // MUR ORDINAIRE (bois) : panneau encadré + moulures + plinthe, ou porte ajourée (routée par la FORME).
  if (down) return breach();
  if (estBaie(forme)) {
    const op = wallHeightM * (app.door?.openingFrac ?? DOOR_FRAC);
    // OUVERTE → l'ouverture est un TROU : AUCUNE face ne la remplit (jambages et chambranle la bordent
    // déjà, et les joues du mur se voient de part et d'autre) — on voit la pièce derrière, comme par une
    // porte ouverte. FERMÉE → sa CLAIRE-VOIE quand l'apparence en porte une (herse), sinon le VANTAIL
    // (panneau + planches + poignée) : la porte se LIT comme une porte. Une fermeture fixe ne s'ouvre pas :
    // son vantail n'a pas de poignée.
    const leaf: Face[] = forme === 'porte-ouverte'
      ? []
      : app.claireVoie ? claireVoie() : [
          span('vantail', LEAF_T0, LEAF_T1, b, b + op),
          ...PLANK_TS.map((t) => span('vantail-planche', t - PLANK_HALF_T, t + PLANK_HALF_T, b, b + op)),
          ...(forme === 'fermeture-fixe' ? [] : [span('poignee', HANDLE_T0, HANDLE_T1, b + op * HANDLE_LO, b + op * HANDLE_HI)]),
        ];
    return [
      upright('poteau', 0, b, H1),
      ...leaf,
      slab('face', b + op, H1),
      slab('chambranle', b + op, b + op + isoPxToM(CHAMBRANLE_PX)),
      slab('couronnement', b + wallHeightM * CAP_FRAC, H1),
      upright('jambage', 0, b, b + op),
      upright('jambage', 1, b, b + op),
      upright('poteau', 1, b, H1),
    ];
  }
  if (forme === 'mur-fenetre') {
    // FENÊTRE : vraie OUVERTURE — le mur est un CADRE de `face` (trumeau bas + linteau haut + 2 jambages)
    // autour du vide vitré, et la vitre est TRANSPARENTE → on VOIT l'intérieur derrière (le mur reste
    // opaque à la MÉCANIQUE — vision/passage inchangés). Croisée : cadre → vitre → meneau + traverse.
    const winLo = b + wallHeightM * WIN_LO, winHi = b + wallHeightM * WIN_HI;
    const midT = (WIN_T0 + WIN_T1) / 2, midV = (winLo + winHi) / 2;
    const mpx = isoPxToM(MULLION_HALF_PX);
    return [
      upright('poteau', 0, b, H1),
      slab('face', b, winLo), // trumeau sous la fenêtre
      slab('face', winHi, H1), // linteau au-dessus
      span('face', 0, WIN_T0, winLo, winHi), // jambage gauche
      span('face', WIN_T1, 1, winLo, winHi), // jambage droit
      // Le carreau reste AJOURÉ : jambages, trumeau et linteau l'encadrent déjà ; la croisée n'est que
      // meneau + traverse posés PAR-DESSUS le vide vitré, jamais un panneau plein derrière la vitre.
      span('vitre', WIN_T0, WIN_T1, winLo, winHi),
      span('meneau', midT - MULLION_HALF_T, midT + MULLION_HALF_T, winLo, winHi), // meneau vertical
      span('meneau', WIN_T0, WIN_T1, midV - mpx, midV + mpx), // traverse horizontale
      slab('plinthe', b, b + wallHeightM * SKIRT_FRAC),
      slab('couronnement', b + wallHeightM * CAP_FRAC, H1),
      ...(capped ? [] : [slab('couronnement', H1, H1 + isoPxToM(CAP_LIP_PX))]),
      upright('poteau', 1, b, H1),
    ];
  }
  if (app.claireVoie) {
    // CLAIRE-VOIE sans porte : barreaux entre deux poteaux, AUCUNE face pleine — l'arête se voit au
    // travers. Plinthe et main courante (`couronnement`) seulement si l'APPARENCE les porte.
    const cv = app.claireVoie;
    return [
      upright('poteau', 0, b, H1),
      ...(cv.plinthe ? [slab('plinthe', b, b + wallHeightM * SKIRT_FRAC)] : []),
      ...claireVoie(),
      ...(cv.mainCourante ? [
        slab('couronnement', b + wallHeightM * CAP_FRAC, H1),
        ...(capped ? [] : [slab('couronnement', H1, H1 + isoPxToM(CAP_LIP_PX))]),
      ] : []),
      upright('poteau', 1, b, H1),
    ];
  }
  const frameH = b + wallHeightM * PANEL_HI;
  return [
    upright('poteau', 0, b, H1),
    slab('face', b, H1),
    ...(app.bayPanel ? [
      span('panneau', PANEL_T0, PANEL_T1, b + wallHeightM * PANEL_LO, frameH),
      span('moulure', PANEL_T0, PANEL_T1, frameH - isoPxToM(FRAME_PX / 2), frameH + isoPxToM(FRAME_PX / 2)),
    ] : []),
    slab('plinthe', b, b + wallHeightM * SKIRT_FRAC),
    slab('couronnement', b + wallHeightM * CAP_FRAC, H1),
    ...(capped ? [] : [slab('couronnement', H1, H1 + isoPxToM(CAP_LIP_PX))]),
    upright('poteau', 1, b, H1),
  ];
}

/** Case VOISINE de l'autre côté de l'arête — SOURCE UNIQUE `WALL_NB` (`builders/roofs.ts`), partagée
 *  avec l'indexation des murs que lisent les fermetures de comble. */
const NB = WALL_NB;

/** Un ÉTAGE repose-t-il SUR ce mur ? — une couche supérieure porte un plancher réel (tuile non `vide`,
 *  DANS la grille) dont la cote coïncide avec le sommet du mur, à l'aplomb de l'une ou l'autre des deux
 *  cases que l'arête sépare. VÉRITÉ DE SCÈNE (géométrie), jamais un mode de vue.
 *  Deux gardes que le prédicat ne peut pas se permettre de relâcher :
 *  — BORNES : hors grille, `tileAt` rend un « mur » implicite (bord de carte) et `heightAt` rend 0 ; sans
 *    le test de bornes, TOUT mur de bordure se croirait coiffé dès qu'une couche supérieure existe.
 *  — COÏNCIDENCE (`≈ topH`, pas `≤`) : un plancher qui coupe le mur À MI-HAUTEUR ne REPOSE pas dessus —
 *    c'est le corps du mur qui le traverse, pas sa lèvre, et rogner celle-ci n'y changerait rien.
 *  Depuis l'unification `WALL_H = LEVEL_H` (un mur atteint le plafond, cf. `geometry/iso.ts`), la LÈVRE
 *  décorative du couronnement (`CAP_LIP_PX`) n'a plus AUCUN dégagement au-dessus d'elle : sous un
 *  plancher elle le PERCE de `isoPxToM(CAP_LIP_PX)`. Coiffé ⇒ le mur tient dans son enveloppe d'étage
 *  [b, b+`wallHeightM`] ; libre (dernier niveau, clôture) ⇒ il garde sa lèvre. */
function storeyAbove(scene: Scene, seg: Pick<WallSeg, 'x' | 'y' | 'side'>, z: number, topH: number): boolean {
  const [nx, ny] = NB[seg.side];
  const { w, h } = scene.dimensions;
  const cells: [number, number][] = [[seg.x, seg.y], [seg.x + nx, seg.y + ny]];
  return scene.layers.some((l) => l.z > z
    && cells.some(([x, y]) => x >= 0 && y >= 0 && x < w && y < h
      && !estAbsent(tileAt(scene, x, y, l.z))
      && Math.abs(heightAt(scene, x, y, l.z) - topH) < EPS));
}

const xyKey = (x: number, y: number) => `${x},${y}`;

/** Le DEHORS d'une case, par étage — SEULE définition du dépôt, lue par l'ENVELOPPE des murs
 *  (`envelopeEdgesOf`) comme par le CÔTÉ SORTANT d'une arête (`outwardSide`, décors de façade).
 *  Le dehors = case n'appartenant à AUCUNE case INTÉRIEURE (`interiorCells`, `state/planDefects.ts`,
 *  #881 — closes par les murs ET non déclarées à ciel ouvert, jamais la seule notion
 *  `SceneEffectZone.presentation: 'interior'` : une enceinte close n'est pas un bâtiment couvert) ET
 *  hors de l'emprise BÂTIE d'une masse (le VOLUME du corps, PAS sa couverture de toit — #825bis : un
 *  avant-toit déborde le mur PAR CONSTRUCTION, la case qu'il surplombe reste DEHORS ; confondre « sous
 *  un toit » et « à l'intérieur » neutralisait 31 arêtes d'étage sur 58 côté La Diligence, mur en
 *  alternance visible/invisible). Une masse à plusieurs niveaux bâtit TOUS les étages qu'elle porte
 *  (`z − levels + 1 … z`), pas seulement son plancher sommet. Mémoïsé PAR SCÈNE (`memoByRef`, patron
 *  canonique unique) : une scène immuable ne recalcule jamais deux fois. */
export const dehorsDeScene = memoByRef((scene: Scene) => {
  const builtByZ = new Map<number, Set<string>>();
  const build = (z: number, x: number, y: number) => {
    const set = builtByZ.get(z) ?? (builtByZ.set(z, new Set()).get(z)!);
    set.add(xyKey(x, y));
  };
  for (const body of effectiveArchitecture(scene))
    for (const mass of body.masses) {
      const cells = massFootprintCells(mass.footprint);
      for (const key of cells) {
        const [x, y] = key.split(',').map(Number);
        for (let z = mass.z - mass.levels + 1; z <= mass.z; z++) build(z, x, y);
      }
    }
  return (x: number, y: number, z: number): boolean =>
    !interiorCells(scene, z).has(xyKey(x, y)) && !builtByZ.get(z)?.has(xyKey(x, y));
});

/** CÔTÉ SORTANT d'une arête : le cap cardinal vers lequel elle donne sur le DEHORS (`dehorsDeScene`) —
 *  ce qu'un décor de façade doit savoir pour se dresser du bon côté du mur. `null` quand aucun des deux
 *  côtés n'est le dehors (arête intérieure) et pour une arête DIAGONALE, dont `WALL_NB` rend un voisin
 *  nul : l'appelant tranche son repli. */
export function outwardSide(scene: Scene, edge: Pick<WallSeg, 'x' | 'y' | 'side'> & { z?: number }): Dir4 | null {
  const [nx, ny] = NB[edge.side];
  if (nx === 0 && ny === 0) return null;
  const z = edge.z ?? 0;
  const isDehors = dehorsDeScene(scene);
  if (isDehors(edge.x + nx, edge.y + ny, z)) return edge.side === 'N' ? 'N' : 'E';
  if (isDehors(edge.x, edge.y, z)) return edge.side === 'N' ? 'S' : 'O';
  return null;
}

/** ENVELOPPE extérieure d'un bâtiment (#818) : une arête `WallSeg` en est une seulement si la case
 *  D'EN FACE (l'autre côté de l'arête, `NB`) est le DEHORS — jamais « une autre pièce ». Un donjon
 *  100 % intérieur n'a AUCUN dehors → AUCUNE arête n'est enveloppe, le brouillard y reste inchangé —
 *  piège vérifié par un test dédié (walls.test.ts). Mémoïsée PAR SCÈNE comme le dehors qu'elle lit. */
const envelopeEdgesOf = memoByRef((scene: Scene): ReadonlySet<string> => {
  const isDehors = dehorsDeScene(scene);
  const out = new Set<string>();
  for (const w of scene.walls ?? []) {
    const z = w.z ?? 0;
    const [nx, ny] = NB[w.side];
    if (isDehors(w.x, w.y, z) !== isDehors(w.x + nx, w.y + ny, z)) out.add(cleArete(w.x, w.y, w.side, z));
  }
  return out;
});

/** Faces des ornements de MUR d'une façade. Les kinds de DÉCOR (`KINDS_DE_DECOR`, `data/facadePresets.ts`)
 *  n'y entrent JAMAIS — leur `appearance` authorable nomme un DÉCOR, pas une apparence de mur ; sans ce
 *  verrou, une apparence posée ferait sortir la même feature DEUX fois (#1624). Un ornement de mur sans
 *  apparence se peint au repli visible (`MISSING_ID`), que `validateScene` nomme. */
function facadeFeatureFaces(
  seg: WallSeg,
  facade: FacadeEdge,
  baseH: number,
  down: boolean,
): Face[] {
  if (down) return [];
  const [a, b] = wallEnds(seg);
  const at = (t: number): GXY => ({
    x: a.x + (b.x - a.x) * t,
    y: a.y + (b.y - a.y) * t,
  });
  const out: Face[] = [];
  for (const feature of facade.features) {
    if (KINDS_DE_DECOR.has(feature.kind)) continue;
    if (feature.kind === 'window-band' && seg.window) continue;
    const appearance = feature.appearance ??
      facadeWallFeatureAppearance(facade.appearance, feature.kind) ?? MISSING_ID;
    const id = `${facade.bodyId}:${facade.sectionId}:${feature.id}`;
    const center = feature.offset ?? 0.5;
    const width = feature.width ?? 0.6;
    const t0 = center - width / 2;
    const t1 = center + width / 2;
    const tagged = (part: WallPart, poly: Face['poly']): Face => ({
      poly,
      material: { domain: 'structure', id: appearance, part },
      architectureFeatureId: id,
      architectureFeatureKind: feature.kind,
      oriented: false,
    });
    const span = (part: WallPart, from: number, to: number, lo: number, hi: number): Face => {
      const p0 = at(from), p1 = at(to);
      return tagged(part, [
        { ...p0, h: hi },
        { ...p1, h: hi },
        { ...p1, h: lo },
        { ...p0, h: lo },
      ]);
    };
    if (feature.kind === 'window-band') {
      const lo = baseH + WALL_H_M * 0.42;
      const hi = baseH + WALL_H_M * 0.8;
      const mullion = width * 0.025;
      out.push(
        span('vitre', t0, t1, lo, hi),
        span('meneau', center - mullion, center + mullion, lo, hi),
        span('meneau', t0, t1, (lo + hi) / 2 - isoPxToM(1.5), (lo + hi) / 2 + isoPxToM(1.5)),
      );
    } else if (feature.kind === 'stone-entry') {
      const inner0 = center - width * 0.28;
      const inner1 = center + width * 0.28;
      out.push(
        span('face', t0, inner0, baseH, baseH + WALL_H_M * 0.76),
        span('face', inner1, t1, baseH, baseH + WALL_H_M * 0.76),
        span('linteau', t0, t1, baseH + WALL_H_M * 0.68, baseH + WALL_H_M * 0.82),
      );
    } else if (feature.kind === 'gable') {
      const p0 = at(t0), p1 = at(t1), apex = at(center);
      out.push(tagged('face', [
        { ...p0, h: baseH + WALL_H_M },
        { ...p1, h: baseH + WALL_H_M },
        { ...apex, h: baseH + WALL_H_M * 1.55 },
      ]));
    }
  }
  return out;
}

function tagExistingFacadeFaces(faces: Face[], seg: WallSeg, facade: FacadeEdge, down: boolean): Face[] {
  if (down || !seg.window) return faces;
  const feature = facade.features.find((candidate) => candidate.kind === 'window-band');
  if (!feature) return faces;
  const id = `${facade.bodyId}:${facade.sectionId}:${feature.id}`;
  const appearance = feature.appearance ??
    facadeWallFeatureAppearance(facade.appearance, feature.kind) ?? MISSING_ID;
  return faces.map((face) =>
    face.material.part === 'vitre' || face.material.part === 'meneau'
      ? {
          ...face,
          material: { ...face.material, id: appearance },
          architectureFeatureId: id,
          architectureFeatureKind: feature.kind,
        }
      : face);
}

// ── CRÉNELURE (décoration de RENDU) — dérivation du PÉRIMÈTRE (générale, toute forme, opt-in donnée) ──
/** Delta (dx,dy) d'un cap cardinal — SOURCE UNIQUE, partagée avec le décor de façade (`builders/props`,
 *  saillie d'un ornement vers l'extérieur) : la crénelure et lui lisent la même table. */
export const CARD_NB: Record<Dir4, [number, number]> = { N: [0, -1], E: [1, 0], S: [0, 1], O: [-1, 0] };

/** Éléments `wall` SYNTHÉTIQUES de CRÉNELURE (RENDU PUR, comme un toit auto-dessiné) : pour chaque arête de
 *  PÉRIMÈTRE d'une tuile crénelée (voisin même-z NON crénelé), la seule CRÊTE crénelée (`crownFaces` :
 *  parapet + merlons, assise à la surface). Merlons CEINTURANT la zone, jamais à l'intérieur. Générique
 *  (toute forme). N'est PAS un `WallSeg` de scène → ne coupe NI le passage NI la LdV plongeante (les
 *  défenseurs tirent par-dessus). La MAÇONNERIE du mur, elle, vient du bloc plein (`floorFaces`). */
function crestGeometry(scene: Scene, view?: FloorView): Viewed<WallEl>[] {
  const viewZ = view?.viewZ ?? null;
  const { w, h } = scene.dimensions;
  const out: Viewed<WallEl>[] = [];
  for (const l of scene.layers) {
    if (viewZ != null && l.z !== viewZ) continue; // isolement debug d'un étage
    const z = l.z;
    if (!l.crenellated) continue;
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const appId = crenellatedAt(scene, x, y, z);
        if (!appId) continue;
        const surfaceH = heightAt(scene, x, y, z);
        const cApp = structureAppearance(appId);
        for (const side of DIR4_ORDER) {
          const [dx, dy] = CARD_NB[side];
          const nx = x + dx, ny = y + dy;
          if (isCrenellated(scene, nx, ny, z)) continue; // arête INTERNE → pas de crête
          // ACCÈS (rampe/escalier atteint le chemin de ronde à ~même hauteur) → entrée OUVERTE, pas de
          // merlons en travers du passage.
          if (scene.layers.some((l) => isWalkable(scene, nx, ny, l.z) && gradeBetween(surfaceH, heightAt(scene, nx, ny, l.z)) !== 'cliff')) continue;
          const e = edgeOf(x, y, nx, ny);
          if (!e) continue;
          // STRUCTURE (porte/herse) sous l'arête → elle rend DÉJÀ sa propre crête (corps de garde) : pas de
          // double crénelure au-dessus de la porte.
          if (scene.layers.some((l) => l.z < z && structureAt(scene, e.x, e.y, e.side, l.z))) continue;
          const [A, B] = wallEnds({ x: e.x, y: e.y, side: e.side });
          out.push({
            off: {
              kind: 'wall', key: `crest:${cleArete(e.x, e.y, e.side, z)}`, cell: { x: e.x, y: e.y, z }, side: e.side,
              forme: 'mur-nu', appearance: cApp.id,
              ends: [{ ...A, h: surfaceH }, { ...B, h: surfaceH }],
              faces: crownFaces(cApp, A, B, surfaceH),
              states: { visible: false, down: false, open: false },
            },
            rule: { kind: 'enVue', keys: [`${x},${y},${z}`] },
          });
        }
      }
  }
  return out;
}

/** Une NAPPE de toit indexée par cellule — pour `roofSeamGeometry` : son emprise et le CHAMP de son
 *  groupe (`resolveNappes`, SOURCE UNIQUE de la hauteur de toit) donnent la hauteur exacte à
 *  n'importe quel coin de son empreinte. */
interface RoofNappe {
  bodyId: string;
  massId: string;
  z: number;
  levels: number;
  field: RoofField;
  cells: ReadonlySet<string>;
  roomZoneIds: readonly string[];
  /** Cases `x,y,z` du volume que la masse enferme, et de son CORPS entier — les deux lectures larges
   *  de la matière d'une fermeture (`closureAppearance`). */
  space: readonly string[];
  bodySpace: ReadonlySet<string>;
}

function indexRoofNappes(scene: Scene): ReadonlyMap<string, RoofNappe> {
  const index = new Map<string, RoofNappe>();
  const resolved = resolveNappes(scene);
  for (const body of effectiveArchitecture(scene)) {
    const bodySpace = new Set<string>();
    for (const mass of body.masses)
      for (const key of massSpaceCells(mass, massFootprintCells(mass.footprint))) bodySpace.add(key);
    for (const mass of body.masses) {
      const { cells, roomZoneIds, field } = resolved.get(nappeKey(body.id, mass.id))!;
      const nappe: RoofNappe = {
        bodyId: body.id, massId: mass.id, z: mass.z, levels: mass.levels, field, cells, roomZoneIds,
        space: massSpaceCells(mass, cells), bodySpace,
      };
      for (const key of cells) if (!index.has(key)) index.set(key, nappe);
    }
  }
  return index;
}

/** Éléments `wall` de FERMETURE de JOINT LATÉRAL entre deux CASES DE TOITURE voisines de nappes
 *  distinctes (#819) : `gableEnds` ne ferme que les extrémités du FAÎTAGE d'une nappe — le bord qui
 *  court PARALLÈLEMENT au faîtage (jonction de deux ailes côte à côte, jupe plus basse contre une aile,
 *  masses de `z` différents…) n'a AUCUN générateur. RENDU PUR : pour CHAQUE paire de cases 4-adjacentes
 *  couvertes par DEUX nappes distinctes (n'importe quel axe), si la hauteur de couverture diffère à l'un
 *  des deux coins de l'arête partagée, un quad de MUR comble le vide entre la surface haute et la basse
 *  — matériau du MUR PROLONGÉ (`closureAppearance`, la MÊME loi que les pignons de comble : jamais la
 *  couverture, jamais un id en dur), `roomZoneIds` = union des deux nappes (sinon suspendu en l'air quand
 *  l'une des deux coupes lève son toit). SILENCIEUX quand un seul côté est couvert (l'égout descend
 *  normalement jusqu'à un mur physique, déjà dressé ailleurs) ou quand les deux nappes sont exactement
 *  coplanaires au joint (rien à fermer). */
function roofSeamGeometry(scene: Scene, view?: FloorView): Viewed<WallEl>[] {
  const activeZ = view?.activeZ ?? 0;
  const viewZ = view?.viewZ ?? null;
  const out: Viewed<WallEl>[] = [];
  const index = indexRoofNappes(scene);
  const heightAtCorner = (n: RoofNappe, x: number, y: number) => fieldHeightAt(n.field, { x, y });

  const DIRS: { side: WallSide; nx: number; ny: number; c0: GXY; c1: GXY }[] = [];
  for (const [key, a] of index) {
    const [x, y] = key.split(',').map(Number);
    DIRS.length = 0;
    DIRS.push(
      { side: 'E', nx: x + 1, ny: y, c0: { x: x + 1, y }, c1: { x: x + 1, y: y + 1 } },
      { side: 'N', nx: x, ny: y + 1, c0: { x, y: y + 1 }, c1: { x: x + 1, y: y + 1 } },
    );
    for (const { side, nx, ny, c0, c1 } of DIRS) {
      const b = index.get(`${nx},${ny}`);
      if (!b || b === a) continue;
      const hA0 = heightAtCorner(a, c0.x, c0.y), hA1 = heightAtCorner(a, c1.x, c1.y);
      const hB0 = heightAtCorner(b, c0.x, c0.y), hB1 = heightAtCorner(b, c1.x, c1.y);
      if (Math.abs(hA0 - hB0) < EPS && Math.abs(hA1 - hB1) < EPS) continue; // nappes coplanaires au joint
      const z = Math.max(a.z, b.z);
      if (view && (viewZ != null ? z !== viewZ : z > activeZ)) continue;
      const edgeCell = side === 'E' ? { x, y } : { x, y: ny };
      const roomZoneIds = [...new Set([...a.roomZoneIds, ...b.roomZoneIds])];
      const edges = [];
      for (let ez = z; ez >= z - Math.max(a.levels, b.levels) + 1; ez--) edges.push({ ...edgeCell, side, z: ez });
      const appearance = closureAppearance(scene, edges, [...a.space, ...b.space], new Set([...a.bodySpace, ...b.bodySpace]));
      if (!appearance) continue; // aucun mur des deux corps : rien à prolonger
      const hi0 = Math.max(hA0, hB0), lo0 = Math.min(hA0, hB0);
      const hi1 = Math.max(hA1, hB1), lo1 = Math.min(hA1, hB1);
      const gp0hi: GP = { x: c0.x - 0.5, y: c0.y - 0.5, h: hi0 };
      const gp1hi: GP = { x: c1.x - 0.5, y: c1.y - 0.5, h: hi1 };
      const gp0lo: GP = { x: c0.x - 0.5, y: c0.y - 0.5, h: lo0 };
      const gp1lo: GP = { x: c1.x - 0.5, y: c1.y - 0.5, h: lo1 };
      out.push({
        off: {
          kind: 'wall',
          key: `seam:${a.bodyId}:${a.massId}:${b.bodyId}:${b.massId}:${cleArete(edgeCell.x, edgeCell.y, side, z)}`,
          cell: { x: edgeCell.x, y: edgeCell.y, z },
          bodyId: a.bodyId,
          roomZoneIds,
          side,
          forme: 'mur-nu',
          appearance,
          ends: [gp0lo, gp1lo],
          faces: [{ poly: [gp0hi, gp1hi, gp1lo, gp0lo], material: { domain: 'structure', id: appearance, part: 'face' }, oriented: false }],
          states: { visible: false, down: false, open: false },
        },
        rule: { kind: 'enVue', keys: [`${x},${y},${z}`, `${nx},${ny},${z}`] },
      });
    }
  }
  return out;
}

/** GÉOMÉTRIE des murs + la RÈGLE de vue de chacun (ses `visKeys`) — dérivée UNE fois par scène ×
 *  étage rendu, jamais au pas (#808). `view` ABSENT ⇒ toutes les couches (éditeur/QC/POV) ; sinon
 *  `viewZ` isole un étage (debug), sinon z ≤ activeZ (le jeu ne dresse pas les cloisons AU-DESSUS de
 *  la zone active). La hauteur de BASE est MÉTRIQUE (`heightAt`, la vérité POV — un niveau vaut 4·z).
 *  Les CRÊTES crénelées (décoration de rendu pur, `crestGeometry`) sont AJOUTÉES en fin — elles ne
 *  coupent ni passage ni LdV. */
function wallGeometry(scene: Scene, view?: FloorView): Viewed<WallEl>[] {
  const activeZ = view?.activeZ ?? 0;
  const viewZ = view?.viewZ ?? null;
  const out: Viewed<WallEl>[] = [];
  const envelope = envelopeEdgesOf(scene);
  for (const w of scene.walls ?? []) {
    const z = w.z ?? 0;
    if (view && (viewZ != null ? z !== viewZ : z > activeZ)) continue;
    const baseH = heightAt(scene, w.x, w.y, z);
    const facade = facadeDeLArete(scene, w);
    const app = structureAppearance(apparenceDeLArete(scene, w));
    const wallHeightM = app.wallHeightM ?? WALL_H_M;
    const down = !!w.structure && structureIsDown(scene, w);
    const open = !!w.door && doorIsOpen(scene, w);
    const [nx, ny] = NB[w.side];
    const [A, B] = wallEnds(w);
    const physicalFaces = wallFaces(w, app, baseH, down, wallHeightM, open, storeyAbove(scene, w, z, baseH + wallHeightM));
    out.push({
      off: {
        kind: 'wall',
        key: `wall:${cleArete(w.x, w.y, w.side, z)}`,
        cell: { x: w.x, y: w.y, z },
        ...(facade ? {
          bodyId: facade.bodyId,
          facadeSectionId: facade.sectionId,
          facadeAppearance: facade.appearance,
          ...(facade.roomZoneIds ? { roomZoneIds: [...facade.roomZoneIds] } : {}),
        } : {}),
        side: w.side,
        forme: formeRendue(w, open),
        appearance: app.id,
        ends: [{ ...A, h: baseH }, { ...B, h: baseH }],
        faces: [
          ...(facade ? tagExistingFacadeFaces(physicalFaces, w, facade, down) : physicalFaces),
          ...(facade ? facadeFeatureFaces(w, facade, baseH, down) : []),
        ],
        states: { visible: false, down, open },
      },
      rule: envelope.has(cleArete(w.x, w.y, w.side, z))
        ? { kind: 'toujours' } // ENVELOPPE du bâtiment (#818) : la façade n'est pas un secret
        : { kind: 'enVue', keys: [`${w.x},${w.y},${z}`, `${w.x + nx},${w.y + ny},${z}`] },
    });
  }
  out.push(...crestGeometry(scene, view));
  out.push(...roofSeamGeometry(scene, view));
  return out;
}

/** Éléments `wall` de la scène. `visible` absent ⇒ tout visible ; sinon un mur est VISIBLE (dessiné
 *  AU-DESSUS du voile de brouillard) si l'une des DEUX cases bordant son arête est en vue, OU si
 *  l'arête est de l'ENVELOPPE du bâtiment (`envelopeEdgesOf`, #818 — la façade n'est pas un secret,
 *  seul l'intérieur se cache). La GÉOMÉTRIE est mémoïsée (`viewedBuilder`) : un pas qui ne change que
 *  le brouillard ne re-dérive AUCUNE face — il ne bascule que la vérité de vue des murs concernés. */
export const buildWalls: (scene: Scene, visible?: ReadonlySet<string>, view?: FloorView) => WallEl[] =
  viewedBuilder<WallEl, FloorView>({
    derive: wallGeometry,
    // `view` ABSENT (toutes les couches) ≠ `view` fourni à activeZ 0 (une seule) : la clé les sépare.
    key: (view) => `${view ? 1 : 0}|${view?.activeZ ?? 0}|${view?.viewZ ?? null}`,
    withTruth: (off) => ({ ...off, states: { ...off.states, visible: true } }),
  });
