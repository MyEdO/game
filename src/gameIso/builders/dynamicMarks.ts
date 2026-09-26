/**
 * BUILDER des marques DYNAMIQUES de combat (#1176, P3-0d/P3-0e) — celles qui SUIVENT le jeton qui
 * glisse : lien d'ENGAGEMENT entre deux combattants en mêlée, contour de l'unité ACTIVE, repère de
 * position du GROUPE hors combat, et l'ANNEAU D'ÉQUIPE aux pieds de chaque jeton posté. Pendant de
 * `builders/highlights`, et même frontière : PUR et camera-free.
 *
 * Ce que cette dérivation rend, ce sont des cases LOGIQUES et des IDENTITÉS — jamais une position à
 * l'écran ni dans le monde. La position de l'INSTANT appartient au rendu, qui la prend au canal de glissement
 * partagé (`stage/dynamicMarkPose`, `walkGlideM`, sur `fx/walkPose`).
 *
 * Pourquoi ces trois-là ne sont PAS dans `builders/highlights` : une marque de case s'y mesure à
 * l'ÉTAT (une portée, une zone, un anneau ne bougent pas entre deux états) ; celles-ci se posent à la
 * FRAME, entre deux états.
 */
import { isOutOfAction } from '../../engine/conditions';
import type { Combatant } from '../../engine/types';
import { CELL, projectStep, stepOf, tileCenter, type Dims, type ProjKind } from '../../geometry/iso';
import { DIR8_DELTA, type Dir8 } from '../../state/dir8';
import { wedgePath } from '../topoMarkers';
import { inBattleId } from '../../state/combatants';
import { footprintN } from '../../state/footprint';
import { mountOf } from '../../state/mount';
import type { Pt } from '../../state/path';
import type { BattleState } from '../../state/store';
import { combatantTokenScale } from '../sizeScale';
import { ENEMY_RING, HERO_RING, teamShape } from '../teamColors';
import type { TokenEl } from './types';
import type { PartyToken } from './tokens';

/** GABARIT du lien d'engagement : épaisseur de trait et pointillés, en PIXELS de la projection iso
 *  (`geometry/iso`) — l'échelle de référence dont le monde volumique tire ses fractions de case. */
export const TETHER_STROKE_PX = 2;
export const TETHER_DASH_PX = 4;
export const TETHER_GAP_PX = 3;

/** Longueur ÉCRAN d'un PAS DE CASE dans la cadence LOSANGE : la projection du pas de grille `(1, 0)`,
 *  soit `hypot(TW/2, TH/2)` ≈ 35,78 px (`geometry/iso.projectStep`, branche losange). C'est l'échelle
 *  que la voie volumique reproduit — un pas de case y vaut `mpt` mètres et retombe sur les mêmes 35,78
 *  px à l'écran (`backends/webgl/cameras.affineScales`, vue `iso`). */
const PAS_DE_CASE_PX = Math.hypot(projectStep(null, { x: 1, y: 0 }).dx, projectStep(null, { x: 1, y: 0 }).dy);

/** Le MÊME gabarit en fractions de CASE : un pas de case vaut `PAS_DE_CASE_PX` pixels à l'écran et
 *  `mpt` mètres dans le monde volumique, donc `K · mpt` mètres se peignent aux pixels du gabarit LE LONG
 *  DES AXES DE LA GRILLE. Hors de ces axes la conversion dérive par nature : le gabarit mètre son
 *  pointillé à l'ÉCRAN, le volumique le sien dans le MONDE, et la projection isométrique n'a pas la
 *  même échelle dans toutes les directions. Un lien de mêlée relie des cases au CONTACT (#1176) :
 *  l'écart y reste sous le tiret. */
export function strokeWidthK(px: number): number {
  return px / PAS_DE_CASE_PX;
}
export const TETHER_WIDTH_K = strokeWidthK(TETHER_STROKE_PX);
export const TETHER_DASH_K = strokeWidthK(TETHER_DASH_PX);
export const TETHER_GAP_K = strokeWidthK(TETHER_GAP_PX);

/** Case LOGIQUE d'une marque dynamique (l'étage compris). */
export interface MarkCell {
  x: number;
  y: number;
  z: number;
}

/** Lien de mêlée entre DEUX combattants Engagés — une seule entrée par paire. */
export interface EngageTether {
  a: { id: string; cell: MarkCell };
  b: { id: string; cell: MarkCell };
}

/** L'unité ACTIVE et son EMPREINTE : un cavalier est représenté par sa MONTURE (`mountOf`). */
export interface ActiveFootprint {
  id: string;
  cell: MarkCell;
  /** Côté de l'empreinte, en cases. */
  n: number;
}

