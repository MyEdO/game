/**
 * #2972 — ce que les SCHÉMAS tiennent au parse : une carrure de `gabarits.json` porte des facteurs
 * strictement positifs, et une race de `raceAppearance.json` nomme un gabarit EXISTANT et ne surcharge
 * que ses facteurs.
 */
import { describe, expect, it } from 'vitest';
import { schema } from './gabarits';
import { schema as schemaRaces } from './raceAppearance';
import gabaritsJson from '../../gabarits.json';
import raceAppearanceJson from '../../raceAppearance.json';

type Entree = { id: string; [k: string]: unknown };
const races = (): Entree[] => structuredClone(raceAppearanceJson) as Entree[];
const avecRace = (champs: Record<string, unknown>): Entree[] => {
  const doc = races();
  const humain = doc.find((r) => r.id === 'humain')!;
  delete humain.gabaritOverride;
  Object.assign(humain, champs);
  return doc;
};
const refus = (s: typeof schema, doc: unknown): string => {
  const r = s.safeParse(doc);
  expect(r.success, 'le document a parsé alors qu’il devait être REFUSÉ').toBe(false);
  return r.success ? '' : r.error.issues.map((i) => i.message).join(' ');
};

describe('gabarits.json — facteurs de carrure (#2972)', () => {
  it('le document réel parse', () => {
    expect(schema.safeParse(gabaritsJson).success).toBe(true);
  });

  it('un facteur requis absent ou non positif est refusé', () => {
    const [premier, ...reste] = structuredClone(gabaritsJson) as Entree[];
    const { legs: _legs, ...sansJambes } = premier;
    refus(schema, [sansJambes, ...reste]);
    refus(schema, [{ ...premier, st: 0 }, ...reste]);
    refus(schema, [{ ...premier, head: -1 }, ...reste]);
  });
});

describe('raceAppearance.json — gabarit par référence, surcharge fermée (#2972)', () => {
  it('le document réel parse', () => {
    expect(schemaRaces.safeParse(raceAppearanceJson).success).toBe(true);
  });

  it('un id de gabarit inconnu est refusé, nommément', () => {
    expect(refus(schemaRaces, avecRace({ gabarit: { id: 'humain' } }))).toMatch(/« humain » est absent du catalogue des gabarits/);
  });

  it('une surcharge partielle des facteurs parse', () => {
    expect(schemaRaces.safeParse(avecRace({ gabaritOverride: { legs: 0.9, head: 1.1 } })).success).toBe(true);
  });

  it('une clé de surcharge inconnue ou un facteur non positif est refusé', () => {
    refus(schemaRaces, avecRace({ gabaritOverride: { jambes: 0.9 } }));
    refus(schemaRaces, avecRace({ gabaritOverride: { sl: 0 } }));
  });
});
