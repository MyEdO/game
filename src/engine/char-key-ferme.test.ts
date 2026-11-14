import { describe, it, expect } from 'vitest';
import type { Characteristics, CharKey } from './types';
import type { MountIncidentEffects } from './travelTables';
import { charKeySchema } from '../data/schemas/grammaire/valeurs';
import type { CreatureData, weatherPhysicalTestChars } from '../data';
import type { MiscastRowEntry } from '../data/overrides';
import { schema as creaturesSchema } from '../data/schemas/defs/creatures';
import { schema as activitiesSchema } from '../data/schemas/defs/activities';
import { schema as miscastSchema } from '../data/schemas/defs/miscast';
import { schema as weatherSchema, weatherIdSchema } from '../data/schemas/defs/weather';
import { schema as incidentsMontureSchema } from '../data/schemas/defs/incidents-monture';

/**
 * `CharKey` est une union FERMÉE de slugs (#311) : un token court (`CC`, `FM`…) ne compile pas en
 * valeur de Caractéristique, et la donnée JSON le refuse au chargement (`charKeySchema`). #2724
 */
describe('CharKey fermé — les tokens courts ne s’écrivent pas (#311, #2724)', () => {
  const base = { capacite: 0 } as unknown as Characteristics;

  it('le compilateur refuse les quatre formes', () => {
    // @ts-expect-error TS2353
    const cle: Characteristics = { ...base, CC: 40 };
    // @ts-expect-error TS2339
    const acces = base.FM;
    // @ts-expect-error TS7053
    const index = base['Soc'];
    // @ts-expect-error TS2322
    const champ: { characteristic: CharKey } = { characteristic: 'Ag' };
    expect([cle, acces, index, champ]).toHaveLength(4);
  });

  it('la donnée refuse le token court au chargement', () => {
    for (const court of ['CC', 'CT', 'F', 'E', 'I', 'Ag', 'Dex', 'Int', 'FM', 'Soc']) {
      expect(charKeySchema.safeParse(court).success, court).toBe(false);
    }
    expect(charKeySchema.safeParse('capacite-de-combat').success).toBe(true);
  });

  it('les champs de donnée typés le refusent aussi', () => {
    const profil: CreatureData['char'] = { 'capacite-de-combat': 40, M: 4, B: null };
    // @ts-expect-error TS2353
    const profilCourt: CreatureData['char'] = { CC: 40 };
    const test: NonNullable<MiscastRowEntry['test']> = { test: { characteristic: 'force-mentale', difficulty: 'intermediaire' }, onFail: [] };
    // @ts-expect-error TS2322
    const testCourt: NonNullable<MiscastRowEntry['test']> = { test: { characteristic: 'FM', difficulty: 'intermediaire' }, onFail: [] };
    const cavalier: NonNullable<MountIncidentEffects['riderTest']> = { test: { skill: { id: 'chevaucher' }, characteristic: 'agilite', difficulty: 'complexe' }, fallM: 2 };
    // @ts-expect-error TS2322
    const cavalierCourt: NonNullable<MountIncidentEffects['riderTest']> = { test: { skill: { id: 'chevaucher' }, characteristic: 'Ag', difficulty: 'complexe' }, fallM: 2 };
    const physique: ReturnType<typeof weatherPhysicalTestChars>[number] = 'agilite';
    // @ts-expect-error TS2322
    const physiqueCourt: ReturnType<typeof weatherPhysicalTestChars>[number] = 'Ag';
    expect([profil, profilCourt, test, testCourt, cavalier, cavalierCourt, physique, physiqueCourt]).toHaveLength(8);
  });
});

const SOURCE = { book: 'livre-de-base', page: 1 };

/** Une créature minimale ; `champs` y pose la clé de Caractéristique sous test. */
const creature = (champs: Record<string, unknown>) => [{
  id: 'creature-fixture', type: 'creatures', label: 'Créature fixture', title: null, folder: null,
  char: {}, traits: [], optionals: [], skills: [], talents: [], trappings: [], spells: [], appearance: { species: 'humain' }, source: SOURCE, ...champs,
}];

describe('les champs de donnée qui nomment une Caractéristique refusent le token court (#2724)', () => {
  const cas: { nom: string; schema: { safeParse(v: unknown): { success: boolean; error?: { issues: unknown[] } } }; fixture: (carac: string) => unknown }[] = [
    { nom: 'creatures.char', schema: creaturesSchema, fixture: (carac) => creature({ char: { [carac]: 30 } }) },
    { nom: 'creatures.optionals[].grant[].characteristic', schema: creaturesSchema,
      fixture: (carac) => creature({ optionals: [{ note: 'swap', label: 'Octroi fixture', remove: [], grant: [{ characteristic: carac, value: 15 }] }] }) },
    { nom: 'activities.tests[].characteristic', schema: activitiesSchema,
      fixture: (carac) => [{ id: 'activite-fixture', type: 'activities', label: 'Activité fixture', icon: 'navigation/repos', contexts: ['voyage'], tests: [{ characteristic: carac }], source: SOURCE }] },
    { nom: 'miscast.entries[].test.test.characteristic', schema: miscastSchema,
      fixture: (carac) => [{ id: 'miscast-fixture', type: 'miscast', label: 'Table fixture', die: 'd100', source: SOURCE,
        entries: [{ id: 'fixture-ligne', min: 1, max: 100, label: 'Ligne fixture', test: { test: { characteristic: carac, difficulty: 'accessible' }, onFail: [] } }] }] },
    { nom: 'weather.physicalTestChars', schema: weatherSchema,
      fixture: (carac) => ({ id: 'weather', type: 'weather', label: 'Météo fixture', seasons: [], physicalTestChars: [carac],
        conditions: weatherIdSchema.options.map((id) => ({ id, label: id })) }) },
    { nom: 'incidents-monture.entries[].mount.riderTest.test.characteristic', schema: incidentsMontureSchema,
      fixture: (carac) => ({ id: 'incidents-fixture', type: 'incidents-monture', label: 'Incidents fixture', die: 'd100', source: SOURCE,
        entries: [{ min: 1, max: 100, id: 'incident-fixture', label: 'Incident fixture', desc: 'Fixture.',
          mount: { riderTest: { test: { skill: { id: 'chevaucher' }, characteristic: carac, difficulty: 'complexe' }, fallM: 2 } } }] }) },
  ];

  for (const { nom, schema, fixture } of cas) {
    it(nom, () => {
      for (const carac of ['agilite', 'intelligence']) {
        const { success, error } = schema.safeParse(fixture(carac));
        expect(success, JSON.stringify(error?.issues)).toBe(true);
      }
      expect(schema.safeParse(fixture('Int')).success).toBe(false);
    });
  }
});
