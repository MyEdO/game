/**
 * Instance runtime d'une Scène (#707) — le document `Scene` de `sceneRegistry` reste AUTHORED,
 * jamais muté ; ce qui change en jeu (entités retirées, portes/structures/tuiles) est un DELTA
 * capturé au départ d'une scène et réappliqué au clone frais lors du revisit.
 */
import type { Scene } from './scene';
import { pruneSeatAssignments, type SeatAssignments } from './seating';

/** Mutation runtime d'une scène (delta vs le document authored), persistée par `sceneId`. */
export interface SceneMutation {
  /** ids d'entités authored ABSENTES de la scène courante (retirées : décor consommé, PNJ tué). */
  removedEntityIds: string[];
  /** flags de l'OBJET Scene dont la valeur runtime diffère de l'authored (portes/structures/tuiles). */
  flags: Record<string, boolean>;
  /** Occupation des places assises, en OVERRIDE COMPLET (pas un delta par place) : présente, elle
   *  REMPLACE `Scene.seatAssignments` au revisit. `{}` est une valeur pleine — « plus personne
   *  n'est assis » — et c'est pourquoi l'absence du champ (aucun override) doit rester distincte
   *  d'un objet vide : un effacement complet ne peut pas ressusciter l'assise authored. */
  seatAssignments?: SeatAssignments;
}

/** Forme COMPARABLE d'une occupation : clés triées aux deux niveaux, meubles vidés écartés — deux
 *  occupations qui décrivent la même assise donnent la même chaîne, quel que soit l'ordre d'écriture. */
function seatShape(assignments: SeatAssignments | undefined): string {
  const out: [string, [string, string][]][] = [];
  for (const propId of Object.keys(assignments ?? {}).sort()) {
    const parMeuble = assignments![propId];
    const places = Object.keys(parMeuble).sort().map((slotId): [string, string] => {
      const o = parMeuble[slotId];
      return [slotId, o.kind === 'party' ? `party:${o.rang}` : `entity:${o.entityId}`];
    });
    if (places.length) out.push([propId, places]);
  }
  return JSON.stringify(out);
}

/** Dérive le delta de `current` vs `authored` (le document de `sceneRegistry`). Renvoie `undefined`
 *  si aucun changement (ne pas stocker une instance vide — garde `sceneInstances` propre). */
export function captureMutation(current: Scene, authored: Scene): SceneMutation | undefined {
  const authoredIds = new Set(authored.entities.map((e) => e.id));
  const currentIds = new Set(current.entities.map((e) => e.id));
  const removedEntityIds = [...authoredIds].filter((id) => !currentIds.has(id));
  const flags: Record<string, boolean> = {};
  for (const k of Object.keys(current.flags ?? {})) {
    if (current.flags[k] !== authored.flags?.[k]) flags[k] = current.flags[k];
  }
  const assiseChangee = seatShape(current.seatAssignments) !== seatShape(authored.seatAssignments);
  if (!removedEntityIds.length && !Object.keys(flags).length && !assiseChangee) return undefined;
  return { removedEntityIds, flags, ...(assiseChangee ? { seatAssignments: current.seatAssignments ?? {} } : {}) };
}

/** Superpose une mutation sur une scène FRAÎCHEMENT clonée (filtre les entités retirées + fusionne
 *  les flags delta). PUR (nouvelle Scène).
 *
 *  `partySize` FOURNIE = l'assise superposée est ÉLAGUÉE dans la foulée (`pruneSeatAssignments`) :
 *  une place dont le meuble sort par CETTE mutation, dont le slot manque au catalogue, ou dont le
 *  héros n'est pas du groupe fourni, n'entre pas en état. Paramètre EXPLICITE et non un défaut :
 *  sans le groupe, on ne peut pas distinguer « héros parti » de « groupe inconnu », et un élagage
 *  muet supprimerait l'assise du meneur. Absent = superposition nue.
 *  No-op complet si `mutation` absente ET aucun élagage demandé. */
export function applyMutation(cloned: Scene, mutation: SceneMutation | undefined, partySize?: number): Scene {
  if (!mutation && partySize === undefined) return cloned;
  const entities = mutation ? cloned.entities.filter((e) => !mutation.removedEntityIds.includes(e.id)) : cloned.entities;
  const flags = mutation ? { ...cloned.flags, ...mutation.flags } : cloned.flags;
  const assise = mutation?.seatAssignments === undefined ? {} : { seatAssignments: mutation.seatAssignments };
  const out: Scene = { ...cloned, entities, flags, ...assise };
  return partySize === undefined ? out : { ...out, seatAssignments: pruneSeatAssignments(out, partySize) };
}
