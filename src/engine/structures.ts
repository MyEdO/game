/**
 * Structures DESTRUCTIBLES de siège (ADE II 8 « Le théâtre de la guerre ») comme `Combatant` à PV —
 * module FEUILLE. Calqué sur `engine/vehicle.ts` (coque inerte) : une structure (`structures.json`) devient
 * une cible inanimée à Blessures qui encaisse les Dégâts par la langue UNIQUE `woundsFromHit`/`GameOp`. RAW
 * dit lui-même que Structure / Véhicule / Navire suivent le MÊME modèle Endurance/Blessures (AA 10 l.13/116).
 *
 * Trois Atouts data-driven greffés sur le résolveur de Blessures (`woundsCalc`) — JAMAIS de code par-nom :
 *  - **Siège** (atout d'ARME, ADE II 08 l.292) : « inflige le double des dégâts aux structures physiques ».
 *    Lu sur l'arme par sa capacité de qualité `siege` (`qualities.json`).
 *  - **Résistant** (atout de STRUCTURE, l.296) : « ne peuvent pas être abîmées par une Arme à distance sans
 *    l'Atout Siège » — le corps à corps passe. Capacité de trait `structResistant` (`traits.json`).
 *  - **Impénétrable** (atout de STRUCTURE, l.300) : « ne peuvent pas être abîmées par une Arme sans l'Atout
 *    Siège » — toute arme. Capacité de trait `structImpenetrable` (namespace DISTINCT de la qualité d'armure
 *    LDB 63 « Impénétrable » `critImmuneOdd` : ici c'est un Trait `impenetrable-structure`).
 *  - **Bélier** (ADE II 08 l.249) : « n'infligent des dégâts qu'aux portes » — capacité de qualité `ram`.
 *
 * Module FEUILLE : n'importe QUE `qualities/dispatch` (caps de l'arme) + `capabilities` (caps de la cible) +
 * la donnée/`items` (le BUILDER), JAMAIS `combat`/`ops` → aucun cycle (`woundsCalc` peut le greffer).
 */
import type { Combatant, Weapon, StructureData, WallEdgeSide } from './types';
import { cleArete } from '../geometry/arete';
import { resolveQualities } from './qualities/dispatch';
import { hasCapability } from './capabilities';
import { findStructureById } from '../data';
import { inanimateCombatant } from './inanimate';
import { chebyshev } from './grid';
import { sizeGap, type SizeCategory } from './size';

/** Cette cible est-elle une STRUCTURE de siège (`bodyShape:'structure'`) ? Prédicat NOMMÉ (source UNIQUE —
 *  jamais un littéral `'structure'` dispersé) : une structure est inerte (Tableau de Localisation propre,
 *  Psychologie ignorée) et porte les Atouts Résistant/Impénétrable. */
export function isStructure(c: Pick<Combatant, 'bodyShape'>): boolean {
  return c.bodyShape === 'structure';
}

/** Emplacement d'artillerie de siège (`bodyShape:'engin'`) — affût servi par un équipage (≠ 'structure' = mur/porte). */
export function isEngin(c: Pick<Combatant, 'bodyShape'>): boolean {
  return c.bodyShape === 'engin';
}

/** Nature d'AUTHORING d'une structure (posable sur une arête, comme cloison ou fermeture) : `edgeKind`
 *  s'il diverge du `kind` mécanique (Herse — Bélier n'y applique pas, cf. `structures-aa.test.ts`, mais
 *  se pose comme une fermeture), sinon `kind` ; `undefined` si `vehicle` (jamais posable, #830). */
export function structureEdgeKind(s: Pick<StructureData, 'kind' | 'edgeKind' | 'vehicle'>): 'porte' | 'mur' | undefined {
  return s.vehicle ? undefined : s.edgeKind ?? s.kind;
}

/** La structure est-elle un MATÉRIAU DE MUR posable sur une arête (sélecteur de l'outil Cloison) ? */
export function isWallEdgeStructure(s: StructureData): boolean {
  return structureEdgeKind(s) === 'mur';
}

/** La structure est-elle une FERMETURE posable sur une arête (sélecteur de l'outil Porte) ? */
export function isDoorEdgeStructure(s: StructureData): boolean {
  return structureEdgeKind(s) === 'porte';
}

