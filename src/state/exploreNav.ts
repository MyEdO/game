import { type Scene, type SceneEntity, isDescriptiveZone, isWalkable } from './scene';
import { entityBlockedAt } from './sceneRules';
import { pathTo, walkNeighbors, type MoveEnv, type Pt } from './path';
import { portalsForParty } from './roomPortals';
import { memeCase, placesJouables, seatSlotsOf } from './seating';
import { estUtilisable } from './usable';
import { sceneZoneTiles } from './zones';
import { screenStepDot, type ScreenDir } from './combatCursor';
import { type Dims } from '../geometry/iso';
import { DIR8_ORDER, DIR8_DELTA, type Dir8 } from './dir8';
import { chebyshev } from '../engine/grid';
import { maxJumpTiles, slowestMovement } from '../engine/movement';
import { niMortNiATerre } from './combatants';
import type { Combatant } from '../engine/types';

/** Case adjacente (8-voisins) libre et ATTEIGNABLE la plus proche d'une cible, pour le move-to-interact
 *  (P5). À l'ÉTAGE de la cible (un PNJ de loge s'aborde depuis une case voisine, même z). */
export function adjacentWalkable(sc: Scene, target: Pt, from: Pt): Pt | null {
  const tz = target.z ?? 0;
  let best: Pt | null = null;
  let bestLen = Infinity;
  for (let dx = -1; dx <= 1; dx++) {
    for (let dy = -1; dy <= 1; dy++) {
      if (!dx && !dy) continue;
      const c: Pt = tz ? { x: target.x + dx, y: target.y + dy, z: tz } : { x: target.x + dx, y: target.y + dy };
      if (!isWalkable(sc, c.x, c.y, tz)) continue;
      const p = pathTo(sc, from, c, { blocked: new Set() });
      if (p && p.length < bestLen) {
        best = c;
        bestLen = p.length;
      }
    }
  }
  return best;
}

/** PORTÉE D'UN GESTE SUR UNE CHOSE DU CHAMP — SOURCE UNIQUE (#1687) : elle est à portée de `pos` (le
 *  groupe en exploration, le combattant ACTIF en combat) quand elle est 8-adjacente (ou sous les
 *  pieds) ET au MÊME étage. L'étage fait partie de la portée, il n'en est pas un raffinement : deux
 *  cases superposées sont à distance de Chebyshev 0 et pourtant séparées par un plancher (#800).
 *
 *  Ce prédicat est le MÊME pour ce que la pastille montre, pour ce que le clic joue sur place, pour
 *  ce que `jouerAction` accepte, pour ce que l'abord décide et pour ce qu'un Round permet de
 *  ramasser : l'écrire deux fois, c'est promettre d'un côté ce que l'autre refuse. */
export function aPorteeDe(pos: Pt, ent: SceneEntity): boolean {
  return chebyshev(pos, ent.pos) <= 1 && (ent.z ?? 0) === (pos.z ?? 0);
}

/** Case d'ARRIVÉE qu'un clic/survol sur `tile` enverrait au groupe en EXPLORATION — SOURCE UNIQUE
 *  partagée par l'aperçu de chemin (IsoStage `explorePath`) et le clic (`performClick`), pour qu'ils
 *  ne divergent jamais (la divergence = le bug « le chemin ne s'affiche pas au survol d'un objet »).
 *
 *  `null` = aucune marche : interaction sur place (on est déjà à côté), badaud déjà adjacent, ou aucune
 *  case adjacente atteignable. Pour un déplacement simple on renvoie la case telle quelle — le filtrage
 *  « marchable » reste à `pathTo` (aperçu) / `moveAlong` (clic), comme aujourd'hui. */
