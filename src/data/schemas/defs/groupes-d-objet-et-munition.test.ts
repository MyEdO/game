/**
 * #2968 L07 — le Groupe d'objet et la munition représentative se désignent par `ref(type)` (`{ id }` refiné
 * au parse contre l'index des ids), une liste de Groupes par `refs('weaponGroup')`. Fixtures : référence
 * connue, inconnue, écrite en id nu, hors de sa sous-liste, et liste.
 */
import { describe, expect, it } from 'vitest';
import type { z } from 'zod';
import { schema as schemaEngins } from './siege-engines';
import { schema as schemaObjets } from './trappings';
import { schema as schemaMarchands } from './merchants';
import trappingsJson from '../../trappings.json';
import enginsJson from '../../siege-engines.json';
import merchantsJson from '../../merchants.json';
import { versDisque } from '../grammaire/prose';

type Entree = Record<string, unknown>;

/** Un document d'une entrée : `entree` du document réel, portant `cle` à `valeur`. */
const avec = (entree: Entree, cle: string, valeur: unknown): Entree[] => [{ ...structuredClone(entree), [cle]: valeur }];

const messages = (schema: z.ZodType, doc: unknown): string => {
  const r = schema.safeParse(doc);
  expect(r.success, 'le document a parsé alors qu’il devait être REFUSÉ').toBe(false);
  return r.success ? '' : r.error.issues.map((i) => i.message).join(' ');
};

/** Les champs d'une valeur objet, aucun sinon. */
const champsDe = (v: unknown): Entree => (typeof v === 'object' && v !== null ? { ...v } : {});

const objets: readonly Entree[] = versDisque(trappingsJson);
const objet = (id: string): Entree => {
  const e = objets.find((t) => t.id === id);
  expect(e, `${id} absent de trappings.json`).toBeDefined();
  return e ?? {};
};
const crochet = objet('crochet');
const baliste = versDisque(enginsJson).find((e) => e.id === 'baliste')!;
/** Le Crochet, son arme dérivée portant `subType` à `valeur`. */
const crochetDerive = (valeur: unknown): Entree[] => [{ ...structuredClone(crochet), derivedWeapon: { ...structuredClone(champsDe(crochet.derivedWeapon)), subType: valeur } }];

const PORTEURS = [
  { porteur: 'trappings.json › subType', schema: schemaObjets, doc: (v: unknown) => avec(objet('baton-de-combat'), 'subType', v), connue: 'armes-d-hast', refus: 'est absent du catalogue des groupes d’armes' },
  { porteur: 'siege-engines.json › weaponGroup', schema: schemaEngins, doc: (v: unknown) => avec(baliste, 'weaponGroup', v), connue: 'arbalete', refus: 'est absent du catalogue des groupes d’armes' },
  { porteur: 'trappings.json › derivedWeapon.subType', schema: schemaObjets, doc: crochetDerive, connue: 'base', refus: 'est absent du catalogue des groupes d’armes' },
];

describe('#2968 L07 — Groupe d’objet et munition désignés par `ref(type)`', () => {
  it('les documents réels parsent', () => {
    expect(schemaObjets.safeParse(versDisque(trappingsJson)).success).toBe(true);
    expect(schemaEngins.safeParse(versDisque(enginsJson)).success).toBe(true);
    expect(schemaMarchands.safeParse(merchantsJson).success).toBe(true);
  });

  it.each(PORTEURS)('$porteur : une référence connue parse', ({ schema, doc, connue }) => {
    expect(schema.safeParse(doc({ id: connue })).success).toBe(true);
  });

  it.each(PORTEURS)('$porteur : une référence inconnue est refusée, son catalogue nommé', ({ schema, doc, refus }) => {
    expect(messages(schema, doc({ id: 'cible-inexistante' }))).toContain(`« cible-inexistante » ${refus}`);
  });

  it.each(PORTEURS)('$porteur : une référence écrite en id nu est refusée', ({ schema, doc, connue }) => {
    expect(schema.safeParse(doc(connue)).success).toBe(false);
  });

  it('siege-engines.json › munitions : un objet hors des munitions est refusé, sa sous-liste nommée', () => {
    expect(schemaEngins.safeParse(avec(baliste, 'munitions', ['carreau-de-baliste'])).success).toBe(true);
    expect(messages(schemaEngins, avec(baliste, 'munitions', ['dague']))).toContain('« dague » est hors de la sous-liste « ammunition » du catalogue des objets');
  });

  describe('merchants.json › category.subTypes : liste de Groupes (`refs`)', () => {
    const marchands: readonly Entree[] = merchantsJson;
    const porteuse = marchands.findIndex((m) => champsDe(m.category).subTypes !== undefined);
    const avecGroupes = (subTypes: unknown): Entree[] => {
      const copie = marchands.map((m) => structuredClone(m));
      copie[porteuse] = { ...copie[porteuse], category: { subTypes } };
      return copie;
    };

    it('une liste de Groupes connus parse', () => {
      expect(porteuse).toBeGreaterThanOrEqual(0);
      expect(schemaMarchands.safeParse(avecGroupes(['herbes-et-potions', 'protheses'])).success).toBe(true);
    });

    it('un Groupe inconnu dans la liste est refusé, son catalogue nommé', () => {
      expect(messages(schemaMarchands, avecGroupes(['herbes-et-potions', 'groupe-inexistant']))).toContain('« groupe-inexistant » est absent du catalogue des groupes d’armes');
    });
  });
});
