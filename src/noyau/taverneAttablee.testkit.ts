/**
 * La taverne attablée de la transition du jeu (#2817 D7) : deux héros, une table ronde, les rangs 1 et 2
 * du groupe assis (place-1, place-2).
 */
import { etatInitialDuJeu, type EtatDeJeu } from './etat';
import { emptyScene, type Scene } from './monde/scene';
import { assignSeat } from './monde/seating';
import type { Combatant } from '../engine/types';

const hero = (id: string): Combatant =>
  ({ id, label: id.toUpperCase(), kind: 'hero', wounds: { current: 12, max: 12 }, conditions: [], movement: 4 }) as unknown as Combatant;

export const ALDO = hero('aldo');
export const BRUNA = hero('bruna');
export const CORA = hero('cora');

/** La taverne : une table ronde, les rangs 1 et 2 du groupe assis (place-1, place-2). */
export function taverneAttablee(): Scene {
  let sc: Scene = emptyScene('scene-test', 12, 12);
  sc.id = 'taverne';
  sc.entities.push({ id: 'table-1', kind: 'prop', pos: { x: 5, y: 5 }, ref: 'table-ronde-4-tabourets', facing: 'N', usable: { assise: true } });
  for (const rang of [1, 2]) {
    const r = assignSeat(sc, 'table-1', `place-${rang}`, { kind: 'party', rang }, 2);
    if (!r.ok) throw new Error(`assignSeat refusé (rang ${rang}) : ${r.reason}`);
    sc = r.scene;
  }
  return sc;
}

/** Les rangs du groupe assis dans `sc`, triés. */
export const rangsAssis = (sc: Scene | null): number[] =>
  Object.values(sc?.seatAssignments ?? {}).flatMap((m) => Object.values(m)).flatMap((o) => (o.kind === 'party' ? [o.rang] : [])).sort();

/** Aldo et Bruna attablés dans la taverne. */
export function etatAttable(): EtatDeJeu {
  return { ...etatInitialDuJeu(), party: [ALDO, BRUNA], scene: taverneAttablee() };
}
