/**
 * La Caractéristique (`CharKey`) n'a qu'un nom de champ, `characteristic` (#1658, #1463) : l'ancienne
 * graphie `char` est REFUSÉE au parse par chaque porteur — ops, octroi `swap`, Condition `compare`.
 * Le profil chiffré d'un statblock garde son nom `char` : c'est un autre concept.
 */
import { describe, expect, it } from 'vitest';
import type { z } from 'zod';
import { conditionSchema, gameOpSchema, OPS_NON_TYPEES } from './mecanique';
import { noeudDuChamp } from '../validate';

const OPS: Record<string, Record<string, unknown>> = {
  charMod: { op: 'charMod', mod: -10 },
  testMod: { op: 'testMod', amount: -10 },
  charDRBonus: { op: 'charDRBonus', bonus: 1 },
  charDamage: { op: 'charDamage', amount: { dice: { n: 1, sides: 10 } } },
  testDAgir: { op: 'testDAgir' },
};

const optionals = (): z.ZodType => {
  const n = noeudDuChamp('creatures.json', 'optionals') as z.ZodType | undefined;
  if (!n) throw new Error('creatures.json › optionals introuvable');
  return n;
};
const swap = (grant: Record<string, unknown>) => [{ note: 'swap', label: 'Octroi', remove: [], grant: [grant] }];
const compare = (subject: Record<string, unknown>, value: unknown) => ({ kind: 'compare', subject, op: '>=', value });

describe('Caractéristique : une seule graphie, `characteristic` (#1658)', () => {
  it.each(Object.keys(OPS))('op `%s` : typée, `characteristic` admis, `char` refusé', (op) => {
    expect(OPS_NON_TYPEES).not.toContain(op);
    expect(gameOpSchema.safeParse({ ...OPS[op], characteristic: 'force' }).success).toBe(true);
    expect(gameOpSchema.safeParse({ ...OPS[op], char: 'force' }).success).toBe(false);
  });

  it('octroi `swap` d’une créature : `characteristic` admis, `char` refusé', () => {
    expect(optionals().safeParse(swap({ characteristic: 'sociabilite', value: 15 })).success).toBe(true);
    expect(optionals().safeParse(swap({ char: 'sociabilite', value: 15 })).success).toBe(false);
  });

  it('Condition `compare` : la référence de Caractéristique se nomme `characteristic`, en sujet comme en valeur', () => {
    expect(conditionSchema.safeParse(compare({ who: 'target', characteristic: 'endurance' }, 30)).success).toBe(true);
    expect(conditionSchema.safeParse(compare({ who: 'target', char: 'endurance' }, 30)).success).toBe(false);
    const sujet = { who: 'target', field: 'woundsCurrent' };
    expect(conditionSchema.safeParse(compare(sujet, { who: 'target', characteristic: 'endurance', factor: 0.5 })).success).toBe(true);
    expect(conditionSchema.safeParse(compare(sujet, { who: 'target', char: 'endurance', factor: 0.5 })).success).toBe(false);
  });
});
