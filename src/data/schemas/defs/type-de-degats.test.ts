/**
 * #2968 — le Type de Dégâts se désigne par `ref('damageType')` (`{ id }` refiné au parse contre l'index des
 * ids). Fixtures : référence connue, inconnue, écrite en id nu.
 */
import { describe, expect, it } from 'vitest';
import type { z } from 'zod';
import { schema as schemaSouffles } from './breath-types';
import { schema as schemaEtats } from './etats';
import { versDisque } from '../grammaire/prose';
import breathTypesJson from '../../breath-types.json';
import etatsJson from '../../etats.json';

type Entree = Record<string, unknown>;

/** Le document réel, son entrée qui porte `cle` y portant `valeur`. */
const avec = (doc: readonly Entree[], cle: string, valeur: unknown): Entree[] => doc.map((e) => (cle in e ? { ...e, [cle]: valeur } : e));

const messages = (schema: z.ZodType, doc: unknown): string => {
  const r = schema.safeParse(doc);
  expect(r.success, 'le document a parsé alors qu’il devait être REFUSÉ').toBe(false);
  return r.success ? '' : r.error.issues.map((i) => i.message).join(' ');
};

const PORTEURS = [
  { porteur: 'breath-types.json › typeDeDegats', schema: schemaSouffles, doc: breathTypesJson, connue: 'feu' },
  { porteur: 'etats.json › typeDeDegats', schema: schemaEtats, doc: versDisque(etatsJson), connue: 'poison' },
];

describe('#2968 — Type de Dégâts désigné par `ref(\'damageType\')`', () => {
  it.each(PORTEURS)('$porteur : le document réel et une référence connue parsent', ({ schema, doc, connue }) => {
    expect(doc.some((e) => 'typeDeDegats' in e)).toBe(true);
    expect(schema.safeParse(doc).success).toBe(true);
    expect(schema.safeParse(avec(doc, 'typeDeDegats', { id: connue })).success).toBe(true);
  });

  it.each(PORTEURS)('$porteur : une référence inconnue est refusée, son catalogue nommé', ({ schema, doc }) => {
    expect(messages(schema, avec(doc, 'typeDeDegats', { id: 'cible-inexistante' }))).toContain('« cible-inexistante » est absent du catalogue des types de Dégâts');
  });

  it.each(PORTEURS)('$porteur : une référence écrite en id nu est refusée', ({ schema, doc, connue }) => {
    expect(schema.safeParse(avec(doc, 'typeDeDegats', connue)).success).toBe(false);
  });
});
