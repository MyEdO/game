import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { formuleSansTirageSchema } from './valeurs';
import { gameOpSchema } from './mecanique';
import { entree as sortSchema } from '../defs/spells';
import type { FormuleSansTirage } from '../../../engine/ops';

/** CONTRAT (#2817) : une quantité lue AVANT tout jet — portée, cibles et zone d'un Sort, bonus de DR,
 *  modificateur de Test affiché — n'admet aucun terme de jet (`{dice}`, `{rolled}`, `{sl}`), à quelque
 *  profondeur que ce soit, et le parse NOMME le terme refusé. */
const DE = { dice: { n: 1, sides: 10 } };
const messages = (r: { success: boolean; error?: { issues: { message: string }[] } }): string =>
  (r.error?.issues ?? []).map((i) => i.message).join('\n');

describe('formuleSansTirageSchema — aucune quantité lue avant le jet ne porte de terme de jet', () => {
  it.each([
    ['{dice}', DE, '{dice}'],
    ['{rolled}', { rolled: true }, '{rolled}'],
    ['{sl}', { sl: true }, '{sl}'],
    ['un dé niché sous `sum`', { sum: [2, DE] }, '{dice}'],
    ['un dé niché sous `times`', { times: { of: { bonusOf: 'force-mentale' }, factor: DE } }, '{dice}'],
    ['un dé niché sous `minimum`', { minimum: 1, of: DE }, '{dice}'],
  ])('%s est refusé, et le message nomme le terme', (_nom, formule, terme) => {
    const r = formuleSansTirageSchema.safeParse(formule);
    expect(r.success).toBe(false);
    expect(messages(r)).toContain(terme);
  });

  it.each([
    ['un littéral', 6],
    ['un bonus de caractéristique', { bonusOf: 'force-mentale' }],
    ['une règle optionnelle', { rule: 'mendier-discours' }],
    ['une composition sans jet', { times: { of: { bonusOf: 'force-mentale' }, factor: 2 } }],
  ])('%s passe', (_nom, formule) => {
    expect(formuleSansTirageSchema.safeParse(formule).success).toBe(true);
  });
});

describe('les champs de requête prennent la grammaire sans tirage', () => {
  it('le TYPE exclut les termes de jet : un dé ne s’écrit pas dans une `FormuleSansTirage`', () => {
    // @ts-expect-error — `{dice}` n'est pas une `FormuleSansTirage`.
    const de: FormuleSansTirage = DE;
    // @ts-expect-error — un dé niché ne l'est pas davantage.
    const niche: FormuleSansTirage = { sum: [1, { rolled: true }] };
    expect([de, niche]).toHaveLength(2);
  });

  it.each([
    ['skillDRBonus.bonus', { op: 'skillDRBonus', skill: { id: 'orientation' }, bonus: DE }],
    ['charDRBonus.bonus', { op: 'charDRBonus', char: 'sociabilite', bonus: DE }],
    ['incomingSpellDRMod.amount', { op: 'incomingSpellDRMod', amount: DE }],
  ])('`%s` à dés est refusé au parse', (_champ, op) => {
    const r = gameOpSchema.safeParse(op);
    expect(r.success).toBe(false);
    expect(messages(r)).toContain('{dice}');
  });

  const SORTS = JSON.parse(readFileSync(join(process.cwd(), 'src/data/spells.json'), 'utf8')) as Record<string, unknown>[];
  const sortDope = (champ: Record<string, unknown>): Record<string, unknown> => ({ ...SORTS[0], ...champ });

  it('le sort de base des fixtures passe tel quel', () => {
    expect(sortSchema.safeParse(SORTS[0]).success).toBe(true);
  });

  it.each([
    ['range.value', { range: { kind: 'distance', value: DE, unit: 'm' } }],
    ['target.n', { target: { kind: 'count', n: DE } }],
    ['target.meters', { target: { kind: 'area', span: 'radius', meters: DE } }],
  ])('`%s` à dés est refusé au parse d’un Sort', (_champ, champ) => {
    const r = sortSchema.safeParse(sortDope(champ));
    expect(r.success).toBe(false);
    expect(messages(r)).toContain('{dice}');
  });
});
