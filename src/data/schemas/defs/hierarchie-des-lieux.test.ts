/**
 * #2968 L08 — le lieu parent se désigne par `ref('location')` (`{ id }` refiné au parse contre l'index des
 * ids) ; un lieu racine porte `null`. Fixtures : référence connue, inconnue, écrite en id nu, racine.
 */
import { describe, expect, it } from 'vitest';
import { schema } from './locations';
import locationsJson from '../../locations.json';

/** Le document réel, son premier lieu portant `parent` à `valeur`. */
const avecParent = (valeur: unknown): unknown[] => {
  const copie: Record<string, unknown>[] = structuredClone(locationsJson);
  copie[0] = { ...copie[0], parent: valeur };
  return copie;
};

describe('#2968 L08 — hiérarchie des lieux par `ref(\'location\')`', () => {
  it('locations.json › parent : le document réel, une référence connue et une racine parsent', () => {
    expect(schema.safeParse(locationsJson).success).toBe(true);
    expect(schema.safeParse(avecParent({ id: 'hagercrybs' })).success).toBe(true);
    expect(schema.safeParse(avecParent(null)).success).toBe(true);
  });

  it('locations.json › parent : une référence inconnue est refusée, son catalogue nommé', () => {
    const r = schema.safeParse(avecParent({ id: 'cible-inexistante' }));
    expect(r.success).toBe(false);
    expect(r.success ? '' : r.error.issues.map((i) => i.message).join(' ')).toContain('« cible-inexistante » est absent du catalogue des lieux');
  });

  it('locations.json › parent : une référence écrite en id nu est refusée', () => {
    expect(schema.safeParse(avecParent('hagercrybs')).success).toBe(false);
  });
});
