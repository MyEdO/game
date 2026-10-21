/**
 * Géométrie de combat : placement, empreintes/déplacement des combattants (LDB 15/85), flanc-dos et
 * vision dans l'obscurité. Fonctions PURES de l'état lu (engine + path/footprint/zones/scene) ;
 * les gestes qui écrivent la bataille vivent dans `combatPlacement.ts`.
 */
import type { BattleState } from '../etat';
import type { Combatant } from '../../engine/types';
import type { Dir8 } from '../../geometry/dir8';
import { Scene, isWalkable } from './scene';
import { Pt, MoveEnv, tileKey, climbTraverseFor, walkComponentsFrom, walkComponentAt } from './path';
import { footprintTiles, footprintN, occupiesTile } from './footprint';
import { inBattleId } from './combatants';
import { sizeGap } from '../../engine/size';
import { requiredTerrains } from '../../engine/ops';
import { isOutOfAction } from '../../engine/conditions';
import { isStructure } from '../../engine/structures';
import { traitSeesInDark } from '../../engine/traits/dispatch';
import { losBlockingTiles, barrierTilesFor } from './zones';
import { chebyshev } from '../../engine/grid';

/**
 * Tuiles qui BLOQUENT le déplacement de `mover` : l'empreinte (LDB 15 l.12) de chaque AUTRE
 * combattant, SAUF ceux de Taille STRICTEMENT inférieure au mover — une créature plus grande
 * « dégage les combattants de taille inférieure du chemin, se déplaçant où elle veut » (LDB 85
 * l.373-374). C'est l'ensemble de TRANSIT (ce qui interrompt le passage). Pour ce qui interdit de
 * FINIR son déplacement (on ne s'arrête jamais sur une autre créature), voir `cannotStopOn`.
 * L'overload `id: string` sert le placement AVANT existence d'un `Combatant` (Taille inconnue,
 * ex. pose d'une invocation dans `summonFlow.ts`) : aucun filtrage de Taille, toutes les
 * empreintes bloquent.
 */
export function occupied(battle: BattleState, mover: Combatant | string): Set<string> {
  const exceptId = typeof mover === 'string' ? mover : mover.id;
  const moverSize = typeof mover === 'string' ? undefined : mover.size;
  const s = new Set<string>();
  for (const c of battle.combatants) {
    // Une STRUCTURE de siège occupe une ARÊTE (mur), pas l'intérieur de sa case d'ancrage : le blocage
    // physique vit sur l'arête (`wallBetween`/`wallEdges`), pas dans `occupied`. On peut donc se tenir sur
    // sa case (un défenseur au pied de la herse) et un mobile pré-placé peut co-occuper — sa `pos` n'est
    // qu'un point d'ancrage pour le CIBLAGE, pas une emprise au sol.
    if (c.id === exceptId || isOutOfAction(c) || !c.pos || isStructure(c)) continue;
    if (moverSize !== undefined && sizeGap(c.size, moverSize) < 0) continue; // plus petit → dégagé du chemin (85 l.373-374)
    // Clé z-aware (convention `path.ts:tileKey`) : un bloqueur n'occupe que SON étage. z=0 → « x,y »
    // (byte-identique à l'ancien) ; un bloqueur z>0 produit « x,y,z », invisible au `footFits(...,0)` du sol.
    for (const t of footprintTiles(c.pos, footprintN(c))) s.add(tileKey(t.x, t.y, c.pos.z ?? 0));
  }
  // BARRIÈRES (zones authorées/sorts) : leurs cases sont infranchissables pour le mover gaté — point
  // d'injection UNIQUE → tout déplacement (reachable joueur, IA, poussée, téléport) les respecte.
  // Clé z-aware (même convention que les bloqueurs ci-dessus) : suit le `z` PROPRE à chaque tuile de
  // barrière (`Pt.z`), pas l'étage du mover. `zoneAreaTiles`/`sceneZonesToBattle` (zones.ts) ne portent
  // aujourd'hui aucun `t.z` depuis `SceneEffectZone.z` (#799, item `barrierTilesFor` de la checklist) :
  // leur correction propagera un z réel jusqu'ici sans changer cette ligne.
  const moverC = typeof mover === 'string' ? inBattleId(battle, mover) : mover;
  for (const t of barrierTilesFor(battle.zones, moverC)) s.add(tileKey(t.x, t.y, t.z ?? 0));
  return s;
}

