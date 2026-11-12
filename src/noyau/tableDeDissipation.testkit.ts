/**
 * TABLE À DEUX SIÈGES en mode Dissiper (#1411), état RÉEL : deux héros (un par siège), deux ennemis porteurs de Sorts.
 * L'ACTIF (`h1`) appartient au siège de CE client, `h2` à l'autre : la possession est donc VRAIE —
 * `controlsCombatant` ouvre le clic ici, et le refuserait sur le héros du voisin. Jamais un combat vide.
 */
import { initialNet, type EtatDeJeu } from './etat';
import { combattantDeTest } from '../engine/combattantDeTest.testkit';
import { spawnEnemy } from './monde/spawn';
import { emptyScene } from './monde/scene';
import type { ActiveEffect } from '../engine/types';

/** L'écriture d'état qui pose la table, côté `mode`, chaque ennemi portant `porteurs[id]` Sorts. */
export function tableDeDissipation(mode: 'hote' | 'invite', porteurs: Record<string, number>): Partial<EtatDeJeu> {
  const hero = combattantDeTest({ id: 'h1', label: 'Héros', kind: 'heros', pos: { x: 6, y: 6 }, skills: [{ id: 'langue', spec: 'magick', characteristic: 'intelligence', advances: 0 }] });
  const ally = combattantDeTest({ id: 'h2', label: 'Allié', kind: 'heros', pos: { x: 5, y: 6 } });
  const e1 = spawnEnemy({ ref: 'moritz-valgeir' }, 'e1', { x: 7, y: 6 });
  const e2 = spawnEnemy({ ref: 'moritz-valgeir' }, 'e2', { x: 8, y: 6 });
  // Porteurs de Sorts à la forme RÉELLE d'un effet actif (`bonus`/`duration` REQUIS,
  // `engine/types.ts`) : un effet sans durée ne peut pas exister en jeu — le peintre de pastilles
  // jette dessus (il lit `e.duration.scale`). Le type le GARDE ici.
  for (const c of [e1, e2]) {
    const n = porteurs[c.id] ?? 0;
    c.activeEffects = Array.from({ length: n }, (_, i): ActiveEffect => ({
      label: `Effet ${i + 1}`,
      bonus: 0,
      duration: { scale: 'permanent' },
      spell: { spellId: `sort-${i + 1}`, casterId: 'e2', label: `Sort ${i + 1}`, ni: 3 + i },
    }));
  }
  const battle = {
    combatants: [hero, ally, e1, e2], order: ['h1', 'h2', 'e1', 'e2'], baseOrder: ['h1', 'h2', 'e1', 'e2'],
    turn: 0, round: 1, action: 'dissipation', selectedSpellId: null, reachable: new Map(),
    movementUsed: 0, movedPreAction: false, acted: false, log: [], over: null,
  } as never;
  return {
    battle, scene: emptyScene('s', 16, 12), party: [hero, ally],
    pendingCleave: null, pendingDualStrike: null, pendingCast: null, pendingAttack: null,
    pendingSiegeAim: null, pendingDispel: null, dispelCarrierId: null,
    net: {
      ...initialNet(), mode,
      mySeat: mode === 'invite' ? 1 : 0,
      ownership: mode === 'invite' ? { h1: 1, h2: 0 } : { h1: 0, h2: 1 },
      seatNames: { 0: 'Hôte', 1: 'Invité' },
    },
  };
}