export function exploreMoveDest(sc: Scene, partyPos: Pt, tile: Pt): Pt | null {
  const tz = tile.z ?? 0;
  const ent = sc.entities.find((e) => e.pos.x === tile.x && e.pos.y === tile.y && (e.z ?? 0) === tz);
  // On ne marche jamais SUR un personnage ni sur un décor qui OCCUPE sa case : on s'approche d'une case
  // adjacente (sinon le groupe entrerait dans le corps du PNJ, et la case d'un décor bloquant est
  // infranchissable). L'occupation ne se lit PAS au `kind` : c'est la règle unique de blocage
  // (`state/sceneRules.entityBlockedAt` — empreinte déclarée, solidité de type, action authorée), la
  // même que `isWalkable`. Un décor PASSABLE (mare de sang, tas de foin : ni empreinte, ni solide, ni
  // action) reste du SOL — on marche DESSUS, comme sur la case nue.
  // L'ABORD se décide sur l'OFFRE qui EXISTE, drapeaux non comptabilisés : on s'approche d'un coffre
  // qu'on a déjà vidé comme on s'en approchait avant — c'est le geste, arrivé, qui dit qu'il est vide.
  const occupe = !!ent && ent.kind === 'prop' && entityBlockedAt(sc, tile.x, tile.y, tz);
  if (ent && (estUtilisable(sc, ent) || ent.kind === 'personnage' || occupe)) {
    if (aPorteeDe(partyPos, ent)) return null; // déjà à portée → interaction/échange/badaud sur place
    return adjacentWalkable(sc, ent.pos, partyPos);
  }
  // Déplacement simple : on renvoie la case cliquée telle quelle. Le franchissement vertical s'auto-dérive
  // du relief le long du chemin (`pathTo` via `surfaceLink` — rampe/falaise), plus aucun escalier explicite.
  return tile;
}

export type PathOpts = MoveEnv;

/**
 * MOUVEMENT du GROUPE hors combat : `slowestMovement` (LDB 51 l.193) sur les membres NI MORTS NI À
 * TERRE (`niMortNiATerre`, `state/combatants.ts`). Groupe vide ou entièrement à terre → 0. PUR.
 */
export function mouvementDuGroupe(party: readonly Combatant[]): number {
  return slowestMovement(party.filter(niMortNiATerre));
}

/**
 * OPTIONS DE CHEMIN du groupe hors combat — dérivation UNIQUE, consommée par l'aperçu de survol comme
 * par le clic : la portée de saut découle du `mouvementDuGroupe`. PUR.
 */
export function optionsDeCheminDuGroupe(party: readonly Combatant[]): PathOpts {
  return { blocked: new Set(), jump: maxJumpTiles(mouvementDuGroupe(party)) };
}

export interface ExploreMovePlan {
  dest: Pt;
  path: Pt[];
  portalId?: string;
}

/** Marche PLANIFIÉE vers une place assise : la première place LIBRE du meuble (ordre du catalogue,
 *  `seatSlotsOf`) dont l'abord EFFECTIF soit atteignable. `null` = ce meuble n'a pas de place, elles
 *  sont toutes prises, ou aucun abord libre n'est joignable.
 *
 *  L'abord ne se redérive JAMAIS ici : `slot.approach` porte déjà l'approche effective (repli sur le
 *  voisinage du siège compris) — `state/seating` en est la seule couture.
 *
 *  `seatSlotsOf` et non `placesJouables` : ce plan n'est atteint que DERRIÈRE le gate d'activation
 *  d'`exploreMovePlan` (ou par un appelant qui a déjà décidé de l'assise) — il résout la géométrie,
 *  il ne décide pas de l'offre.
 *
 *  Le chemin retourné se termine EXACTEMENT sur l'abord : c'est ce que `interactEntity` exige pour
 *  asseoir (le groupe doit être SUR la case d'abord, pas simplement à côté du meuble). Déjà sur
 *  l'abord → chemin d'un seul point, à l'appelant d'y voir « rien à marcher ». */