/**
 * Cases que `mover` peut TRAVERSER mais où il ne peut PAS FINIR son déplacement (« soft-block »,
 * à passer en `noStop` aux fonctions de portée) : les empreintes des créatures de Taille STRICTEMENT
 * inférieure qu'il dégage de son chemin (LDB 85 l.373-374 — il les traverse) sans pour autant pouvoir
 * s'arrêter sur leur case. RAW : on ne FINIT jamais sur la case d'une autre créature ; la SEULE entrée
 * dans la case adverse est la Frappe Mortelle (LDB 85 l.362). Complément de `occupied` (transit) : les
 * créatures de Taille ≥ y sont déjà infranchissables, donc inutiles ici.
 *
 * VIDE si `mover` a une empreinte > 1 : en arrivant, il DÉPLACE les plus petits sous son empreinte
 * (`displaceSmaller`) et peut donc finir en les chevauchant (« se déplaçant où il veut »). Un mover 1×1
 * ne déplace personne → il ne peut finir sur AUCUNE autre créature (les ≥ via `occupied`, les < via ici).
 */
export function cannotStopOn(battle: BattleState, mover: Combatant): Set<string> {
  const s = new Set<string>();
  if (footprintN(mover) > 1) return s;
  for (const c of battle.combatants) {
    if (c.id === mover.id || c.id === mover.riderId || isOutOfAction(c) || !c.pos || isStructure(c)) continue; // structure = arête, pas la case
    if (sizeGap(c.size, mover.size) >= 0) continue; // Taille ≥ → déjà dans `occupied` (transit-bloqué)
    for (const t of footprintTiles(c.pos, footprintN(c))) s.add(tileKey(t.x, t.y, c.pos.z ?? 0)); // par étage (cf. occupied)
  }
  return s;
}

/**
 * Contraintes de déplacement de `mover` assemblées en UN point (le seul) : transit (`occupied`),
 * empreinte (`footprintN`), arrêt interdit (`cannotStopOn`). Tout calcul de portée/chemin d'un
 * combattant passe ce `MoveEnv` aux fonctions de `path.ts` → l'invariant « on ne finit pas sur une
 * autre créature » ne peut plus être oublié par un appelant. (`jump` non fixé : le combat ne saute pas.)
 */
export function moveEnv(battle: BattleState, mover: Combatant): MoveEnv {
  // `swim` : terrains d'élection du mover (op `offTerrainMod` — `eau` pour Aquatique/Amphibie/Créature
  // marine) qu'il traverse bien que `walkable:false`. Omis si aucun (le sol byte-identique à l'ancien env).
  const swim = requiredTerrains(mover);
  // `traverse` : Grimpant (LDB 85 l.160-162) — omis si aucune capacité (byte-identique à l'ancien env).
  const traverse = climbTraverseFor(mover.traits);
  return {
    blocked: occupied(battle, mover), foot: footprintN(mover), noStop: cannotStopOn(battle, mover),
    ...(swim.length ? { swim: new Set(swim) } : {}),
    ...(traverse ? { traverse } : {}),
  };
}

/**
 * Combattant (hors d'action exclu) dont l'empreinte couvre la tuile (x,y) AU MÊME ÉTAGE `z`.
 * Z-AWARE : une STRUCTURE de siège / un mur ancré à z0 (sa `pos` n'est qu'un point d'ANCRAGE de ciblage,
 * cf. `occupied`) n'occupe PAS la case de CHEMIN DE RONDE z1 de mêmes (x,y). Sans ce filtre, survoler/
 * cliquer le dessus d'un rempart viserait la muraille en contrebas → « hors de portée » fantôme et
 * déplacement impossible. SOURCE UNIQUE de « qui est sous cette tuile » pour l'interaction
 * (survol/clic/curseur/clic droit) — remplace les `find(occupiesTile(...))` z-aveugles dispersés.
 */
export function combatantAtTile(combatants: Combatant[], x: number, y: number, z = 0): Combatant | undefined {
  return combatants.find((c) => c.pos && !isOutOfAction(c) && (c.pos.z ?? 0) === z && occupiesTile(c.pos, footprintN(c), x, y));
}

/** Case walkable la plus proche du sol (Z-AWARE, #798) : parcourt les couches dans l'ORDRE authoré
 *  (le sol `z:0` d'abord si présent en tête, comme avant) — une scène sans case libre au sol replie
 *  sur les couches supérieures plutôt que de renvoyer `{0,0}` en dur dessus d'un mur. */
export function findFreeTile(scene: Scene): Pt {
  for (const layer of scene.layers)
    for (let y = 0; y < scene.dimensions.h; y++)
      for (let x = 0; x < scene.dimensions.w; x++)
        if (isWalkable(scene, x, y, layer.z)) return layer.z ? { x, y, z: layer.z } : { x, y };
  return { x: 0, y: 0 };
}

/** Première case `{x,y}` acceptée en parcourant les ANNEAUX de Chebyshev autour de `origin`, du rayon
 *  `rMin` au rayon `rMax` (ordre : rayon, puis ligne, puis colonne). `undefined` si aucune. */
