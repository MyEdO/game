/** Orientation des combattants et du groupe (`facing`, données MONDE `Dir8`). */
import { facingToward, type Dir8 } from '../geometry/dir8';
import { Pt } from './monde/path';
import { chebyshev } from '../engine/grid';
import type { Get, Set } from './flowTypes';
import type { FabriqueDuNoyau } from './machinerieDuNoyau';

export function creerActionsDOrientation(get: Get, set: Set) {
  return {
    orienterVers: (id, from, to) => {
      if (!from || !to) return;
      set((s) => ({ facing: { ...s.facing, [id]: facingToward(from, to) } }));
    },
    orienterSelonLeChemin: (id, path) => {
      if (!path || path.length < 2) return;
      get().orienterVers(id, path[0], path[path.length - 1]);
    },
    // Orientation à l'entrée en combat : valeur authored (entité de scène) sinon vers l'ennemi le plus proche.
    orienterLesCombattants: () => {
      const { battle, scene, facing } = get();
      if (!battle) return;
      const next: Record<string, Dir8> = { ...facing };
      for (const c of battle.combatants) {
        if (!c.pos) continue;
        const authored = scene?.entities.find((e) => e.id === c.id)?.facing;
        if (authored) { next[c.id] = authored; continue; }
        const foes = battle.combatants.filter((o) => o.pos && (o.kind === 'heros') !== (c.kind === 'heros'));
        let best: Pt | undefined;
        let bd = Infinity;
        for (const o of foes) {
          const d = chebyshev(o.pos!, c.pos);
          if (d < bd) { bd = d; best = o.pos!; }
        }
        if (best) next[c.id] = facingToward(c.pos, best);
      }
      set({ facing: next });
    },
  } satisfies FabriqueDuNoyau;
}