/** Cette cible est-elle un OBJET INANIMÉ (pas une créature) — STRUCTURE de siège (ADE II 8), VÉHICULE-coque
 *  (navire/chariot/barge, MDG) ou pièce SERVIE explicitement inerte (`inert`, ex. un affût d'artillerie) ? Source
 *  UNIQUE et NOMMÉE du « c'est un objet » : aucune réaction de combat (ni Parade/Esquive, ni Localisation, ni
 *  Engagement). Le littéral `'vehicule'` est INLINÉ à dessein : importer `isVehicle` créerait un cycle
 *  `structures → vehicle → ops → woundsCalc → structures`. La DESTRUCTION reste, elle, par-type (Siège ×2 propre
 *  aux structures, Critiques navals propres aux véhicules) → garder `isStructure`/`isVehicle` à ces sites-là. */
export function isInanimate(c: Pick<Combatant, 'bodyShape' | 'inert'>): boolean {
  return isStructure(c) || c.bodyShape === 'vehicule' || !!c.inert;
}

/** L'arme porte-t-elle la capacité de qualité `cap` (`siege`/`ram`) ? Lue dans la DONNÉE (`qualities.json`)
 *  par le MÊME résolveur que tous les Atouts d'arme — aucun test par libellé. */
function weaponHasCap(weapon: Pick<Weapon, 'qualities'> | undefined, cap: 'siege' | 'ram'): boolean {
  return resolveQualities(weapon).some((r) => !!r.caps?.[cap]);
}

/** Catégorie physique de la structure cible (`porte`/`mur`), lue dans le catalogue par son `id` (posé sur
 *  `creatureId` au build) — pour la règle « Bélier : portes uniquement ». `undefined` si la cible n'est pas
 *  une structure du catalogue. */
function structureKind(target: Combatant): 'porte' | 'mur' | undefined {
  return target.creatureId ? findStructureById(target.creatureId)?.kind : undefined;
}

/** Catégorie de Taille de la structure cible, lue dans le CATALOGUE par son `id` (posé sur `creatureId`
 *  au build) — même patron que `structureKind`. Elle n'est JAMAIS portée par le `Combatant` : `Combatant.size`
 *  est le Trait Taille d'une créature (LDB 85 l.344), lu par le mod de Tir, l'empreinte de grille, le
 *  multiplicateur de Dégâts, le Test de Force opposé et la Peur/Terreur — un mur n'entre dans aucun de ces
 *  comptes (AA 10 l.96 : toute attaque au corps à corps contre une Structure touche automatiquement).
 *  `undefined` si la cible n'est pas une structure du catalogue. */
export function structureTaille(target: Pick<Combatant, 'bodyShape' | 'creatureId'>): SizeCategory | undefined {
  if (!isStructure(target)) return undefined;
  return target.creatureId ? findStructureById(target.creatureId)?.taille : undefined;
}

/** Le Bélier (cap `ram`) frappe-t-il une cible qui n'est PAS une porte ? (ADE II 8 l.249) — hors-porte,
 *  le résolveur de coup (`applyHit`) le transforme alors en Arme improvisée. */
export function ramVsNonDoor(weapon: Pick<Weapon, 'qualities'> | undefined, target: Combatant): boolean {
  return weaponHasCap(weapon, 'ram') && structureKind(target) !== 'porte';
}

/**
 * La structure `target` est-elle IMPARABLE par cette `weapon` (le coup ne l'abîme pas → 0 Blessure) ?
 *  - **Impénétrable** (`structImpenetrable`, l.300) : imparable par TOUTE arme sans l'Atout Siège.
 *  - **Résistant** (`structResistant`, l.296) : imparable par une Arme À DISTANCE sans Siège (le corps à corps passe).
 * Le Bélier hors-porte est traité en amont (`applyHit`) comme une Arme improvisée (`ramVsNonDoor`, ADE II 08 l.249).
 */
export function structureImmune(weapon: Weapon | undefined, target: Combatant): boolean {
  const siege = weaponHasCap(weapon, 'siege');
  if (!siege && hasCapability(target, 'structImpenetrable')) return true;
  if (!siege && weapon?.type === 'ranged' && hasCapability(target, 'structResistant')) return true;
  return false;
}

/** Multiplicateur de Dégâts de l'Atout Siège (ADE II 08 l.292) : ×2 pour une arme à Atout Siège frappant une
 *  STRUCTURE, ×1 sinon. Appliqué au TOTAL de Dégâts entrant (avant Bonus d'Endurance) par `woundsFromHit`. */
export function siegeMultiplier(weapon: Weapon | undefined, target: Combatant): number {
  return isStructure(target) && weaponHasCap(weapon, 'siege') ? 2 : 1;
}