export function premiereCaseEnAnneaux(origin: { x: number; y: number }, rMin: number, rMax: number, accepte: (x: number, y: number) => boolean): { x: number; y: number } | undefined {
  for (let r = rMin; r <= rMax; r++)
    for (let dy = -r; dy <= r; dy++)
      for (let dx = -r; dx <= r; dx++) {
        const x = origin.x + dx, y = origin.y + dy;
        if (chebyshev({ x, y }, origin) !== r) continue; // seulement l'anneau de rayon r
        if (accepte(x, y)) return { x, y };
      }
  return undefined;
}

/**
 * FORMATION des héros au début d'un combat : la colonne (`x − 1`, `y + i`) à côté de la position du groupe,
 * à son étage. Chaque héros tient DEBOUT sur une case distincte : marchable à cet étage (`isWalkable`),
 * joignable à pied depuis le groupe (`walkComponentsFrom`), hors des cases `prises` (adversaires posés).
 * Une case de la colonne qui ne l'est pas cède la place à la case valable la plus proche du groupe
 * (`premiereCaseEnAnneaux`) ; aucune case valable à l'étage : la case de la colonne. PUR.
 */
export function formationDeCombat(scene: Scene, groupe: Pt, n: number, prises: ReadonlySet<string> = new Set()): Pt[] {
  const z = groupe.z ?? 0;
  const { w, h } = scene.dimensions;
  const composantes = walkComponentsFrom(scene, groupe);
  const tenues = new Set(prises);
  const tient = (x: number, y: number): boolean => x >= 0 && y >= 0 && x < w && y < h
    && !tenues.has(tileKey(x, y, z)) && isWalkable(scene, x, y, z)
    && composantes.has(walkComponentAt(scene, x, y, z) ?? -1);
  const out: Pt[] = [];
  for (let i = 0; i < n; i++) {
    const colonne = { x: Math.max(0, groupe.x - 1), y: Math.min(h - 1, groupe.y + i) };
    const p = tient(colonne.x, colonne.y) ? colonne : premiereCaseEnAnneaux(groupe, 0, Math.max(w, h), tient) ?? colonne;
    tenues.add(tileKey(p.x, p.y, z));
    out.push(z ? { ...p, z } : p);
  }
  return out;
}

export function inRect(p: Pt, r: { x: number; y: number; w: number; h: number }): boolean {
  return p.x >= r.x && p.x < r.x + r.w && p.y >= r.y && p.y < r.y + r.h;
}

/**
 * MÈTRES d'une règle → CASES de PORTÉE, à l'échelle de la scène (`Scene.metresPerTile`, défaut
 * `LDB 15 l.12`). UNIQUE définition de cette conversion : les auras portées (`arrowWard`/`domeWard`,
 * `combat/hitModifiers.ts`), l'aura anti-Sort (`castWardLine`, `combatFlow.ts`) et les effets
 * DÉCLENCHÉS d'aire (`on: {near, radiusMeters}`, `triggeredEffects.ts`) la partagent — trois
 * divisions par le littéral `2` y figeaient l'échelle terrestre, et une aura de 4 m couvrait donc
 * 2 cases de 10 m en combat naval (#1507).
 * Arrondi au SUPÉRIEUR et plancher à UNE case : une aura chiffrée en mètres couvre au moins la case
 * de son porteur, quelle que soit la finesse de la grille. Le champ de LUMIÈRE, lui, ne passe pas
 * par ici — son rayon reste RÉEL (`rayonEnCases`, `noyau/monde/vision.ts`) parce que son dégradé le lit
 * comme une longueur, pas comme un nombre de cases à parcourir. PURE.
 */
export const porteeEnCases = (metres: number, mpt: number): number => Math.max(1, Math.ceil(metres / mpt));

