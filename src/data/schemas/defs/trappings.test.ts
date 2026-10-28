/**
 * #2948 — le SCHÉMA de `trappings.json` refuse au parse une armure sans type d'armure : `subType` est l'id
 * d'un Groupe `kind: 'armour'` de `weaponGroups.json`, sur le document RÉEL. C'est la seule naissance d'une
 * `ItemInstance` d'armure (`itemFromTrappingById`, `src/engine/items.ts` ; un `custom` naît `misc`).
 */
import { describe, expect, it } from 'vitest';
import { schema } from './trappings';
import trappingsJson from '../../trappings.json';

type Entree = { id: string; categorie: string; subType: string | null; [k: string]: unknown };
const clone = (): Entree[] => structuredClone(trappingsJson) as unknown as Entree[];
const refus = (doc: unknown): string[] => {
  const r = schema.safeParse(doc);
  expect(r.success, 'le document a parsé alors qu’il devait être REFUSÉ').toBe(false);
  return r.success ? [] : r.error.issues.map((i) => i.message);
};

describe('trappings.json — une armure porte son type d’armure (#2948)', () => {
  it('le document réel parse', () => {
    expect(schema.safeParse(trappingsJson).success).toBe(true);
  });

  it.each([
    ['sans subType', null],
    ['à subType de Groupe d’arme', 'escrime'],
    ['à subType inconnu', 'rembourre'],
  ])('une armure %s est refusée, nommément', (_cas, subType) => {
    const doc = clone();
    const heaume = doc.find((t) => t.id === 'heaume')!;
    heaume.subType = subType;
    expect(refus(doc).some((m) => m.startsWith("heaume : une armure porte un type d'armure"))).toBe(true);
  });

  it('un objet hors armure garde un subType libre', () => {
    const doc = clone();
    const objet = doc.find((t) => t.categorie === 'trapping')!;
    objet.subType = null;
    expect(schema.safeParse(doc).success).toBe(true);
  });
});

describe('trappings.json — `shape` et `formChoices` sont des racines du catalogue des apparences (#2948)', () => {
  const arme = (doc: Entree[]) => doc.find((t) => t.id === 'arme-simple')!;

  it('une `shape` inconnue du catalogue est refusée, nommément', () => {
    const doc = clone();
    arme(doc).shape = { id: 'epee-inexistante' };
    expect(refus(doc).join(' ')).toMatch(/« epee-inexistante » est absent du catalogue des apparences \(apparences\.json\)/);
  });

  it('un id de `formChoices` inconnu du catalogue est refusé, nommément', () => {
    const doc = clone();
    arme(doc).formChoices = ['epee', 'hache-inexistante'];
    expect(refus(doc).join(' ')).toMatch(/« hache-inexistante » est absent du catalogue des apparences/);
  });

  it('une armure sans `shape` est refusée, nommément', () => {
    const doc = clone();
    delete doc.find((t) => t.id === 'heaume')!.shape;
    expect(refus(doc)).toContain('heaume : une armure porte sa forme (`shape`, racine de apparences.json)');
  });
});