export function exploreSeatPlan(
  scene: Scene,
  partyPos: Pt,
  propId: string,
  opts: PathOpts = { blocked: new Set() },
): { slotId: string; approach: Pt; path: Pt[] } | null {
  const libres = seatSlotsOf(scene, propId).filter((s) => !scene.seatAssignments?.[propId]?.[s.slotId]);
  // La place SOUS LES PIEDS prime sur l'ordre du catalogue — c'est celle que `interactEntity` prendra
  // (il n'accepte que le slot dont l'abord est exactement `partyPos`) : diverger ici ferait planifier
  // une marche vers une place que le geste refuserait à l'arrivée.
  const surPlace = libres.find((s) => memeCase(s.approach, partyPos));
  if (surPlace) return { slotId: surPlace.slotId, approach: surPlace.approach, path: [partyPos] };
  for (const slot of libres) {
    const path = pathTo(scene, partyPos, slot.approach, opts);
    if (path && path.length >= 2) return { slotId: slot.slotId, approach: slot.approach, path };
  }
  return null;
}

export function exploreMovePlan(
  scene: Scene,
  partyPos: Pt,
  tile: Pt,
  opts: PathOpts,
): ExploreMovePlan | null {
  // MEUBLE À PLACES : on rejoint l'ABORD d'une place libre plutôt qu'une case « à côté ». Ici, et pas
  // seulement au clic : l'aperçu de chemin au survol lit la MÊME source (diverger ferait disparaître
  // le tracé sous le curseur d'un meuble parfaitement joignable).
  // Les places AJOUTENT une destination, elles n'en retirent AUCUNE : sans place servable (toutes
  // prises, aucun abord atteignable), on REPASSE la main à la marche générique — un meuble plein qui
  // porte une fouille se rejoint encore par une case adjacente.
  const meuble = scene.entities.find((e) => e.kind === 'prop' && e.pos.x === tile.x && e.pos.y === tile.y && (e.z ?? 0) === (tile.z ?? 0));
  // ...et seulement si l'auteur a ACTIVÉ l'instance (`placesJouables`, #1687) : la destination du
  // clic est une lecture d'INTERACTION, comme le halo et le curseur.
  if (meuble && placesJouables(scene, meuble.id).length) {
    const place = exploreSeatPlan(scene, partyPos, meuble.id, opts);
    if (place && place.path.length >= 2) return { dest: place.approach, path: place.path };
  }
  const dest = exploreMoveDest(scene, partyPos, tile);
  if (!dest) return null;
  const path = pathTo(scene, partyPos, dest, opts);
  if (!path || path.length < 2) return null;
  const z = partyPos.z ?? 0;
  const occupiedZoneIds = new Set(
    (scene.effectZones ?? [])
      .filter((zone) =>
        isDescriptiveZone(zone)
        && zone.presentation === 'interior'
        && (zone.z ?? 0) === z
        && sceneZoneTiles(zone).some((point) =>
          point.x === partyPos.x
          && point.y === partyPos.y
          && (point.z ?? zone.z ?? 0) === z))
      .map((zone) => zone.id),
  );
  const portal = portalsForParty(scene, partyPos, occupiedZoneIds).find((candidate) =>
    candidate.to.x === tile.x
    && candidate.to.y === tile.y
    && (candidate.to.z ?? 0) === (tile.z ?? 0));
  return { dest, path, ...(portal ? { portalId: portal.id } : {}) };
}

/** Seuil d'alignement écran (`screenStepDot`) sous lequel un voisin n'est PLUS considéré comme
 *  « dans le sens poussé » (#792). En iso, la case voisine IDÉALE d'un cardinal (pas diagonal de
 *  grille) colle à ~0.89–1.0 ; les repêchages hors-axe (pas simple-axe de grille, quasi-perpendiculaires
 *  en vertical du fait du ratio 2:1 TW/TH) tombent à ~0.45 — c'est ce rabattement trompeur qui
 *  provoquait le zigzag/oscillation silencieux au clavier. 0.6 sépare les deux paliers mesurés
 *  (clusters 0.4472 et 0.8944 en losange iso par défaut, `exploreNav.test.ts`) sans jamais mordre sur
 *  la 8-connectivité en champ libre (le voisin idéal de chaque cardinal reste toujours ≥ 0.89).
 */