/**
 * PRIMITIVE de géométrie d'aire PARTAGÉE (Chebyshev) : les combattants POSITIONNÉS à ≤ `radiusTiles` cases
 * de `center`, du plus proche au plus loin, après un `filter` optionnel (groupe/vivant/exclusion). SOURCE
 * UNIQUE du motif « collecter les combattants dans un rayon PUIS appliquer un effet par cible » — l'ORCHESTRATEUR
 * d'aire partagé par TOUS les systèmes à effet de zone, quel que soit leur applicateur (pluggable) :
 *  - résolveur d'aire des munitions (`combatArea` : terre = rayon métrique, applique le pipeline d'arme) ;
 *  - souffle de zone (`zoneBlast`, combatEffects : applique des `GameOp[]` via `applyOps`) ;
 *  - manœuvres de créature (`resolveManeuver`, combatManeuvers : Souffle/Hurlement, applique `TriggeredEffect`) ;
 *  - effets DÉCLENCHÉS d'aire (`TriggeredEffect.on = {near, radiusMeters}`, triggeredEffects : tout
 *    Trait/Talent/Atout/État qui pose une zone SOURCE-AGNOSTIQUE → `GameOp[]` à chaque cible).
 * Le tri par distance sert le plafond « N plus proches » (Tir de zone) ; les autres applicateurs sont
 * insensibles à l'ordre (effet indépendant par cible). `dist` (défaut : Chebyshev centre-à-centre,
 * Z-AWARE #798) est surchargeable pour une distance d'EMPREINTE (footprint-aware, `combatDistance`)
 * quand la Taille des combattants compte (effets déclenchés d'aire centrés sur un combattant).
 * CHOIX z du défaut : une aire de zone (souffle, munition, zone déclenchée) est HORIZONTALE — elle ne
 * porte qu'un centre `Pt` (jamais de portée verticale à mesurer) ; le défaut ne compte donc QUE les
 * combattants du MÊME étage que `center` (`center.z ?? 0`), les autres valant `Infinity` (hors rayon,
 * quel que soit `radiusTiles`) — un souffle posé au sol n'atteint plus un défenseur de muraille au-dessus.
 * Un appelant qui veut une vraie distance 3D (Taille + hauteur) passe `combatDistance` en `dist`, comme
 * `triggeredEffects.ts` (centre = position d'un combattant, donc déjà au bon étage).
 */
export function combatantsWithinRadius(
  center: Pt, radiusTiles: number, combatants: Combatant[], filter?: (c: Combatant) => boolean,
  dist: (center: Pt, c: Combatant) => number = (ctr, c) =>
    (ctr.z ?? 0) === (c.pos!.z ?? 0) ? chebyshev(ctr, c.pos!) : Infinity,
): Combatant[] {
  return combatants
    .filter((c) => c.pos && dist(center, c) <= radiusTiles && (!filter || filter(c)))
    .sort((a, b) => dist(center, a) - dist(center, b));
}

/** Cases bloquant la Ligne de Vue (zones opaques : Fumée du Souffle…) — L11 : lues de `battle.zones`. */
export const smokeOf = (battle: BattleState): Pt[] => losBlockingTiles(battle.zones);

const DIR8_RING: Dir8[] = ['N', 'NE', 'E', 'SE', 'S', 'SO', 'O', 'NO'];
/** Flanc/dos (LDB 14 l.62) : l'attaquant frappe-t-il hors du champ de vision avant du défenseur ?
 *  Front = orientation du défenseur ±45° (3 directions avant) ; flanc/dos = les 5 autres (écart ≥ 2 sur l'anneau). */
export function isFlankOrRear(targetFacing: Dir8, dirToAttacker: Dir8): boolean {
  const a = DIR8_RING.indexOf(targetFacing);
  const b = DIR8_RING.indexOf(dirToAttacker);
  return Math.min(Math.abs(a - b), 8 - Math.abs(a - b)) >= 2;
}

/** Voit dans l'obscurité : Trait Vision nocturne / Infravision (LDB 85) ou Talent Vision nocturne (LDB 10). */
export function seesInDark(c: Combatant): boolean {
  return traitSeesInDark(c.traits) || (c.talents ?? []).some((t) => t.talentId === 'vision-nocturne');
}

/** Instantané de `cancelMove` (R6/LOT 6, #199) : ce que capture le PREMIER segment de Mouvement (ou de
 *  poussée d'engin, `pushCommitTile`) du Tour, pour tout défaire tant qu'aucune Action n'a été prise —
 *  positions de TOUS les combattants (un grand/une poussée a pu en déplacer d'autres), orientation,
 *  `movedPreAction` et le `loseNextMovement` que la poussée pose sur les servants (siegePush.ts). */
export interface MoveSnapshot {
  pos: Record<string, Pt>;
  facing: Record<string, Dir8>;
  movedPreAction: boolean;
  loseNextMovement: Record<string, boolean>;
}

/** Capture `MoveSnapshot` — SOURCE UNIQUE, réutilisée par `battleClickTile`/`moveAttack`/`pushCommitTile`
 *  pour que `cancelMove` défasse TOUJOURS exactement ce qu'un premier segment a posé. */
export function captureMoveSnapshot(battle: BattleState, facing: Record<string, Dir8>): MoveSnapshot {
  return {
    pos: Object.fromEntries(battle.combatants.filter((c) => c.pos).map((c) => [c.id, { ...c.pos! }])),
    facing: { ...facing },
    movedPreAction: battle.movedPreAction,
    loseNextMovement: Object.fromEntries(battle.combatants.map((c) => [c.id, !!c.loseNextMovement])),
  };
}
