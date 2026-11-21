import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { z } from 'zod';
import { schema as mutationsSchema } from '../../data/schemas/defs/mutations';
import { cleFiltree } from '../../data/schemas/grammaire/cle-d-espace';
import { listeCle, ouvrirPortees } from '../../data/schemas/grammaire/collection-cle';
import { ouverts, pasDeDonnee } from '../../data/schemas/grammaire/descente';
import { poserRegimeVivant } from '../../data/schemas/grammaire/idsVivants';
import { nommerChamps } from '../../data/schemas/grammaire/meta';
import { espaceDe, recordDIds, ref, refTypee } from '../../data/schemas/grammaire/ref';
import { enumNomme } from '../../data/schemas/grammaire/valeurs';
import { projeterInversesCodex } from './projectionInverse';

const OBJET = 'objet-de-fixture';
const HOMONYME = 'homonyme-de-fixture';
const MORSURE = 'morsure-de-fixture';
const VENIN = 'venin-de-fixture';

const espaces = new Map<string, ReadonlySet<string>>([
  [espaceDe('trapping'), new Set([OBJET, HOMONYME])],
  [espaceDe('skill'), new Set([HOMONYME])],
  [espaceDe('talent'), new Set([HOMONYME])],
  [espaceDe('trait'), new Set([MORSURE, VENIN])],
  [cleFiltree(espaceDe('trait'), { champ: 'attaque' }), new Set([MORSURE])],
]);
const espaceVide = new Set<string>();

describe('projection des inverses du Codex depuis le schéma', () => {
  let regimeAvant: ReturnType<typeof poserRegimeVivant>;
  beforeEach(() => {
    regimeAvant = poserRegimeVivant((cle) => espaces.get(cle) ?? espaceVide);
  });
  afterEach(() => {
    poserRegimeVivant(regimeAvant);
  });

  it('expose un nouveau chemin à la déclaration du champ, avec son détail', () => {
    const objet = ref('trapping');
    const schemaDesPossessions = (nouvellePossession: z.ZodType) => nommerChamps(z.strictObject({
      possessions: z.strictObject({ existante: objet, nouvellePossession }),
      possessionHorsPortee: objet,
    }), {
      possessions: { label: 'Possessions', inverseCodex: { detail: 'Départ' } },
      possessionHorsPortee: { label: 'Possession hors portée' },
    });
    const sansDeclaration = schemaDesPossessions(z.unknown());
    const avecDeclaration = schemaDesPossessions(objet);
    const entree = {
      possessions: { existante: { id: OBJET }, nouvellePossession: { id: HOMONYME } },
      possessionHorsPortee: { id: HOMONYME },
    };

    expect(projeterInversesCodex(sansDeclaration, [entree])).toEqual([[
      { type: 'trapping', id: OBJET, detail: 'Départ' },
    ]]);
    expect(projeterInversesCodex(avecDeclaration, [entree])).toEqual([[
      { type: 'trapping', id: OBJET, detail: 'Départ' },
      { type: 'trapping', id: HOMONYME, detail: 'Départ' },
    ]]);
  });

  it('résout chaque espace d’homonyme et ne publie que les références globales', () => {
    const portee = { collection: 'closes', catalogue: 'entrées locales' } as const;
    const references = ouvrirPortees(z.strictObject({
      closes: listeCle(z.strictObject({ id: z.string() }), 'id'),
      locale: ref(portee),
      globale: ref('trapping'),
      typees: z.array(refTypee(enumNomme({ skill: 'Compétence', talent: 'Talent' }))),
      parCle: recordDIds('trapping', z.number()),
    }), [portee]);
    const schema = nommerChamps(z.strictObject({ references }), {
      references: { label: 'Références', inverseCodex: true },
    });

    expect(projeterInversesCodex(schema, [{
      references: {
        closes: [{ id: HOMONYME }],
        locale: { id: HOMONYME },
        globale: { id: HOMONYME },
        typees: [{ type: 'skill', id: HOMONYME }, { type: 'talent', id: HOMONYME }],
        parCle: { [HOMONYME]: 1 },
      },
    }])).toEqual([[
      { type: 'trapping', id: HOMONYME },
      { type: 'skill', id: HOMONYME },
      { type: 'talent', id: HOMONYME },
      { type: 'trapping', id: HOMONYME },
    ]]);
  });

  it('publie le Trait octroyé par une Mutation dont la Morsure confère du Venin', () => {
    const mutation = {
      id: 'mutation-de-fixture',
      type: 'mutations',
      label: 'Mutation de fixture',
      desc: 'Une Mutation de fixture.',
      kind: 'physique',
      maison: 'Fixture du test du Codex',
      passive: [{ op: 'grantTrait', trait: { id: MORSURE, confere: [{ id: VENIN }] } }],
    };

    const [schema] = pasDeDonnee(ouverts([mutationsSchema]), 0) as z.ZodType[];
    expect(schema.safeParse(mutation).success).toBe(true);
    expect(projeterInversesCodex(schema, [mutation])).toEqual([[
      { type: 'trait', id: MORSURE },
    ]]);
  });
});
