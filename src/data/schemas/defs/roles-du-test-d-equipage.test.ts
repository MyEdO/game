/**
 * #2968 L10 — les rôles d'un type de Test d'équipage se désignent par leur catalogue (`crew-roles.json`) :
 * le rôle essentiel par `ref('crewRole')` (`{ id }` refiné au parse contre l'index des ids), les rôles
 * contributeurs par `refs('crewRole')`. Fixtures : référence connue, inconnue, écrite en id nu, et liste.
 */
import { describe, expect, it } from 'vitest';
import type { z } from 'zod';
import { schema } from './crew-test-types';
import crewTestTypesJson from '../../crew-test-types.json';

/** Le document réel, son premier type de Test portant `cle` à `valeur`. */
const avec = (cle: string, valeur: unknown): unknown => {
  const copie = structuredClone(crewTestTypesJson);
  return { ...copie, types: copie.types.map((t, i) => (i === 0 ? { ...t, [cle]: valeur } : t)) };
};

const messages = (s: z.ZodType, doc: unknown): string => {
  const r = s.safeParse(doc);
  expect(r.success, 'le document a parsé alors qu’il devait être REFUSÉ').toBe(false);
  return r.success ? '' : r.error.issues.map((i) => i.message).join(' ');
};

describe('#2968 L10 — rôles du Test d’équipage désignés par leur catalogue', () => {
  it('crew-test-types.json › types[].essential : le document réel et une référence connue parsent', () => {
    expect(schema.safeParse(crewTestTypesJson).success).toBe(true);
    expect(schema.safeParse(avec('essential', { id: 'vigie' })).success).toBe(true);
  });

  it('crew-test-types.json › types[].essential : une référence inconnue est refusée, son catalogue nommé', () => {
    expect(messages(schema, avec('essential', { id: 'role-inexistant' }))).toContain('« role-inexistant » est absent du catalogue des rôles d’équipage');
  });

  it('crew-test-types.json › types[].essential : une référence écrite en id nu est refusée', () => {
    expect(schema.safeParse(avec('essential', 'capitaine')).success).toBe(false);
  });

  describe('crew-test-types.json › types[].roles : liste de rôles (`refs`)', () => {
    it('une liste de rôles connus parse', () => {
      expect(schema.safeParse(avec('roles', ['capitaine', 'vigie'])).success).toBe(true);
    });

    it('un rôle inconnu dans la liste est refusé, son catalogue nommé', () => {
      expect(messages(schema, avec('roles', ['capitaine', 'role-inexistant']))).toContain('« role-inexistant » est absent du catalogue des rôles d’équipage');
    });
  });
});
