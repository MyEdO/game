/**
 * #2968 L17, concept « fond » (#2968 P-art) — la bande d'ambiance se désigne par `ref('fond')` (`{ id }` refiné au
 * parse contre l'espace `vocabulaire:fonds`, projection du registre `src/data/fonds/defs`). Fixtures : référence
 * connue, inconnue, d'une autre portée, et écrite en id nu, sur chaque porteur.
 */
import { describe, expect, it } from 'vitest';
import type { z } from 'zod';
import { schema as schemaServices } from './lieux-services';
import { landMarketProfileSchema, mapPlaceSchema } from '../defs-scenes/worldmap';
import lieuxServicesJson from '../../lieux-services.json';
import loupEtSaumureJson from '../../../scenes/loup-et-saumure/loup-et-saumure-projet.json';

const PLACE = loupEtSaumureJson.worldMap.places[0];
const MARCHE = { taille: 2, richesse: 3, produits: [] };

const messages = (schema: z.ZodType, doc: unknown): string => {
  const r = schema.safeParse(doc);
  expect(r.success, 'le document a parsé alors qu’il devait être REFUSÉ').toBe(false);
  return r.success ? '' : r.error.issues.map((i) => i.message).join(' ');
};

const PORTEURS: readonly { porteur: string; schema: z.ZodType; avec: (fond: unknown) => unknown }[] = [
  { porteur: 'lieux-services.json › backdrop', schema: schemaServices, avec: (fond) => [{ ...structuredClone(lieuxServicesJson[0]), backdrop: fond }] },
  { porteur: 'MapPlace.backdrop', schema: mapPlaceSchema, avec: (fond) => ({ ...structuredClone(PLACE), backdrop: fond }) },
  { porteur: 'LandMarketProfile.backdrop', schema: landMarketProfileSchema, avec: (fond) => ({ ...MARCHE, backdrop: fond }) },
];

describe('#2968 L17 — la bande d’ambiance désignée par `ref(\'fond\')`', () => {
  it('les porteurs réels parsent', () => {
    expect(schemaServices.safeParse(lieuxServicesJson).success).toBe(true);
    expect(mapPlaceSchema.safeParse(PLACE).success).toBe(true);
  });

  it.each(PORTEURS)('$porteur : une référence connue parse', ({ schema, avec }) => {
    expect(schema.safeParse(avec({ id: 'halle-marchande' })).success).toBe(true);
  });

  it.each(PORTEURS)('$porteur : une référence inconnue est refusée, son catalogue et son registre nommés', ({ schema, avec }) => {
    expect(messages(schema, avec({ id: 'fond-inexistant' }))).toContain(
      '« fond-inexistant » est absent du catalogue des bandes d’ambiance (vocabulaire:fonds, registre src/data/fonds/defs)',
    );
  });

  it.each(PORTEURS)('$porteur : un id d’une autre portée (un service de lieu) est refusé', ({ schema, avec }) => {
    expect(messages(schema, avec({ id: 'auberge' }))).toContain('« auberge » est absent du catalogue des bandes d’ambiance');
  });

  it.each(PORTEURS)('$porteur : une référence écrite en id nu est refusée', ({ schema, avec }) => {
    expect(schema.safeParse(avec('port')).success).toBe(false);
  });
});
