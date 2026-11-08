import { describe, it, expect } from 'vitest';
import { careerLevels } from './index';

/**
 * #1467 L1b V-P1 — l'identité d'un niveau de carrière est le composite `<career>-<level>`.
 *
 * L'id n'est pas un slug libre : il se RECALCULE de la paire que l'entrée porte déjà. Un id posé à la
 * main qui dérive de sa paire (renumérotation d'un niveau, changement de carrière parente) ne peut
 * donc pas passer, et l'unicité fait de cet id une cible de référence sûre.
 */
describe('careerLevels — identité composite `<career>-<level>` (#1467 L1b V-P1)', () => {
  it('chaque niveau porte un `id` ACCORDÉ à sa paire `career`+`level`', () => {
    const desaccordes = careerLevels
      .filter((lv) => lv.id !== `${lv.career.id}-${lv.level}`)
      .map((lv) => `${lv.label} : id « ${lv.id} » ≠ « ${lv.career.id}-${lv.level} »`);
    expect(desaccordes, 'id désaccordé de la paire qui le compose').toEqual([]);
    expect(careerLevels.length).toBe(432);
  });

  it('les ids de niveau sont DISTINCTS deux à deux (cible de référence)', () => {
    const vus = new Map<string, string>();
    const collisions: string[] = [];
    for (const lv of careerLevels) {
      const deja = vus.get(lv.id);
      if (deja !== undefined) collisions.push(`${lv.id} : « ${deja} » et « ${lv.label} »`);
      else vus.set(lv.id, lv.label);
    }
    expect(collisions, 'deux niveaux partagent un id').toEqual([]);
    expect(vus.size).toBe(careerLevels.length);
  });
});
