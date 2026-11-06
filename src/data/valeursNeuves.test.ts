import { describe, it, expect } from 'vitest';
import type { Condition } from '../engine/flowCore';
import { CONDITIONS_RESERVEES, conditionSchema } from './schemas/grammaire/mecanique';
import { customStatblockSchema } from './schemas/defs-scenes/communs';
import { semencesDeScene } from './index';
import { CONDITION_TOUJOURS, emptyStatblock, recast } from './valeursNeuves';

/** Valeur au chemin d'un refus de zod. */
const auChemin = (v: unknown, chemin: readonly PropertyKey[]): unknown =>
  chemin.reduce<unknown>((n, k) => (n && typeof n === 'object' ? (n as Record<PropertyKey, unknown>)[k] : undefined), v);

/** Les `kind` de Condition, lus au schéma (un `kind` refusé y est nommé dans son message). */
function kindsDeCondition(): Condition['kind'][] {
  const r = conditionSchema.safeParse({ kind: '__aucun__' });
  if (r.success) throw new Error('conditionSchema accepte un kind inconnu');
  const valeurs = r.error.issues.flatMap((i) => ('options' in i && Array.isArray(i.options) ? i.options : []));
  if (valeurs.length) return valeurs as Condition['kind'][];
  throw new Error(`kinds de Condition illisibles au refus : ${JSON.stringify(r.error.issues)}`);
}

describe('valeurs neuves de l’atelier en donnée (#3059)', () => {
  it('recast : chaque type de Condition hors famille réservée, depuis « Toujours », parse `conditionSchema` hors sentinelle vide', () => {
    const reservees: readonly string[] = CONDITIONS_RESERVEES;
    const kinds = kindsDeCondition().filter((k) => !reservees.includes(k));
    expect(kinds).toContain('flag');
    for (const k of kinds) {
      const c = recast(CONDITION_TOUJOURS, k);
      expect(c.kind, k).toBe(k);
      const r = conditionSchema.safeParse(c);
      const refus = r.success ? [] : r.error.issues.filter((i) => auChemin(c, i.path) !== '').map((i) => `${i.path.join('.')} : ${i.message}`);
      expect(refus, k).toEqual([]);
    }
  });

  it('emptyStatblock : conforme à `customStatblockSchema`, libellé de la semence sans nom', () => {
    const s = emptyStatblock();
    expect(customStatblockSchema.safeParse(s).success).toBe(true);
    expect(s.label).toBe(semencesDeScene.profil);
    expect(emptyStatblock('Gaspard').label).toBe('Gaspard');
  });
});