/** Anneau d'ÉQUIPE aux pieds d'un jeton — la décoration de sol qui dit à quelle équipe il appartient. */
export interface TeamRing {
  id: string;
  /** Centre du bloc d'EMPREINTE (offset `(n−1)/2` appliqué) : l'anneau est aux PIEDS du jeton. */
  cell: MarkCell;
  /** Rayon en fraction de case sous la projection LOSANGE — l'ellipse aux pieds du jeton. */
  rK: number;
  color: string;
  /** Pointillé du canal daltonien (`teamShape`) — absent = trait plein. */
  dash?: string;
}

/** Les marques dynamiques d'une frame. En LECTURE SEULE : une frame se dérive, elle ne se retouche
 *  pas. */
export interface DynamicMarks {
  readonly tethers: readonly EngageTether[];
  readonly active: ActiveFootprint | null;
  /** Repère de position du GROUPE hors combat — sa case, sans glissement. */
  readonly party: MarkCell | null;
  /** Anneaux d'équipe, un par jeton posté (cf. `teamRings`). */
  readonly rings: readonly TeamRing[];
}

/** Aucune marque dynamique — la valeur d'une frame qui n'en reçoit pas. GELÉE : elle est partagée par
 *  toutes les frames, un appelant qui pousserait dedans la salirait pour toutes. */
export const NO_DYNAMIC_MARKS: DynamicMarks = Object.freeze({ tethers: Object.freeze([]), active: null, party: null, rings: Object.freeze([]) });

/**
 * Les marques dynamiques de l'instant. `battle` = le combat en cours (ou `null` hors combat), `party` =
 * la case du groupe quand le contexte l'affiche (le contexte — mode, dialogue ouvert — est tranché par
 * l'appelant, une seule fois). `tokens` = les jetons du builder et `partyToken` le meneur hors combat :
 * c'est d'eux que se dérivent les ANNEAUX d'équipe, la décoration de sol dont la population est celle
 * des jetons RÉELLEMENT postés. Ces deux-là sont EXIGÉS (une frame sans jeton passe `[]`, une frame en
 * combat passe `null` pour le meneur) : un défaut y rendrait des anneaux silencieusement absents.
 */
export function dynamicMarks(battle: BattleState | null, party: Pt | null, tokens: readonly TokenEl[], partyToken: Pick<PartyToken, 'leader' | 'pos' | 'seat'> | null): DynamicMarks {
  const tethers: EngageTether[] = [];
  let active: ActiveFootprint | null = null;
  if (battle) {
    for (const c of battle.combatants) {
      if (!c.pos || isOutOfAction(c)) continue;
      for (const oid of c.engagedWith ?? []) {
        if (c.id >= oid) continue; // une seule ligne par paire
        const o = inBattleId(battle, oid);
        if (!o?.pos || isOutOfAction(o)) continue;
        tethers.push({
          a: { id: c.id, cell: { x: c.pos.x, y: c.pos.y, z: c.pos.z ?? 0 } },
          b: { id: o.id, cell: { x: o.pos.x, y: o.pos.y, z: o.pos.z ?? 0 } },
        });
      }
    }
    const actif = inBattleId(battle, battle.order[battle.turn]);
    const unité = actif ? mountOf(battle, actif) ?? actif : undefined;
    // C'est l'UNITÉ REPRÉSENTÉE qui doit être posée, pas le combattant actif : une monture posée porte
    // le contour même si son cavalier n'a pas de `pos` (il en est le passager, cf. `state/mount`).
    if (unité?.pos)
      active = {
        id: unité.id,
        cell: { x: unité.pos.x, y: unité.pos.y, z: unité.pos.z ?? 0 },
        n: footprintN(unité),
      };
  }
  // MENEUR ATTABLÉ : le repère de sol du groupe S'ÉTEINT. Il dit « le groupe se tient ici » et se
  // peint sur une case ENTIÈRE ; assis, le corps n'est plus sur sa case d'abord mais sur l'ancre de sa
  // place — le poser à l'abord montrerait le groupe à côté de lui-même, le poser à l'ancre peindrait un
  // carré de sol sous la table. L'anneau d'équipe, lui, suit le corps (`teamRings` lit `partyToken.pos`).
  const repère = party && !partyToken?.seat ? { x: party.x, y: party.y, z: party.z ?? 0 } : null;
  return { tethers, active, party: repère, rings: teamRings(tokens, partyToken) };
}

/** GABARIT de l'anneau d'ÉQUIPE aux pieds du jeton sous la projection LOSANGE (ellipse `rx = 18·s,
 *  ry = 9·s`, `strokeWidth = 2.5`), en PIXELS de la projection SVG. */
export const TEAM_RING_RX_PX = 18;
export const TEAM_RING_STROKE_PX = 2.5;

