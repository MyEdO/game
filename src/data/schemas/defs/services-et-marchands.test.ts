/**
 * #2968 L17 — l'archétype de marchand (`lieux-services.json › merchantArchetype`, `SceneEntity.merchant.archetype`) se
 * désigne par `ref('merchant')`, le service de lieu (`MapPlace.services[].kind`, `PlacePoi.serviceKind`) par
 * `ref('serviceDeLieu')` : `{ id }` refiné au parse contre l'index des ids. Fixtures : référence connue, inconnue,
 * d'un autre catalogue, écrite en id nu, et liste des services d'un lieu.
 */
import { describe, expect, it } from 'vitest';
import type { z } from 'zod';
import { schema as schemaServices } from './lieux-services';
import { projetSchema } from '../defs-scenes/projet';
import { mesureDuParse } from '../grammaire/ref';
import { versDisque } from '../grammaire/prose';
import lieuxServicesJson from '../../lieux-services.json';
import areneProjet from '../../../scenes/arene/arene-projet.json';
import loupEtSaumureProjet from '../../../scenes/loup-et-saumure/loup-et-saumure-projet.json';

type Projet = typeof loupEtSaumureProjet;

const RANG_SCENE = loupEtSaumureProjet.scenes.findIndex((s) => s.id === 'ls-quai-salzenmund');
const RANG_MARCHAND = loupEtSaumureProjet.scenes[RANG_SCENE].entities.findIndex((e) => e.id === 'armurier');
const RANG_FORGERON = lieuxServicesJson.findIndex((s) => s.id === 'forgeron');

const messages = (schema: z.ZodType, doc: unknown): string => {
  const r = schema.safeParse(doc);
  expect(r.success, 'le document a parsé alors qu’il devait être REFUSÉ').toBe(false);
  return r.success ? '' : r.error.issues.map((i) => `${i.path.join('.')} ${i.message}`).join('\n');
};

/** Le projet Loup et saumure, retouché par `retouche` sur une copie. */
const projet = (retouche: (copie: Projet) => void): Projet => {
  const copie = structuredClone(loupEtSaumureProjet);
  retouche(copie);
  return copie;
};

const PORTEURS = [
  {
    porteur: 'lieux-services.json › merchantArchetype', schema: schemaServices, chemin: `${RANG_FORGERON}.merchantArchetype`,
    connue: 'herboriste', etrangere: 'forgeron', catalogue: 'archétypes de marchand',
    avec: (v: unknown) => lieuxServicesJson.map((s, i) => (i === RANG_FORGERON ? { ...s, merchantArchetype: v } : s)),
  },
  {
    porteur: 'scenes[].entities[].merchant.archetype', schema: projetSchema, chemin: `scenes.${RANG_SCENE}.entities.${RANG_MARCHAND}.merchant.archetype`,
    connue: 'maquignon', etrangere: 'temple', catalogue: 'archétypes de marchand',
    avec: (v: unknown) => projet((c) => Object.assign(c.scenes[RANG_SCENE].entities[RANG_MARCHAND], { merchant: { archetype: v } })),
  },
  {
    porteur: 'worldMap.places[].services[].kind', schema: projetSchema, chemin: 'worldMap.places.0.services.1.kind',
    connue: 'guilde', etrangere: 'armurier', catalogue: 'services de lieu',
    avec: (v: unknown) => projet((c) => Object.assign(c.worldMap.places[0].services[1], { kind: v })),
  },
  {
    porteur: 'worldMap.places[].poi[].serviceKind', schema: projetSchema, chemin: 'worldMap.places.0.poi.0.serviceKind',
    connue: 'temple', etrangere: 'armurier', catalogue: 'services de lieu',
    avec: (v: unknown) => projet((c) => Object.assign(c.worldMap.places[0].poi[0], { serviceKind: v })),
  },
];

describe('#2968 L17 — archétype de marchand et service de lieu désignés par `ref(type)`', () => {
  it('les documents réels parsent, et leurs références sont des slots au parse de mesure', () => {
    expect(schemaServices.safeParse(lieuxServicesJson).success).toBe(true);
    const compte = (lu: unknown, type: string) => {
      const doc = versDisque(lu);
      expect(projetSchema.safeParse(doc).success).toBe(true);
      return mesureDuParse(projetSchema, doc).reperes.filter((r) => r.type === type).length;
    };
    expect(compte(areneProjet, 'merchant')).toBe(4);
    expect(compte(loupEtSaumureProjet, 'merchant')).toBe(3);
    expect(compte(loupEtSaumureProjet, 'serviceDeLieu')).toBe(6 + 8);
  });

  it.each(PORTEURS)('$porteur : une référence connue parse', ({ schema, avec, connue }) => {
    expect(schema.safeParse(versDisque(avec({ id: connue }))).success).toBe(true);
  });

  it.each(PORTEURS)('$porteur : une référence inconnue est refusée à son path, son catalogue nommé', ({ schema, avec, chemin, catalogue }) => {
    expect(messages(schema, versDisque(avec({ id: 'cible-inexistante' })))).toContain(`${chemin}.id « cible-inexistante » est absent du catalogue des ${catalogue}`);
  });

  it.each(PORTEURS)('$porteur : l’id d’un autre catalogue est refusé', ({ schema, avec, etrangere, catalogue }) => {
    expect(messages(schema, versDisque(avec({ id: etrangere })))).toContain(`« ${etrangere} » est absent du catalogue des ${catalogue}`);
  });

  it.each(PORTEURS)('$porteur : une référence écrite en id nu est refusée', ({ schema, avec, connue }) => {
    expect(schema.safeParse(versDisque(avec(connue))).success).toBe(false);
  });

  it('les services d’un lieu forment une liste : chaque service se juge au catalogue', () => {
    const avecServices = (kinds: readonly string[]) => projet((c) => Object.assign(c.worldMap.places[1], { services: kinds.map((id) => ({ kind: { id } })) }));
    expect(projetSchema.safeParse(versDisque(avecServices(['auberge', 'guilde', 'temple']))).success).toBe(true);
    expect(messages(projetSchema, versDisque(avecServices(['auberge', 'service-inexistant'])))).toContain(
      'worldMap.places.1.services.1.kind.id « service-inexistant » est absent du catalogue des services de lieu',
    );
  });
});
