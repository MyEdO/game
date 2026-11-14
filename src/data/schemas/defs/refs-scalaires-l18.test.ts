/**
 * #2968 L18 — le Type de Souffle d'un Domaine des Arcanes (`domains.json › arcane`) se désigne par
 * `ref('breathType')`, la règle optionnelle qu'exige une espèce ou une Caractéristique alternative
 * (`species.json › gatedByRule`, `skills.json › altChar.gatedByRule`) par `ref('regleOptionnelle')`, l'espèce
 * d'apparence par défaut (`speciesRace.json › default`) par `ref('planDeBestiaire')` : `{ id }` refiné au parse
 * contre l'index des ids. Une action armée (`actions.json › armed`) le dit par `true`, son `mode` étant ce
 * qu'elle arme. Fixtures : référence connue, inconnue, d'un autre catalogue, écrite en id nu, et les
 * références d'un document entier.
 */
import { describe, expect, it } from 'vitest';
import type { z } from 'zod';
import { schema as schemaDomaines } from './domains';
import { schema as schemaEspeces } from './species';
import { schema as schemaCompetences } from './skills';
import { schema as schemaEspeceParDefaut } from './speciesRace';
import { schema as schemaActions } from './actions';
import { mesureDuParse } from '../grammaire/ref';
import domainsJson from '../../domains.json';
import speciesJson from '../../species.json';
import skillsJson from '../../skills.json';
import speciesRaceJson from '../../speciesRace.json';
import actionsJson from '../../actions.json';

type Entree = Record<string, unknown>;

const messages = (schema: z.ZodType, doc: unknown): string => {
  const r = schema.safeParse(doc);
  expect(r.success, 'le document a parsé alors qu’il devait être REFUSÉ').toBe(false);
  return r.success ? '' : r.error.issues.map((i) => `${i.path.join('.')} ${i.message}`).join('\n');
};

/** Le document `doc`, son entrée de rang `rang` retouchée par `retouche` sur une copie. */
const retouche = (doc: readonly Entree[], rang: number, avec: (e: Entree) => Entree): Entree[] =>
  doc.map((e, i) => (i === rang ? avec(structuredClone(e)) : e));

const RANG_DOMAINE = domainsJson.findIndex((d) => 'arcane' in d);
const RANG_ESPECE = speciesJson.findIndex((s) => 'gatedByRule' in s);
const RANG_COMPETENCE = skillsJson.findIndex((s) => 'altChar' in s);

const PORTEURS = [
  {
    porteur: 'domains.json › arcane', schema: schemaDomaines, chemin: `${RANG_DOMAINE}.arcane`,
    connue: 'froid', etrangere: 'cieux', catalogue: 'types de Souffle',
    avec: (v: unknown) => retouche(domainsJson, RANG_DOMAINE, (e) => ({ ...e, arcane: v })),
  },
  {
    porteur: 'species.json › gatedByRule', schema: schemaEspeces, chemin: `${RANG_ESPECE}.gatedByRule`,
    connue: 'test-bandes-auto', etrangere: 'poursuite', catalogue: 'règles optionnelles',
    avec: (v: unknown) => retouche(speciesJson, RANG_ESPECE, (e) => ({ ...e, gatedByRule: v })),
  },
  {
    porteur: 'skills.json › altChar.gatedByRule', schema: schemaCompetences, chemin: `${RANG_COMPETENCE}.altChar.gatedByRule`,
    connue: 'test-metier-int', etrangere: 'poursuite', catalogue: 'règles optionnelles',
    avec: (v: unknown) => retouche(skillsJson, RANG_COMPETENCE, (e) => ({ ...e, altChar: { ...(e.altChar as Entree), gatedByRule: v } })),
  },
  {
    porteur: 'speciesRace.json › default', schema: schemaEspeceParDefaut, chemin: 'default',
    connue: 'nain', etrangere: 'humains-reiklander', catalogue: 'espèces du plan de bestiaire',
    avec: (v: unknown) => ({ ...speciesRaceJson, default: v }),
  },
];

describe('#2968 L18 — Type de Souffle, règle optionnelle requise et espèce d’apparence par défaut désignés par `ref(type)`', () => {
  it('les documents réels parsent, et leurs références sont des repères au parse de mesure', () => {
    const compte = (schema: z.ZodType, doc: unknown, type: string) => {
      expect(schema.safeParse(doc).success).toBe(true);
      return mesureDuParse(schema, doc).reperes.filter((r) => r.type === type).length;
    };
    expect(compte(schemaDomaines, domainsJson, 'breathType')).toBe(domainsJson.filter((d) => 'arcane' in d).length);
    expect(compte(schemaEspeces, speciesJson, 'regleOptionnelle')).toBe(speciesJson.filter((s) => 'gatedByRule' in s).length);
    expect(compte(schemaCompetences, skillsJson, 'regleOptionnelle')).toBe(skillsJson.filter((s) => s.altChar?.gatedByRule).length);
    expect(compte(schemaEspeceParDefaut, speciesRaceJson, 'planDeBestiaire')).toBe(1);
  });

  it.each(PORTEURS)('$porteur : une référence connue parse', ({ schema, avec, connue }) => {
    expect(schema.safeParse(avec({ id: connue })).success).toBe(true);
  });

  it.each(PORTEURS)('$porteur : une référence inconnue est refusée à son path, son catalogue nommé', ({ schema, avec, chemin, catalogue }) => {
    expect(messages(schema, avec({ id: 'cible-inexistante' }))).toContain(`${chemin}.id « cible-inexistante » est absent du catalogue des ${catalogue}`);
  });

  it.each(PORTEURS)('$porteur : l’id d’un autre catalogue est refusé', ({ schema, avec, etrangere, catalogue }) => {
    expect(messages(schema, avec({ id: etrangere }))).toContain(`« ${etrangere} » est absent du catalogue des ${catalogue}`);
  });

  it.each(PORTEURS)('$porteur : une référence écrite en id nu est refusée', ({ schema, avec, connue }) => {
    expect(schema.safeParse(avec(connue)).success).toBe(false);
  });
});

describe('#2968 L18 — action armée', () => {
  const RANG_SOIN = actionsJson.findIndex((a) => a.id === 'soins');

  it('`actions.json › armed` : `true` sur une action à mode parse, une chaîne ou une action sans mode est refusée', () => {
    expect(schemaActions.safeParse(actionsJson).success).toBe(true);
    expect(schemaActions.safeParse(retouche(actionsJson, RANG_SOIN, (e) => ({ ...e, armed: 'heal' }))).success).toBe(false);
    expect(messages(schemaActions, retouche(actionsJson, RANG_SOIN, ({ mode: _mode, ...e }) => e))).toContain('action armée sans mode de ciblage');
  });
});