/** Demi-axes ÉCRAN (px) de la projection iso d'un cercle MONDE de rayon UNE case. Un cercle est
 *  invariant par rotation du monde : sa projection ne dépend donc pas du lacet de la caméra, et vaut
 *  l'ellipse obtenue en projetant le point de grille diagonal de norme 1 (`projectStep`, branche
 *  losange). `RING_A_PX / RING_B_PX` vaut `TW / TH` : c'est CE rapport qui compresse d'un facteur deux,
 *  sur l'axe de profondeur, un pointillé dont le pas serait uniforme en ARC MONDE. */
export const RING_A_PX = projectStep(null, { x: Math.SQRT1_2, y: -Math.SQRT1_2 }).dx;
export const RING_B_PX = projectStep(null, { x: Math.SQRT1_2, y: Math.SQRT1_2 }).dy;

/** Rayon MONDE (fraction de case) de l'anneau d'un jeton d'échelle `s` : le cercle de ce rayon a POUR
 *  projection l'ellipse `rx = 18·s, ry = 9·s` — mêmes demi-axes, même rapport. */
export function teamRingRadiusK(s: number): number {
  return (TEAM_RING_RX_PX * s) / RING_A_PX;
}

/** GABARIT du disque-portrait de la VUE DU DESSUS, en fraction de case par case d'empreinte : le pion
 *  y est un disque centré sur sa case (`stage/TokenChromeOverlay`), et son anneau d'équipe ceint CE
 *  disque — même rayon. */
export const TOP_DISC_K = 0.85 / 2;

/** Rayon ÉCRAN (px) du disque-portrait d'une empreinte de `n` cases. */
export function discR(n: number): number {
  return n * CELL * TOP_DISC_K;
}

/** GABARIT du CAP d'orientation d'un pion-disque, en fraction de SON rayon : un QUARTIER À CHEVAL sur
 *  le bord du disque — base ancrée DEDANS (`INNER`), pointe au-delà (`OUTER`), demi-ouverture `HALF`.
 *  C'est le quartier des jetons de table : peint AU-DESSUS du portrait (`stage/TokenChromeOverlay`),
 *  sa surface visible ne dépend plus de ce que le bord du disque lui prend, donc les huit directions
 *  se lisent au même poids — un onglet posé au SEUL bord ne montrait qu'une couleur au coin. Il dit le
 *  cap, il ne le prolonge pas en flèche : le marqueur de station, lui, tire son triangle à 1,47 rayon
 *  parce qu'il vise un arc de tir (`topoMarkers.ARC_DIR`). */
export const DISC_CAP_INNER_K = 0.62;
export const DISC_CAP_OUTER_K = 1.18;
export const DISC_CAP_HALF_K = 0.46;

/** Direction ÉCRAN unitaire d'un cap MONDE (`Dir8`) sous la vue `dims` : le pas de grille de ce cap,
 *  passé par l'UNIQUE porte de projection des overlays du stage (`tileCenter`) — la rotation de caméra,
 *  cran ou lacet libre, y entre donc sans seconde formule. La différence de deux centres annule
 *  l'origine : seul le pas compte. Aucun `DIR8_DELTA` n'est nul, donc la norme non plus. */
export function screenDirUnit(dir: Dir8, dims: Dims): readonly [number, number] {
  const d = DIR8_DELTA[dir];
  const a = tileCenter(0, 0, dims);
  const b = tileCenter(d.gx, d.gy, dims);
  const dx = b.cx - a.cx;
  const dy = b.cy - a.cy;
  const len = Math.hypot(dx, dy);
  return len > 0 ? [dx / len, dy / len] : [0, 1];
}

/** Le CAP d'un pion-disque d'empreinte `n` orienté `dir`, tracé dans le repère de SON groupe — le
 *  disque y est centré sur l'origine (`stage/TokenChromeOverlay`). Le quartier est le triangle du
 *  marqueur de station, à un autre gabarit (`topoMarkers.wedgePath`) : un seul tracé pour les deux —
 *  ici sa base est plantée DANS le disque (`DISC_CAP_INNER_K < 1`), et sa pointe dehors. */
export function discCapPath(dir: Dir8, n: number, dims: Dims): string {
  const R = discR(n);
  return wedgePath(0, 0, screenDirUnit(dir, dims), {
    r: R * DISC_CAP_INNER_K,
    len: R * (DISC_CAP_OUTER_K - DISC_CAP_INNER_K),
    half: R * DISC_CAP_HALF_K,
  });
}

/** Demi-axes ÉCRAN (px) de la projection d'un cercle MONDE de rayon UNE case, en vue du DESSUS : la
 *  cadence y est unique et axis-alignée (`stepOf('top')`), donc la projection est 1:1 — un cercle monde
 *  y reste un CERCLE, et un pointillé uniforme en arc monde l'est déjà à l'écran. */
