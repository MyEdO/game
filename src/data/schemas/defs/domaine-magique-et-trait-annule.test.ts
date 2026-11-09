/**
 * #2968 L02 — le Domaine de magie et le Trait annulé par un phénomène arcanique se désignent par `ref(type)`
 * (`{ id }` refiné au parse contre l'index des ids), une liste de Domaines par `refs('domain')`. Fixtures :
 * référence connue, inconnue, écrite en id nu, et liste.
 */
import { describe, expect, it } from 'vitest';
import type { z } from 'zod';
import { schema as schemaSorts } from './spells';
import { schema as schemaPhenomenes } from './arcane-phenomena';
import { schema as schemaTypesDeDegats } from './damage-types';
import { schema as schemaTraits } from './traits';
import type spellsDoc from '../../spells.json';
import type phenomenesDoc from '../../arcane-phenomena.json';
import type damageTypesDoc from '../../damage-types.json';
import type traitsDoc from '../../traits.json';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/** Le document tel qu'il est écrit : l'import JSON est hydraté au chargement des données (`descRef`). */
const lu = <T>(fichier: string): T => JSON.parse(readFileSync(join(process.cwd(), 'src/data', fichier), 'utf8'));
const spellsJson = lu<typeof spellsDoc>('spells.json');
const phenomenesJson = lu<typeof phenomenesDoc>('arcane-phenomena.json');
const damageTypesJson = lu<typeof damageTypesDoc>('damage-types.json');
const traitsJson = lu<typeof traitsDoc>('traits.json');

const messages = (schema: z.ZodType, doc: unknown): string => {
  const r = schema.safeParse(doc);
  expect(r.success, 'le document a parsé alors qu’il devait être REFUSÉ').toBe(false);
  return r.success ? '' : r.error.issues.map((i) => i.message).join(' ');
};

/** Le document `doc` où l'entrée d'id `id` passe par `change`. */
const entreeChangee = <T extends { readonly id: string }>(doc: readonly T[], id: string, change: (e: T) => unknown): unknown[] => {
  expect(doc.some((e) => e.id === id), `aucune entrée « ${id} » : le cas n’est plus exerçable`).toBe(true);
  return doc.map((e) => (e.id === id ? change(structuredClone(e)) : e));
};

const DOMAINES = 'est absent du catalogue des domaines';

const PORTEURS = [
  { porteur: 'spells.json › domainId', schema: schemaSorts, doc: (v: unknown) => entreeChangee(spellsJson, 'forme-bestiale', (e) => ({ ...e, domainId: v })), connue: 'feu', refus: DOMAINES },
  { porteur: 'arcane-phenomena.json › windSaturationEffects[].domainId', schema: schemaPhenomenes, doc: (v: unknown) => ({ ...phenomenesJson, windSaturationEffects: entreeChangee(phenomenesJson.windSaturationEffects, 'saturation-vie', (e) => ({ ...e, domainId: v })) }), connue: 'cieux', refus: DOMAINES },
  { porteur: 'damage-types.json › domaine', schema: schemaTypesDeDegats, doc: (v: unknown) => entreeChangee(damageTypesJson, 'magie-flamboyante', (e) => ({ ...e, domaine: v })), connue: 'mort', refus: DOMAINES },
  {
    porteur: 'traits.json › capabilities.spellDomainImmunity',
    schema: schemaTraits,
    doc: (v: unknown) => entreeChangee(traitsJson, 'manifestation-de-ghur', (e) => ({ ...e, capabilities: { ...e.capabilities, spellDomainImmunity: v } })),
    connue: 'vie',
    refus: DOMAINES,
  },
  { porteur: 'arcane-phenomena.json › phenomena[].cancelsTraitId', schema: schemaPhenomenes, doc: (v: unknown) => ({ ...phenomenesJson, phenomena: entreeChangee(phenomenesJson.phenomena, 'reserve-de-dhar', (e) => ({ ...e, cancelsTraitId: v })) }), connue: 'magique', refus: 'est absent du catalogue des traits' },
];