/**
 * Combien de fois compter le Bonus d'Endurance de la Structure `target` face à un attaquant de Taille
 * `attackerSize` (`AA 10 l.98`) : `1` hors Structure, hors écart, ou pour une arme à Atout Siège ; sinon
 * `1 + écart de catégories` (Taille de la Structure au-dessus de celle de l'attaquant). La Taille de la
 * Structure est la DONNÉE `StructureData.taille`, lue au catalogue par `structureTaille` — elle ne compte
 * que POUR CE TERME-LÀ ; absente des deux côtés, `effectiveSize` la rabat sur Moyenne (`LDB 14 l.128`) —
 * écart nul, aucun effet. Lu par `woundsFromHit` (le BE) ET par le journal du coup (`applyHit`), source
 * UNIQUE du terme.
 */
export function structureEnduranceMult(
  weapon: Pick<Weapon, 'qualities'> | undefined,
  target: Pick<Combatant, 'bodyShape' | 'creatureId'>,
  attackerSize: SizeCategory | undefined,
): number {
  if (!isStructure(target) || weaponHasCap(weapon, 'siege')) return 1;
  return 1 + Math.max(0, sizeGap(structureTaille(target), attackerSize));
}

/** Les DEUX cases bordant l'arête d'une structure (ses deux FACES), à l'étage `z` de l'arête. Une arête N
 *  borde `(x,y)` (intérieur) ET `(x,y-1)` (extérieur) ; E borde `(x,y)` et `(x+1,y)` ; une cloison diagonale
 *  n'a qu'une case. Vide si la structure ne porte pas d'arête. */
export function structureFaceCells(c: Pick<Combatant, 'structureEdge'>): { x: number; y: number; z?: number }[] {
  const e = c.structureEdge;
  if (!e) return [];
  const z = e.z ? { z: e.z } : {}; // ABSENT = sol, la convention de `Combatant.pos`
  if (e.side === 'N') return [{ x: e.x, y: e.y, ...z }, { x: e.x, y: e.y - 1, ...z }];
  if (e.side === 'E') return [{ x: e.x, y: e.y, ...z }, { x: e.x + 1, y: e.y, ...z }];
  return [{ x: e.x, y: e.y, ...z }];
}

/** Case de VISÉE d'une structure depuis `from` : sa FACE la plus proche de l'attaquant. C'est la seule
 *  par laquelle la Ligne de Vue n'est PAS coupée par l'arête de la structure ELLE-MÊME (on voit/frappe la
 *  face d'un mur depuis son côté ; on ne « voit pas à travers » jusqu'à la case derrière). Repli sur `pos`
 *  (structure sans arête / fixture de test). Réutilisé par l'IA (cible la porte) ET la résolution (LdV de tir). */
export function structureAimCell(from: { x: number; y: number }, target: Pick<Combatant, 'structureEdge' | 'pos'>): { x: number; y: number; z?: number } {
  const faces = structureFaceCells(target);
  if (!faces.length) return target.pos ?? from;
  const cheb = (p: { x: number; y: number }) => chebyshev(p, from);
  return faces.reduce((best, f) => (cheb(f) < cheb(best) ? f : best));
}

/** Id du Combattant-structure enrôlé depuis l'arête `e` (`state/combatSlice.ts`), relu par `state/aretes.ts`
 *  — l'identité de l'arête (`cleArete`). */
export const idCombattantStructure = (e: { x: number; y: number; side: WallEdgeSide; z: number }): string =>
  `structure-${cleArete(e.x, e.y, e.side, e.z)}`;

/** Adaptateur de `inanimateCombatant` (builder UNIQUE des objets inanimés) pour une structure de siège
 *  (`structures.json`). `E = BE × 10` (la table ADE II donne le Bonus d'Endurance ⇒ `bonus(E)` retrouve
 *  `BE`) ; `wounds = Blessures`. Les Atouts Résistant/Impénétrable sont posés en `traits` (lus par
 *  `hasCapability` dans `structureImmune`). */
export function structureCombatant(struct: StructureData, id = `structure-${struct.id}`): Combatant {
  return inanimateCombatant({
    id,
    label: struct.label,
    refId: struct.id, // clé du catalogue (porte/mur) — lue par `structureKind`
    bodyShape: 'structure',
    hull: { e: struct.char.BE * 10, woundsB: struct.char.B }, // ADE II donne le Bonus d'Endurance ⇒ E = BE × 10 (verbatim)
    traits: struct.traits.map((t) => (t.value != null ? { id: t.id, value: t.value } : { id: t.id })),
  });
}
