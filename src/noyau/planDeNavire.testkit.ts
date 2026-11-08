import type { Dir4 } from '../geometry/dir8';
import { buildScene } from './mapSpec';
import type { Scene } from './monde/scene';
import { poserLesNavires } from './planDeNavire';

/** Un bassin de 24 × 24 cases à l'échelle du plan de la caraque, qu'une caraque `c1` au cap `cap`, avec les
 *  Améliorations `upgrades`, traverse, et ses ponts posés (`poserLesNavires`) : son empreinte de 4 cases a son coin
 *  nord-ouest à 7 cases de celui de ses ponts le long de sa quille, celui-ci en (3, 2). */
export function bassinDeLaCaraque(cap: Dir4, upgrades: readonly string[] = []): Scene {
  const pos = cap === 'E' || cap === 'O' ? { x: 10, y: 2 } : { x: 3, y: 9 };
  return poserLesNavires(buildScene({
    id: 'bassin', label: 'Bassin', size: [24, 24], terrain: 'eau',
    entities: [{ id: 'c1', kind: 'personnage', ref: 'caraque', pos, facing: cap, ...(upgrades.length ? { upgrades: upgrades.map((id) => ({ id })) } : {}) }],
  }));
}
