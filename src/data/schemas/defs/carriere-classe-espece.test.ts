/**
 * #2968 L03 — la Carrière, la Classe de Carrière et l'espèce jouable se désignent par `ref(type)` (`{ id }`
 * refiné au parse contre l'index des ids), une liste de Classes par `refs('classe')`. Fixtures : référence
 * connue, inconnue, écrite en id nu, et liste.
 */
import { describe, expect, it } from 'vitest';
import type { z } from 'zod';
import { schema as schemaNiveaux } from './careerLevels';
import { schema as schemaCarrieres } from './careers';
import { schema as schemaPretires } from './pregens';
import { schema as schemaActivites } from './activities';
import careerLevelsJson from '../../careerLevels.json';
import careersJson from '../../careers.json';
import pregensJson from '../../pregens.json';
import activitiesJson from '../../activities.json';
import { versDisque } from '../grammaire/prose';

type Entree = Record<string, unknown>;

/** Le document réel, sa première entrée portant `cle` à `valeur`. */
const avec = (doc: readonly Entree[], cle: string, valeur: unknown): Entree[] => [{ ...structuredClone(doc[0]), [cle]: valeur }, ...doc.slice(1)];

const messages = (schema: z.ZodType, doc: unknown): string => {
  const r = schema.safeParse(doc);
  expect(r.success, 'le document a parsé alors qu’il devait être REFUSÉ').toBe(false);
  return r.success ? '' : r.error.issues.map((i) => i.message).join(' ');
};

const PORTEURS = [
  { porteur: 'careerLevels.json › career', schema: schemaNiveaux, doc: careerLevelsJson, cle: 'career', connue: 'agitateur', catalogue: 'carrières' },
  { porteur: 'careers.json › class', schema: schemaCarrieres, doc: careersJson, cle: 'class', connue: 'roublards', catalogue: 'classes de carrière' },
  { porteur: 'pregens.json › species', schema: schemaPretires, doc: versDisque(pregensJson), cle: 'species', connue: 'nains', catalogue: 'espèces' },
];

describe('#2968 L03 — Carrière, Classe et espèce désignées par `ref(type)`', () => {
  it.each(PORTEURS)('$porteur : le document réel et une référence connue parsent', ({ schema, doc, cle, connue }) => {
    expect(schema.safeParse(doc).success).toBe(true);
    expect(schema.safeParse(avec(doc, cle, { id: connue })).success).toBe(true);
  });

  it.each(PORTEURS)('$porteur : une référence inconnue est refusée, son catalogue nommé', ({ schema, doc, cle, catalogue }) => {
    expect(messages(schema, avec(doc, cle, { id: 'cible-inexistante' }))).toContain(`« cible-inexistante » est absent du catalogue des ${catalogue}`);
  });

  it.each(PORTEURS)('$porteur : une référence écrite en id nu est refusée', ({ schema, doc, cle, connue }) => {
    expect(schema.safeParse(avec(doc, cle, connue)).success).toBe(false);
  });

  describe('activities.json › classGate.classes : liste de Classes (`refs`)', () => {
    const porteuse = activitiesJson.findIndex((a) => 'classGate' in a);
    const avecClasses = (classes: unknown): Entree[] => {
      const copie: Entree[] = structuredClone(activitiesJson);
      copie[porteuse] = { ...copie[porteuse], classGate: { classes, outsidePenalty: 1 } };
      return copie;
    };

    it('une liste de Classes connues parse', () => {
      expect(porteuse).toBeGreaterThanOrEqual(0);
      expect(schemaActivites.safeParse(avecClasses(['roublards', 'courtisans'])).success).toBe(true);
    });

    it('une Classe inconnue dans la liste est refusée, son catalogue nommé', () => {
      expect(messages(schemaActivites, avecClasses(['roublards', 'classe-inexistante']))).toContain('« classe-inexistante » est absent du catalogue des classes de carrière');
    });
  });
});