const ALIGN_MIN = 0.6;

/** Case d'ARRIVÉE d'un PAS clavier en exploration : la surface voisine CONNECTÉE (`walkNeighbors` —
 *  même connectivité que le BFS : `flat`/`ramp`, arête non murée, z auto-dérivé) dont le `tileCenter`
 *  colle le mieux à la direction ÉCRAN poussée (`screenStepDot`, projection partagée avec le curseur de
 *  combat). Gère rampes/tabliers sans aucune ambiguïté de z. Bloqué (`null`) si aucune surface voisine
 *  n'est SUFFISAMMENT alignée (seuil `ALIGN_MIN`) sur la direction poussée — on ne rabat plus vers un
 *  voisin fortement latéral (source du zigzag/oscillation #792). PUR. */
export function exploreStepDest(scene: Scene, from: Pt, dir: ScreenDir, dims: Dims): Pt | null {
  let best: Pt | null = null;
  let bestDot = 0; // strictement positif : sinon aucune surface voisine ne part dans ce sens écran
  for (const n of walkNeighbors(scene, from)) {
    const dot = screenStepDot(scene, from, n, dir, dims);
    if (dot > bestDot) {
      bestDot = dot;
      best = n;
    }
  }
  return bestDot >= ALIGN_MIN ? best : null;
}

/** Case d'ARRIVÉE d'un pas en vue SUBJECTIVE (POV) dans une direction MONDE `worldDir` (Dir8, ≠ écran :
 *  le POV raisonne en cap réel, indépendant de la caméra). La surface voisine CONNECTÉE (`walkNeighbors` —
 *  même connectivité que le BFS : rampes/tabliers/arête non murée, z auto-dérivé) dont le delta grille a le
 *  MÊME signe (x ET y) que le delta unitaire de `worldDir` (`DIR8_DELTA`). `null` si aucune (bord/mur/vide).
 *  PUR — réutilise `walkNeighbors` (zéro géométrie ré-implémentée). */
export function povStepDest(scene: Scene, from: Pt, worldDir: Dir8): Pt | null {
  const d = DIR8_DELTA[worldDir];
  for (const n of walkNeighbors(scene, from)) {
    if (Math.sign(n.x - from.x) === Math.sign(d.gx) && Math.sign(n.y - from.y) === Math.sign(d.gy)) return n;
  }
  return null;
}

/** Orientation du MENEUR à l'ENTRÉE d'une scène (spawn / transition) : regarde vers le CONTENU —
 *  le centroïde de la carte ((w−1)/2, (h−1)/2) quantifié en Dir8 par SECTEURS de 45° (atan2, PAS le
 *  signe du delta : depuis le bord sud d'une carte large on regarde N, pas NE/NO au moindre décalage).
 *  Sans cela, le défaut 'S' fait contempler le VIDE hors-carte en vue subjective (POV) au bord sud.
 *  Entrée déjà au centre → 'S' (aucune direction « vers le contenu » ne domine). PUR.
 *  Une orientation AUTHORÉE (`facing` du heroStart) prime sur ce calcul — arbitré au seam (store). */
export function spawnFacing(pos: { x: number; y: number }, dims: { w: number; h: number }): Dir8 {
  const dx = (dims.w - 1) / 2 - pos.x;
  const dy = (dims.h - 1) / 2 - pos.y;
  if (dx === 0 && dy === 0) return 'S';
  // Cap horaire depuis le nord (grille : N = −y) : 0 = N, π/2 = E, ±π = S, −π/2 = O → cran de 45°
  // le plus proche (l'ex-aequo de frontière de secteur arrondit au cran horaire suivant).
  const step = Math.round(Math.atan2(dx, -dy) / (Math.PI / 4));
  return DIR8_ORDER[((step % 8) + 8) % 8];
}
