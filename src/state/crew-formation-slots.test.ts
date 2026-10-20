import { describe, it, expect } from 'vitest';
import { crewFormationSlots, assignCrewFormation } from '../noyau/monde/shipPostes';
import type { ShipPoste } from '../engine/types';
import type { Scene } from '../noyau/monde/scene';

/**
 * #210 Lot 3 — cases de FORMATION autour de l'empreinte d'un poste terrestre CREWÉ (bélier, batterie de
 * siège…) : `crewFormationSlots` (géométrie pure, ADE II 8 l.258 — « on pousse par les flancs/
 * l'arrière ») et `assignCrewFormation` (occupation de scène + repli `findFreeTile`).
 */
const scene = (w = 10, h = 10): Scene =>
  ({ id: 's', name: 's', dimensions: { w, h }, ambiance: 'jour', layers: [{ z: 0, tiles: new Array(w * h).fill('herbe') }], entities: [], dialogues: [], triggers: [], encounters: [] }) as unknown as Scene;

describe('crewFormationSlots — anneau ordonné autour de l’empreinte (#210)', () => {
  it('empreinte 2×2, cap N : jamais l’avant (rangée y=py-1), flancs (E/O) avant les angles/l’arrière', () => {
    const slots = crewFormationSlots({ pos: { x: 6, y: 10 }, footprint: 2 }, { crewIds: [] }, { heading: 'N' });
    // Aucune case de la rangée frontale (avant l'engin, y = py-1 = 9) : c'est là qu'il frappe.
    expect(slots.some((p) => p.y === 9)).toBe(false);
    // 8 cases au total pour une empreinte 2×2 (2 flancs × 2 + 2 angles arrière + 2 arrière).
    expect(slots).toHaveLength(8);
    // Ordre stable : flanc droit (E, x=8) puis flanc gauche (O, x=5) puis angles arrière (y=12,x=8/5) puis l'arrière (y=12,x=6/7).
    expect(slots).toEqual([
      { x: 8, y: 10 }, { x: 8, y: 11 }, // flanc droit
      { x: 5, y: 10 }, { x: 5, y: 11 }, // flanc gauche
      { x: 8, y: 12 }, // angle arrière-droit
      { x: 5, y: 12 }, // angle arrière-gauche
      { x: 6, y: 12 }, { x: 7, y: 12 }, // arrière
    ]);
  });

  it('ORDRE STABLE : deux appels avec les mêmes arguments renvoient EXACTEMENT la même séquence', () => {
    const hull = { pos: { x: 3, y: 3 }, footprint: 2 };
    const a = crewFormationSlots(hull, { crewIds: [] }, { heading: 'N' });
    const b = crewFormationSlots(hull, { crewIds: [] }, { heading: 'N' });
    expect(a).toEqual(b);
  });

  it('ADJACENCE à l’empreinte : chaque case est à distance de Chebyshev EXACTEMENT 1 de l’empreinte, jamais dessus', () => {
    const hull = { pos: { x: 3, y: 3 }, footprint: 2 };
    const slots = crewFormationSlots(hull, { crewIds: [] }, { heading: 'S' });
    for (const p of slots) {
      const inside = p.x >= 3 && p.x < 5 && p.y >= 3 && p.y < 5;
      expect(inside).toBe(false); // jamais SOUS l'empreinte
      const dx = p.x < 3 ? 3 - p.x : p.x > 4 ? p.x - 4 : 0;
      const dy = p.y < 3 ? 3 - p.y : p.y > 4 ? p.y - 4 : 0;
      expect(Math.max(dx, dy)).toBe(1); // Chebyshev 1 = ADJACENT
    }
  });

  it('empreinte 1×1 (poste sans footprint dédié) : 5 cases (flancs + 2 angles + arrière), jamais l’avant', () => {
    const slots = crewFormationSlots({ pos: { x: 5, y: 5 } }, { crewIds: [] }, { heading: 'S' });
    expect(slots).toHaveLength(5);
    expect(slots.some((p) => p.x === 5 && p.y === 6)).toBe(false); // (5,6) = au Sud = l'AVANT d'un cap Sud
  });

  it('sans hull.pos : aucune case (géométrie non résolue)', () => {
    expect(crewFormationSlots({ footprint: 2 }, { crewIds: [] })).toEqual([]);
  });
});

describe('assignCrewFormation — occupation + repli `findFreeTile` (empreinte enclavée, #210)', () => {
  const poste: Pick<ShipPoste, 'crewIds'> = { crewIds: ['a', 'b', 'c'] };

  it('assigne les cases de formation LIBRES, dans l’ordre des `crewIds`', () => {
    const s = scene();
    const hull = { pos: { x: 3, y: 3 }, footprint: 2 };
    const pts = assignCrewFormation(hull, poste, s, () => false, { heading: 'N' });
    expect(pts).toHaveLength(3);
    expect(pts).toEqual(crewFormationSlots(hull, poste, { heading: 'N' }).slice(0, 3));
  });

  it('case occupée → sautée au profit de la suivante de la formation', () => {
    const s = scene();
    const hull = { pos: { x: 3, y: 3 }, footprint: 2 };
    const all = crewFormationSlots(hull, poste, { heading: 'N' });
    const occupiedSet = new Set([`${all[0].x},${all[0].y}`]);
    const pts = assignCrewFormation(hull, poste, s, (p) => occupiedSet.has(`${p.x},${p.y}`), { heading: 'N' });
    expect(pts[0]).toEqual(all[1]); // la 1ère case de formation est prise → repli sur la 2e
  });

  it('empreinte ENCLAVÉE (toute la formation occupée/hors-carte) : repli sur `findFreeTile` — aucun servant sans case', () => {
    const s = scene(4, 4); // petite scène : peu de cases libres
    const hull = { pos: { x: 1, y: 1 }, footprint: 2 };
    // Occupe TOUTE la formation (aucune case dispo autour de l'empreinte) → repli.
    const pts = assignCrewFormation(hull, poste, s, () => true, { heading: 'N' });
    expect(pts).toHaveLength(3);
    for (const p of pts) expect(p).toEqual({ x: 0, y: 0 }); // `findFreeTile` = 1ère case praticable de la scène
  });
});