/** Porteurs d'une LISTE de Domaines : le document où la liste vaut `liste`. */
const LISTES = [
  { porteur: 'spells.json › ritual.domains', schema: schemaSorts, doc: (liste: unknown) => entreeChangee(spellsJson, 'corrompre-une-pierre-gardienne', (e) => ({ ...e, ritual: { ...e.ritual, domains: liste } })) },
  {
    porteur: 'spells.json › ritual.reduced.domains',
    schema: schemaSorts,
    doc: (liste: unknown) => entreeChangee(spellsJson, 'art-de-la-malediction', (e) => ({ ...e, ritual: { ...e.ritual, reduced: { ...e.ritual?.reduced, domains: liste } } })),
  },
  {
    porteur: 'arcane-phenomena.json › phenomena[].testMods[].scope.domains',
    schema: schemaPhenomenes,
    doc: (liste: unknown) => ({ ...phenomenesJson, phenomena: entreeChangee(phenomenesJson.phenomena, 'pierre-gardienne-refraction', (e) => ({ ...e, testMods: e.testMods?.map((m, i) => (i === 0 ? { ...m, scope: { domains: liste } } : m)) })) }),
  },
  {
    porteur: 'arcane-phenomena.json › phenomena[].testMods[].scope.domainsExcept',
    schema: schemaPhenomenes,
    doc: (liste: unknown) => ({ ...phenomenesJson, phenomena: entreeChangee(phenomenesJson.phenomena, 'pierre-gardienne-refraction', (e) => ({ ...e, testMods: e.testMods?.map((m, i) => (i === 1 ? { ...m, scope: { domainsExcept: liste } } : m)) })) }),
  },
  {
    porteur: 'arcane-phenomena.json › phenomena[].niMods[].scope.domains',
    schema: schemaPhenomenes,
    doc: (liste: unknown) => ({ ...phenomenesJson, phenomena: entreeChangee(phenomenesJson.phenomena, 'caverne-de-l-attache', (e) => ({ ...e, niMods: e.niMods?.map((m) => ({ ...m, scope: { ...m.scope, domains: liste } })) })) }),
  },
  {
    porteur: 'arcane-phenomena.json › tables[].entries[].domainIds',
    schema: schemaPhenomenes,
    doc: (liste: unknown) => ({ ...phenomenesJson, tables: entreeChangee(phenomenesJson.tables, 'vdm-flux-magique', (e) => ({ ...e, entries: e.entries.map((r, i) => (i === 0 ? { ...r, domainIds: liste } : r)) })) }),
  },
];

describe('#2968 L02 — Domaine de magie et Trait annulé désignés par `ref(type)`', () => {
  it.each(PORTEURS)('$porteur : le document réel et une référence connue parsent', ({ schema, doc, connue }) => {
    expect(schema.safeParse(doc({ id: connue })).success).toBe(true);
  });

  it.each(PORTEURS)('$porteur : une référence inconnue est refusée, son catalogue nommé', ({ schema, doc, refus }) => {
    expect(messages(schema, doc({ id: 'cible-inexistante' }))).toContain(`« cible-inexistante » ${refus}`);
  });

  it.each(PORTEURS)('$porteur : une référence écrite en id nu est refusée', ({ schema, doc, connue }) => {
    expect(schema.safeParse(doc(connue)).success).toBe(false);
  });

  it.each(LISTES)('$porteur : une liste de Domaines connus parse', ({ schema, doc }) => {
    expect(schema.safeParse(doc(['feu', 'bete'])).success).toBe(true);
  });

  it.each(LISTES)('$porteur : un Domaine inconnu dans la liste est refusé, son catalogue nommé', ({ schema, doc }) => {
    expect(messages(schema, doc(['feu', 'domaine-inexistant']))).toContain(`« domaine-inexistant » ${DOMAINES}`);
  });
});
