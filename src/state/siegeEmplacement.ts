/**
 * Builder UNIQUE d'un EMPLACEMENT DE SIÈGE en `SceneEntity` — SOURCE DE VÉRITÉ PARTAGÉE par l'éditeur
 * (`placeEmplacement`) ET les scénarios (`siege-enceinte`). Un emplacement = une SceneEntity-personnage
 * qui PORTE un poste d'artillerie (`postes:[{ trappingId, crewIds }]`, base hydratée au spawn) et dont l'apparence est ENTIÈREMENT
 * DÉRIVÉE de sa `ref` (le trapping à art d'affût `siegeRig`) — JAMAIS d'`appearance.species` forcé :
 * `resolveRender` lit le rig d'engin depuis la ref (rendu IDENTIQUE éditeur ↔ exploration ↔ combat).
 * L'affût INERTE non-destructible (RAW-pur, AA 10 l.175-193) vient de la branche siège de `spawnEnemy`
 * (déclenchée par la `ref`), pas d'un statblock à PV.
 *
 * Exactement le modèle d'une créature posée PAR RÉFÉRENCE : on ne stocke pas l'espèce, on la dérive.
 */
import type { SceneEntity } from './scene';
import type { Dir8 } from './dir8';
import type { FireArc, AuthoredShipPoste } from '../engine/types';
import { findTrappingById } from '../data';

export interface SiegeEmplacementOpts {
  /** Équipage du poste (ORDRE = chef de pièce en tête → `crewIds[0]`). Vide par défaut (assigné ensuite). */
  crewIds?: string[];
  /** Arc de tir du créneau (relatif à l'orientation-monde du chef) ; absent = tir omni (pivot libre). */
  side?: FireArc;
  /** Orientation-monde de l'affût. */
  facing?: Dir8;
}

/**
 * Construit la `SceneEntity` d'un emplacement de siège (id FOURNI par l'appelant — éditeur via
 * `nextEntityId`, scénario via id fixe). `null` si `trappingId` n'est pas un engin posable (pas d'art
 * d'affût `siegeRig` ou item introuvable) → pas d'entité fantôme. Aucun champ `appearance` : l'espèce
 * (rig d'engin) est dérivée de `ref` au rendu.
 */
export function siegeEmplacementEntity(
  id: string,
  trappingId: string,
  pos: { x: number; y: number },
  opts: SiegeEmplacementOpts = {},
): SceneEntity | null {
  const t = findTrappingById(trappingId);
  if (!t?.siegeRig) return null; // posable ⇔ a un art d'affût (`siegeRig`)
  // #222 — réf catalogue AUTHORÉE (base hydratée au spawn), jamais une `ItemInstance` de base matérialisée.
  const poste: AuthoredShipPoste = { trappingId, crewIds: opts.crewIds ?? [], ...(opts.side ? { side: opts.side } : {}) };
  const ent: SceneEntity = {
    id,
    kind: 'personnage', // seul kind enrôlable en rencontre → spawn en Combattant (affût servi)
    pos: { x: pos.x, y: pos.y },
    label: t.label,
    ref: trappingId, // SOURCE de l'engin → branche siège de spawnEnemy (affût inerte) + rig DÉRIVÉ
    postes: [poste],
  };
  if (opts.facing) ent.facing = opts.facing;
  return ent;
}
