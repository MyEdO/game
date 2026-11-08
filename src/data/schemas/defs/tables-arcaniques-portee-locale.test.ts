/**
 * #2968 P-local — la table d'un phénomène arcanique se désigne par `ref(portee)` (`{ id }` jugé au parse contre
 * la collection `tables` du MÊME document, que la racine ouvre par `ouvrirPortees`). Fixtures : référence connue,
 * inconnue, écrite en id nu, d'un AUTRE document, et portée locale (la collection du document fait foi, pas un
 * catalogue global).
 */
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { schema } from './arcane-phenomena';
import arcaneJson from '../../arcane-phenomena.json';
import tablesJson from '../../tables.json';
import { IDS_PAR_ESPACE } from '../_ids.generated';
import { listeCle, ouvrirPortees } from '../grammaire/collection-cle';
import { mesureDuParse, ref, type PorteeLocale } from '../grammaire/ref';

type Entree = Record<string, unknown>;

const messages = (doc: unknown): string => {
  const r = schema.safeParse(doc);
  expect(r.success, 'le document a parsé alors qu’il devait être REFUSÉ').toBe(false);
  return r.success ? '' : r.error.issues.map((i) => i.message).join(' ');
};

/** Le document, le phénomène `id` portant `cle` à `valeur`. */
const avec = (id: string, cle: string, valeur: unknown): Entree => ({
  ...structuredClone(arcaneJson),
  phenomena: arcaneJson.phenomena.map((p: Entree) => (p.id === id ? { ...structuredClone(p), [cle]: valeur } : p)),
});

const PORTEURS = [
  { porteur: 'arcane-phenomena.json › phenomena[].fluxTableId', phenomene: 'tempete-de-magie', cle: 'fluxTableId', connue: 'vdm-corruption-chaotique' },
  { porteur: 'arcane-phenomena.json › phenomena[].tableId', phenomene: 'corruption-chaotique', cle: 'tableId', connue: 'vdm-flux-magique' },
];

describe('#2968 P-local — les tables arcaniques désignées par `ref(portee)`', () => {
  it('le document réel parse, et ses trois références sont des slots `local:tables` au parse de mesure', () => {
    expect(schema.safeParse(arcaneJson).success).toBe(true);
    const locales = mesureDuParse(schema, arcaneJson).reperes.filter((r) => r.type === 'local:tables');
    const rang = (id: string) => arcaneJson.phenomena.findIndex((p) => p.id === id);
    expect(locales).toEqual([
      { path: ['phenomena', rang('tempete-de-magie'), 'fluxTableId', 'id'], type: 'local:tables', parCle: false },
      { path: ['phenomena', rang('corruption-chaotique'), 'tableId', 'id'], type: 'local:tables', parCle: false },
      { path: ['phenomena', rang('corruption-necromantique'), 'tableId', 'id'], type: 'local:tables', parCle: false },
    ]);
  });

  it.each(PORTEURS)('$porteur : une référence connue parse', ({ phenomene, cle, connue }) => {
    expect(schema.safeParse(avec(phenomene, cle, { id: connue })).success).toBe(true);
  });

  it.each(PORTEURS)('$porteur : une référence inconnue est refusée à son path, sa collection et son id nommés', ({ phenomene, cle }) => {
    const r = schema.safeParse(avec(phenomene, cle, { id: 'table-inconnue' }));
    expect(r.success).toBe(false);
    expect(r.error?.issues.map((i) => [i.path.join('.'), i.message])).toEqual([
      [`phenomena.${arcaneJson.phenomena.findIndex((p) => p.id === phenomene)}.${cle}.id`, '« table-inconnue » est absent du catalogue des tables arcaniques (collection « tables » du document).'],
    ]);
  });

  it.each(PORTEURS)('$porteur : une référence écrite en id nu est refusée', ({ phenomene, cle, connue }) => {
    expect(schema.safeParse(avec(phenomene, cle, connue)).success).toBe(false);
  });

  it.each(PORTEURS)('$porteur : l’id d’une table d’un AUTRE document (`tables.json`) est refusé', ({ phenomene, cle }) => {
    const etrangere = tablesJson[0].id;
    expect(arcaneJson.tables.some((t) => t.id === etrangere), 'la table étrangère doit être absente du document').toBe(false);
    expect(messages(avec(phenomene, cle, { id: etrangere }))).toContain(`« ${etrangere} » est absent du catalogue des tables arcaniques`);
  });

  it('la portée est LOCALE : la collection du document fait foi, une table ajoutée est désignable, une table retirée ne l’est plus', () => {
    const ajoutee = { ...structuredClone(arcaneJson.tables[0]), id: 'table-du-document' };
    const doc = avec('tempete-de-magie', 'fluxTableId', { id: 'table-du-document' });
    expect(schema.safeParse({ ...doc, tables: [...arcaneJson.tables, ajoutee] }).success).toBe(true);
    const sansFlux = { ...structuredClone(arcaneJson), tables: arcaneJson.tables.filter((t) => t.id !== 'vdm-flux-magique') };
    expect(messages(sansFlux)).toContain('« vdm-flux-magique » est absent du catalogue des tables arcaniques');
  });

  it('un id local n’entre dans aucun espace de l’INDEX DES IDS', () => {
    expect(Object.keys(IDS_PAR_ESPACE).filter((c) => c.startsWith('arcane-phenomena.json'))).toEqual([]);
  });

  it('la collection d’une portée est une liste à clé : une table en double est refusée', () => {
    expect(messages({ ...structuredClone(arcaneJson), tables: [...arcaneJson.tables, structuredClone(arcaneJson.tables[0])] })).toContain('dupliqué');
  });
});

describe('`ouvrirPortees` — FAIL-FAST à la construction', () => {
  const element = z.strictObject({ id: z.string() });

  it('une collection qui n’est pas une liste à clé', () => {
    const portee: PorteeLocale = { collection: 'liste', catalogue: 'éléments' };
    expect(() => ouvrirPortees(z.strictObject({ liste: z.array(element), cible: ref(portee) }), [portee])).toThrow(/n’est aucune liste à clé/);
  });

  it('une collection marquée `espace`', () => {
    const portee: PorteeLocale = { collection: 'liste', catalogue: 'éléments' };
    expect(() => ouvrirPortees(z.strictObject({ liste: listeCle(element, 'id', { espace: {} }), cible: ref(portee) }), [portee])).toThrow(/un id local n’entre dans aucun catalogue global/);
  });

  it('une portée qu’aucune référence de l’arbre ne désigne', () => {
    const portee: PorteeLocale = { collection: 'liste', catalogue: 'éléments' };
    expect(() => ouvrirPortees(z.strictObject({ liste: listeCle(element, 'id') }), [portee])).toThrow(/n’a aucune référence/);
  });
});