export const TOP_A_PX = projectStep(stepOf('top'), { x: 1, y: 0 }).dx;
export const TOP_B_PX = projectStep(stepOf('top'), { x: 0, y: 1 }).dy;

/** Demi-axes écran du cercle monde de rayon UNE case, PAR VUE — ce que le pointillé de l'anneau doit
 *  pré-compenser (rien en vue du dessus, un facteur deux en losange). */
export function ringAxesPx(kind: ProjKind): { a: number; b: number } {
  return kind === 'top' ? { a: TOP_A_PX, b: TOP_B_PX } : { a: RING_A_PX, b: RING_B_PX };
}

/** DÉCALAGE du paramètre `u` de l'ellipse écran à l'angle MONDE (`φ = u + phase + lacet`) : en losange
 *  le grand axe écran est la DIAGONALE de grille (`RING_A_PX`, d'où le quart de quart de tour) ; en vue
 *  du dessus les axes écran SONT ceux de la grille. */
export function ringPhaseRad(kind: ProjKind): number {
  return kind === 'top' ? 0 : -Math.PI / 4;
}

/** Épaisseur du trait, en fraction de case — même convention que le lien de mêlée (`TETHER_WIDTH_K`),
 *  le trait se mesure dans le MONDE, jamais en pixels d'écran. */
export const TEAM_RING_WIDTH_K = strokeWidthK(TEAM_RING_STROKE_PX);

/** BASES d'échelle des jetons dans le repère de billboard : le combattant, et le meneur du
 *  groupe hors combat. L'anneau se mesure sur la MÊME échelle que le corps qu'il entoure — la base
 *  voyage donc avec lui au lieu d'être recopiée d'un site de rendu à l'autre. */
export const COMBAT_TOKEN_BASE = 0.62;
export const PARTY_TOKEN_BASE = 0.6;

/** Décoration d'ÉQUIPE d'un jeton : couleur d'anneau (identité de héros cyclique, rouge ennemi) et
 *  canal d'appartenance daltonien (`teamShape`, R9 : ennemi = anneau POINTILLÉ). Le rendu en tire un
 *  anneau plat au sol (`backends/webgl/dynamicMarkMeshes`, slot `anneau`). */
export function teamRingDecor(c: Combatant, heroIndex?: number): { color: string; dash?: string } {
  const isHero = c.kind === 'hero';
  return {
    color: isHero ? HERO_RING[(heroIndex ?? 0) % HERO_RING.length] : ENEMY_RING,
    dash: teamShape(isHero),
  };
}

/** Un motif `strokeDasharray` du gabarit, lu en pixels de projection (`'5 3'` → tiret 5, blanc 3).
 *  Absent ou illisible = trait PLEIN. */
export function dashPattern(dash: string | undefined): { dashPx: number; gapPx: number } | null {
  if (!dash) return null;
  const [d, g] = dash.split(/[\s,]+/).map(Number);
  return Number.isFinite(d) && Number.isFinite(g) && d > 0 ? { dashPx: d, gapPx: g } : null;
}

/** Les anneaux d'équipe de la frame : UN par jeton de COMBATTANT posté, plus celui du meneur du groupe
 *  hors combat. La population est celle des ÉLÉMENTS DU BUILDER (`builders/tokens`) — donc exactement
 *  celle que le rendu dessine, filtres compris ; un couple MONTÉ n'en porte pas — le composite cavalier
 *  + monture est UN corps. */
export function teamRings(tokens: readonly TokenEl[], partyToken: Pick<PartyToken, 'leader' | 'pos'> | null): TeamRing[] {
  const out: TeamRing[] = [];
  for (const tk of tokens) {
    const s = tk.subject;
    if (s.kind !== 'combatant') continue;
    const n = footprintN(s.c);
    const off = (n - 1) / 2; // ancre (coin NO) → centre du bloc : l'anneau est aux PIEDS
    out.push({
      id: s.c.id,
      cell: { x: tk.cell.x + off, y: tk.cell.y + off, z: tk.cell.z },
      rK: teamRingRadiusK(COMBAT_TOKEN_BASE * combatantTokenScale(s.c)),
      ...teamRingDecor(s.c, s.heroIndex),
    });
  }
  // Le jeton de GROUPE n'est pas un combattant posté : il porte l'anneau du MENEUR, plein et à la
  // première couleur d'identité, quelle que soit la nature de ce meneur.
  if (partyToken)
    out.push({
      id: partyToken.leader.id,
      cell: { x: partyToken.pos.x, y: partyToken.pos.y, z: partyToken.pos.z ?? 0 },
      rK: teamRingRadiusK(PARTY_TOKEN_BASE),
      color: HERO_RING[0],
    });
  return out;
}
