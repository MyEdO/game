/** Builder partagé des emplacements de siège : une entité-personnage porte la référence d'un
 *  trapping du sous-type `armes-de-siege` et son poste d'artillerie, hydraté au spawn. */
import type { SceneEntity } from './scene';
import type { Dir8 } from '../../geometry/dir8';
import type { FireArc, AuthoredShipPoste } from '../../engine/types';
import { siegeEngines } from '../../data';

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
 * `nextEntityId`, scénario via id fixe). `null` si `trappingId` n'appartient pas au sous-type
 * `armes-de-siege`, sélectionné par `siegeEngines`.
 */
export function siegeEmplacementEntity(
  id: string,
  trappingId: string,
  pos: { x: number; y: number },
  opts: SiegeEmplacementOpts = {},
): SceneEntity | null {
  const t = siegeEngines().find((engin) => engin.id === trappingId);
  if (!t) return null;
  // #222 — réf catalogue AUTHORÉE (base hydratée au spawn), jamais une `ItemInstance` de base matérialisée.
  const poste: AuthoredShipPoste = { trappingId, crewIds: opts.crewIds ?? [], ...(opts.side ? { side: opts.side } : {}) };
  const ent: SceneEntity = {
    id,
    kind: 'personnage', // seul kind enrôlable en rencontre → spawn en Combattant (affût servi)
    pos: { x: pos.x, y: pos.y },
    label: t.label,
    ref: trappingId, // SOURCE de l'engin → branche siège de spawnEnemy (affût inerte)
    postes: [poste],
  };
  if (opts.facing) ent.facing = opts.facing;
  return ent;
}
