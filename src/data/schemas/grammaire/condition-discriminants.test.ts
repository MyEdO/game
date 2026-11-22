/** Les discriminants du catalogue donnent tous une Condition que sa famille peut parser. */
import { describe, expect, expectTypeOf, it } from 'vitest';
import type { z } from 'zod';
import type { Condition } from '../../../engine/flowCore';
import { CONDITION_TOUJOURS, recast } from '../../valeursNeuves';
import { CONDITIONS_RESERVEES, conditionSchema, hasConditionSchema, hasWhatSchema, mecaniqueDe } from './mecanique';
import { defDe, enfantsDe, ouverts } from './descente';
import { idsDe, idsDeLaSousListe } from './ref';
import { CIBLE_D_APPARTENANCE } from './sousListes';

const tousLesRegimes = Object.fromEntries(CONDITIONS_RESERVEES.map((kind) => [`condition.${kind}`, 'admis'] as const));
const famille = mecaniqueDe(tousLesRegimes);
const reservees = new Set<string>(CONDITIONS_RESERVEES);

const branches = (union: unknown) => enfantsDe(union).filter((e) => e.segment.startsWith('|')).map((e) => e.noeud);

/** Une union imbriquée comme `has` porte le même `kind` dans toute option. */
function kindDeLOption(noeud: unknown): string {
  const sous = branches(noeud);
  if (sous.length) {
    const kinds = new Set(sous.map(kindDeLOption));
    if (kinds.size !== 1) throw new Error(`Union imbriquée à plusieurs kind : ${[...kinds].join(', ')}`);
    return [...kinds][0];
  }
  const valeurs = defDe(enfantsDe(noeud).find((e) => e.cle === 'kind')?.noeud)?.values;
  if (!Array.isArray(valeurs) || valeurs.length !== 1 || typeof valeurs[0] !== 'string')
    throw new Error('Discriminant kind absent ou non littéral de chaîne unique');
  return valeurs[0];
}

function kindsDuSchema(schema: unknown): string[] {
  const union = ouverts([schema]).find((n) => defDe(n)?.type === 'union');
  return branches(union).map(kindDeLOption);
}

function temoinsDe(kind: Condition['kind']): Condition[] {
  const condition = recast(CONDITION_TOUJOURS, kind);
  switch (condition.kind) {
    case 'flag': return [{ ...condition, expr: 'sonde' }];
    case 'etat': return [{ ...condition, etat: 'sonde' }];
    case 'skill':
    case 'talent':
    case 'career':
    case 'species': return [{ ...condition, id: [...idsDe(condition.kind)][0] }];
    case 'has': {
      const ids = {
        group: idsDeLaSousListe('groupe', CIBLE_D_APPARTENANCE),
        talent: [...idsDe('talent')],
        trait: [...idsDe('trait')],
        psych: [...idsDe('psychology')],
        immunity: [...idsDe('damageType')],
      } satisfies Record<typeof hasWhatSchema.options[number], readonly string[]>;
      return hasWhatSchema.options.map((what) => hasConditionSchema.parse({ kind: 'has', who: condition.who, what, ref: { id: ids[what][0] } }));
    }
    default: return [condition];
  }
}

describe('les discriminants de Condition et leur régime', () => {
  it('la famille qui admet les réservées a le type du moteur et le même catalogue de discriminants', () => {
    expectTypeOf<z.output<typeof famille.condition>>().toEqualTypeOf<Condition>();
    expectTypeOf<z.output<typeof conditionSchema>['kind']>()
      .toEqualTypeOf<Exclude<Condition['kind'], typeof CONDITIONS_RESERVEES[number]>>();
    const kinds = kindsDuSchema(famille.condition);
    expect(kinds.length).toBeGreaterThan(20);
    expect(kinds.length).toBe(new Set(kinds).size);
    expect(kindsDuSchema(conditionSchema)).toEqual(kinds);
  });

  it('les témoins de chaque variante passent le parse dans son régime, les réservées sont refusées nommément ailleurs', () => {
    for (const kind of kindsDuSchema(famille.condition)) {
      for (const condition of temoinsDe(kind as Condition['kind'])) {
        expect(condition.kind).toBe(kind);
        expect(famille.condition.parse(condition)).toEqual(condition);
        const fermee = conditionSchema.safeParse(condition);
        if (reservees.has(kind)) {
          expect(fermee.error?.issues).toMatchObject([
            { path: [], message: expect.stringContaining(`Condition « ${kind} » : réservée`) },
          ]);
        } else {
          expect(fermee.data, kind).toEqual(condition);
        }
      }
    }
    expect(conditionSchema.safeParse({ kind: 'condition-inconnue' }).success).toBe(false);
  });
});
