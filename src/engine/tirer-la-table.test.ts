import { describe, it, expect } from 'vitest';
import { applyOps, tirerLaTable, type GameOp, type OpsCtx } from './ops';
import { exposerALaMaladie } from './disease';
import { makeRNG } from './dice';
import { deFixe, desEnSuite } from './dice.testkit';
import { combattantDeTest } from './combattantDeTest.testkit';
import { idsDeTest } from './idsDeTest.testkit';

type OpTable = Extract<GameOp, { op: 'rollTable' }>;
type TableEnLigne = Extract<OpTable, { entries: unknown }>;

const enLigne = (extra: Partial<TableEnLigne> = {}): TableEnLigne => ({
  op: 'rollTable', die: { n: 1, sides: 10 },
  entries: [
    { min: 1, max: 2, ops: [{ op: 'charDamage', characteristic: 'initiative', amount: { dice: { n: 1, sides: 10 } } }] },
    { min: 3, max: 8, ops: [{ op: 'condition', id: { id: 'sonne' } }] },
    { min: 9, max: 9, ops: [{ op: 'grantTrait', trait: { id: 'nerveux' } }] },
    { min: 10, max: 99, ops: [{ op: 'charDamage', characteristic: 'agilite', amount: { dice: { n: 1, sides: 10 } } }] },
  ],
  ...extra,
} as TableEnLigne);

const parLaTable: OpTable = { op: 'rollTable', table: { id: 'allure-demoniaque-nurgle' } };

/** Applique les rangées de la primitive une à une, `rolled` exposé, comme `applyOps` sur la table. */
function appliquerLesRangees(o: OpTable, ctx: Omit<OpsCtx, 'idNeuf'>) {
  const c = combattantDeTest();
  for (const r of tirerLaTable(o, ctx, ctx.rng)) applyOps(c, r.ops, { ...ctx, idNeuf: idsDeTest, rolled: r.rolled });
  return c;
}

describe('tirerLaTable — mêmes rangées qu’applyOps sur la table', () => {
  const cas: [string, OpTable, Omit<OpsCtx, 'idNeuf' | 'rng'>][] = [
    ['table en ligne', enLigne(), {}],
    ['table référencée', parLaTable, { defaultDurationRounds: 5 }],
    ['`addNegativeSL` sur le `sl` du contexte', enLigne({ addNegativeSL: true }), { sl: -3 }],
    ['`mod`', enLigne({ mod: 2 }), {}],
    ['`extraRollsPerStep` aux pas alloués', enLigne({ extraRollsPerStep: 1 }), { overcastDurationSteps: 2, defaultDurationRounds: 3 }],
    ['`extraRollsPerStep` aux pas choisis', enLigne({ extraRollsPerStep: 1 }), { overcastDurationSteps: 3, chosenTableRolls: 1, defaultDurationRounds: 3 }],
  ];
  for (const [nom, o, ctx] of cas) {
    it(nom, () => {
      for (const graine of [1, 2, 3, 5, 8, 13]) {
        const viaApplyOps = combattantDeTest();
        applyOps(viaApplyOps, [o], { ...ctx, idNeuf: idsDeTest, rng: makeRNG(graine) });
        expect(appliquerLesRangees(o, { ...ctx, rng: makeRNG(graine) })).toEqual(viaApplyOps);
      }
    });
  }

  it('la rangée rendue est celle du dé, modificateurs compris, et porte le dé tiré', () => {
    const o = enLigne({ mod: 1, addNegativeSL: true });
    expect([...tirerLaTable(o, { sl: -3 }, deFixe(5))]).toEqual([{ ops: o.entries[2].ops, rolled: 5 }]);
  });

  it('la référence `table` désigne la rangée dans tables.json', () => {
    const [r] = [...tirerLaTable(parLaTable, {}, deFixe(3))];
    expect(r).toEqual({ ops: [{ op: 'grantTrait', trait: { id: 'demoniaque', value: 7 } }], rolled: 3 });
  });

  it('`extraRollsPerStep` : un jet de plus par pas choisi, borné aux pas alloués', () => {
    const o = enLigne({ extraRollsPerStep: 1 });
    expect([...tirerLaTable(o, { overcastDurationSteps: 2, chosenTableRolls: 5 }, desEnSuite([1, 5, 9]))].map((r) => r.rolled)).toEqual([1, 5, 9]);
    expect([...tirerLaTable(o, { overcastDurationSteps: 2, chosenTableRolls: 0 }, desEnSuite([4]))].map((r) => r.rolled)).toEqual([4]);
  });
});

describe('exposerALaMaladie — fusion d’une exposition', () => {
  it('maladie neuve : entrée ajoutée, crans et incubation de l’op', () => {
    expect(exposerALaMaladie([{ disease: 'toux' }], { op: 'exposeDisease', disease: { id: 'fievre-du-rongeur' }, difficultyShift: -2, incubation: 'instant' }))
      .toEqual([{ disease: 'toux' }, { disease: 'fievre-du-rongeur', difficultyShift: -2, instant: true }]);
  });

  it('même maladie : garde la plus dure (cran le plus bas, `instant` si l’une l’impose)', () => {
    const avant = [{ disease: 'toux' }, { disease: 'fievre-du-rongeur', instant: true }];
    expect(exposerALaMaladie(avant, { op: 'exposeDisease', disease: { id: 'fievre-du-rongeur' }, difficultyShift: -2 }))
      .toEqual([{ disease: 'toux' }, { disease: 'fievre-du-rongeur', difficultyShift: -2, instant: true }]);
    expect(exposerALaMaladie([{ disease: 'fievre-du-rongeur', difficultyShift: -2 }], { op: 'exposeDisease', disease: { id: 'fievre-du-rongeur' }, difficultyShift: -1 }))
      .toEqual([{ disease: 'fievre-du-rongeur', difficultyShift: -2 }]);
  });

  it('`applyOps` pose sur `diseaseExposure` la fusion de la primitive', () => {
    const c = combattantDeTest({ diseaseExposure: [{ disease: 'fievre-du-rongeur', difficultyShift: -1 }] });
    const op = { op: 'exposeDisease', disease: { id: 'fievre-du-rongeur' }, difficultyShift: -2, incubation: 'instant' } as const;
    const attendu = exposerALaMaladie(c.diseaseExposure, op);
    applyOps(c, [op], { idNeuf: idsDeTest, rng: makeRNG(1) });
    expect(c.diseaseExposure).toEqual(attendu);
  });
});
