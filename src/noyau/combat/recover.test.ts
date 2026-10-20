import { describe, it, expect } from 'vitest';
import { resolveRecoverTest } from './recover';
import type { Combatant } from '../../engine/types';

/**
 * `resolveRecoverTest` — SOURCE UNIQUE des paramètres du Test de récupération par Action (LDB 16 l.66/84),
 * lue de la donnée `EtatData.recover`. Partagée par l'IA (combatFlow) et le flux joueur (combatSlice) ;
 * fin du `if state === empetre … else athletisme` dupliqué. Pin de la résolution (skill/opposé/source).
 */
const mk = (over: Partial<Combatant>): Combatant =>
  ({ id: 'c', name: 'C', kind: 'enemy', conditions: [], skills: [], characteristics: { force: 40, agilite: 35 } as never,
     wounds: { current: 10, max: 10 }, ...over } as unknown as Combatant);

describe('resolveRecoverTest (LDB 16 l.66/84) — données EtatData.recover', () => {
  it('En flammes : Test d’Athlétisme SIMPLE (l.84)', () => {
    const c = mk({ conditions: [{ id: 'en-flammes', value: 1 }] });
    const r = resolveRecoverTest(c, 'en-flammes')!;
    expect(r.opposition).toBeUndefined();
    expect(r.skillLabel).toBe('Athlétisme');
    expect(r.difficulty).toBe('intermediaire');
  });

  it('Empêtré + escapeStrength FIGÉE : Test OPPOSÉ de Force contre cette valeur (priorité, même source absente)', () => {
    const c = mk({ conditions: [{ id: 'empetre', value: 1, escapeStrength: 55, sourceId: 'ghost' }] });
    const r = resolveRecoverTest(c, 'empetre')!; // pas de battle → source vivante introuvable, mais escapeStrength prime
    expect(r.opposition).toBeDefined();
    expect(r.opposition?.value).toBe(55);
    expect(r.skillLabel).toBe('Force');
  });

  it('Empêtré + source VIVANTE (sans escapeStrength) : opposé contre la Force de la source', () => {
    const c = mk({ conditions: [{ id: 'empetre', value: 1, sourceId: 's' }] });
    const src = mk({ id: 's', label: 'Toile', characteristics: { force: 62 } as never });
    const r = resolveRecoverTest(c, 'empetre', { combatants: [c, src] })!;
    expect(r.opposition).toBeDefined();
    expect(r.opposition?.value).toBe(62); // Force de la source vivante
    expect(r.opposition?.label).toBe('Toile');
  });

  it('Empêtré sans source ni escapeStrength : Test SIMPLE (pas d’opposition)', () => {
    const c = mk({ conditions: [{ id: 'empetre', value: 1 }] });
    const r = resolveRecoverTest(c, 'empetre')!;
    expect(r.opposition).toBeUndefined();
    expect(r.skillLabel).toBe('Force');
  });

  it('État sans `recover` (Sonné) : non récupérable par Action → null', () => {
    const c = mk({ conditions: [{ id: 'sonne', value: 1 }] });
    expect(resolveRecoverTest(c, 'sonne')).toBeNull();
  });

  it('Empêtré (Filet, Zoo Impérial p.29) + escapeThreshold FIGÉ : Test NON opposé, DR ≥ Indice exigé', () => {
    const c = mk({ conditions: [{ id: 'empetre', value: 1, escapeThreshold: 3, sourceId: 'gobelin' }] });
    const r = resolveRecoverTest(c, 'empetre')!; // priorité sur escapeStrength/source vivante
    expect(r.opposition).toBeUndefined();
    expect(r.opposition?.value).toBeUndefined();
    expect(r.requireSl).toBe(3);
    expect(r.skillLabel).toBe('Force');
    expect(r.difficulty).toBe('intermediaire'); // Test de Force Intermédiaire (+0)
  });

  it('escapeThreshold prioritaire sur escapeStrength si les deux sont posées (mutuellement exclusifs en donnée)', () => {
    const c = mk({ conditions: [{ id: 'empetre', value: 1, escapeThreshold: 3, escapeStrength: 55 }] });
    const r = resolveRecoverTest(c, 'empetre')!;
    expect(r.requireSl).toBe(3);
    expect(r.opposition).toBeUndefined();
  });
});
