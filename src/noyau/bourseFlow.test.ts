import { describe, it, expect } from 'vitest';
import {
  partyMoneyTotal,
  creditBourse,
  debitBourse,
  payWithAllocation,
  payFromGroup,
  distributeCredit,
  soloPayer,
  perHead,
  canDebitBourse,
  condCtx,
  drainGroup,
} from './bourseFlow';
import { bourseInstanceOf, ensureBourse, bourseOf } from '../engine/bourse';
import { evalCondition } from '../engine/flowCore';
import type { Combatant } from '../engine/types';
import type { Jeu } from './etat';
import type { Get, Set } from './flowTypes';
import { subtract, type Money } from '../engine/money';
import { idNeufDeBanc } from '../lib/entityId.testkit';

/** Harnais MINIMAL (get/set) sur un état réduit à `party` — même patron que `partyFlow.test.ts`. */
function makeHarness(party: Combatant[]): { get: Get; set: Set } {
  let state = { party, flags: {}, gameTime: 0, log: () => {} } as unknown as Jeu;
  const get: Get = () => state;
  const set: Set = (p) => { state = { ...state, ...(typeof p === 'function' ? p(state) : p) }; };
  return { get, set };
}

function makeHero(id: string): Combatant {
  return {
    id, label: id, kind: 'hero',
    characteristics: { force: 30, endurance: 30 } as Combatant['characteristics'],
    items: [], talents: [], skills: [], conditions: [], advantage: 0, wounds: { current: 10, max: 10 },
  } as unknown as Combatant;
}

const M = (gold: number, silver: number, brass: number): Money => ({ gold, silver, brass });

describe('bourseFlow — bourse PERSONNELLE par héros (#531 SOCLE POSSESSIONS §8)', () => {
  it('un héros neuf n’a pas de Bourse ; bourseOf renvoie 0', () => {
    const hero = makeHero('h1');
    expect(bourseInstanceOf(hero)).toBeUndefined();
    expect(bourseOf(hero)).toEqual(M(0, 0, 0));
  });

  it('ensureBourse crée l’instance (trappingId "bourse", money à 0) — no-op si déjà présente', () => {
    const hero = makeHero('h1');
    const withBourse = ensureBourse(hero, idNeufDeBanc);
    expect(withBourse).not.toBe(hero); // clone
    const it = bourseInstanceOf(withBourse);
    expect(it?.trappingId).toBe('bourse');
    expect(it?.money).toEqual(M(0, 0, 0));
    const again = ensureBourse(withBourse, idNeufDeBanc);
    expect(again).toBe(withBourse); // déjà présente : no-op
  });

  it('creditBourse crédite la Bourse d’UN héros (crée l’instance au passage)', () => {
    const hero = makeHero('h1');
    const { get, set } = makeHarness([hero]);
    creditBourse(get, set, 'h1', M(0, 5, 0));
    expect(bourseOf(get().party[0])).toEqual(M(0, 5, 0));
  });

  it('debitBourse débite si solvable, refuse (sans mutation) si insolvable', () => {
    const hero = ensureBourse(makeHero('h1'), idNeufDeBanc);
    bourseInstanceOf(hero)!.money = M(0, 5, 0);
    const { get, set } = makeHarness([hero]);
    expect(debitBourse(get, set, 'h1', M(0, 3, 0))).toBe(true);
    expect(bourseOf(get().party[0])).toEqual(M(0, 2, 0));
    expect(debitBourse(get, set, 'h1', M(0, 10, 0))).toBe(false);
    expect(bourseOf(get().party[0])).toEqual(M(0, 2, 0)); // inchangé
  });

  it('partyMoneyTotal = somme des bourses du groupe', () => {
    const a = ensureBourse(makeHero('a'), idNeufDeBanc); bourseInstanceOf(a)!.money = M(1, 0, 0);
    const b = ensureBourse(makeHero('b'), idNeufDeBanc); bourseInstanceOf(b)!.money = M(0, 5, 0);
    const c = makeHero('c'); // pas de bourse : compte pour 0
    const { get } = makeHarness([a, b, c]);
    expect(partyMoneyTotal(get)).toEqual(M(1, 5, 0));
  });

  describe('payWithAllocation — cotisation ATOMIQUE (tout ou rien)', () => {
    it('cotisation {A:5,B:10} : A ET B débités quand les deux sont solvables', () => {
      const a = ensureBourse(makeHero('a'), idNeufDeBanc); bourseInstanceOf(a)!.money = M(0, 10, 0);
      const b = ensureBourse(makeHero('b'), idNeufDeBanc); bourseInstanceOf(b)!.money = M(0, 20, 0);
      const { get, set } = makeHarness([a, b]);
      const ok = payWithAllocation(get, set, {
        debits: { a: M(0, 5, 0), b: M(0, 10, 0) },
        recipient: 'a',
        purpose: 'Arme de A',
      });
      expect(ok).toBe(true);
      expect(bourseOf(get().party[0])).toEqual(M(0, 5, 0));
      expect(bourseOf(get().party[1])).toEqual(M(0, 10, 0));
    });

    it('B insolvable : AUCUNE bourse débitée, renvoie false', () => {
      const a = ensureBourse(makeHero('a'), idNeufDeBanc); bourseInstanceOf(a)!.money = M(0, 10, 0);
      const b = ensureBourse(makeHero('b'), idNeufDeBanc); bourseInstanceOf(b)!.money = M(0, 2, 0);
      const { get, set } = makeHarness([a, b]);
      const ok = payWithAllocation(get, set, { debits: { a: M(0, 5, 0), b: M(0, 10, 0) } });
      expect(ok).toBe(false);
      expect(bourseOf(get().party[0])).toEqual(M(0, 10, 0)); // A INTACT malgré sa solvabilité
      expect(bourseOf(get().party[1])).toEqual(M(0, 2, 0));
    });

    it('consent refusé pour un siège (seam coop) : AUCUNE bourse débitée même solvable', () => {
      const a = ensureBourse(makeHero('a'), idNeufDeBanc); bourseInstanceOf(a)!.money = M(0, 10, 0);
      const b = ensureBourse(makeHero('b'), idNeufDeBanc); bourseInstanceOf(b)!.money = M(0, 10, 0);
      const { get, set } = makeHarness([a, b]);
      const ok = payWithAllocation(get, set, {
        debits: { a: M(0, 5, 0), b: M(0, 5, 0) },
        consent: (id) => id !== 'b',
      });
      expect(ok).toBe(false);
      expect(bourseOf(get().party[0])).toEqual(M(0, 10, 0)); // a INTACT malgré sa solvabilité
      expect(bourseOf(get().party[1])).toEqual(M(0, 10, 0)); // b INTACT
    });

    it('sans `consent` : défaut `canDebitBourse` (toujours accordé en solo) laisse passer', () => {
      const a = ensureBourse(makeHero('a'), idNeufDeBanc); bourseInstanceOf(a)!.money = M(0, 10, 0);
      const b = ensureBourse(makeHero('b'), idNeufDeBanc); bourseInstanceOf(b)!.money = M(0, 10, 0);
      const { get, set } = makeHarness([a, b]);
      expect(canDebitBourse('b')).toBe(true);
      const ok = payWithAllocation(get, set, { debits: { a: M(0, 5, 0), b: M(0, 5, 0) } });
      expect(ok).toBe(true);
      expect(bourseOf(get().party[0])).toEqual(M(0, 5, 0));
      expect(bourseOf(get().party[1])).toEqual(M(0, 5, 0));
    });
  });

  describe('payFromGroup — DÉPENSE DE GROUPE gloutonne (succès ssi le TOTAL suffit)', () => {
    it('total suffisant réparti sur 3 bourses (dont une à 0) → true, somme débitée = cost', () => {
      const a = ensureBourse(makeHero('a'), idNeufDeBanc); bourseInstanceOf(a)!.money = M(0, 5, 0); // 60 sc
      const b = makeHero('b');                                                        // 0 sc (pas de bourse)
      const c = ensureBourse(makeHero('c'), idNeufDeBanc); bourseInstanceOf(c)!.money = M(0, 3, 0); // 36 sc
      const { get, set } = makeHarness([a, b, c]);
      const before = partyMoneyTotal(get); // 96 sc = M(0,8,0)
      const cost = M(0, 6, 0);              // 72 sc
      const ok = payFromGroup(get, set, cost, { purpose: 'Péage du pont' });
      expect(ok).toBe(true);
      // Glouton dans l'ordre : a vidé (60), b sauté (0), c ponctionné du reste (12 = 1 pistole).
      expect(bourseOf(get().party[0])).toEqual(M(0, 0, 0)); // a
      expect(bourseOf(get().party[1])).toEqual(M(0, 0, 0)); // b (jamais de bourse créée)
      expect(bourseInstanceOf(get().party[1])).toBeUndefined();
      expect(bourseOf(get().party[2])).toEqual(M(0, 2, 0)); // c : 36 − 12 = 24 sc
      // Somme débitée = cost : total avant − total après.
      const after = partyMoneyTotal(get);
      expect(subtract(before, after)).toEqual(cost);
    });

    it('total insuffisant → false, AUCUNE bourse débitée', () => {
      const a = ensureBourse(makeHero('a'), idNeufDeBanc); bourseInstanceOf(a)!.money = M(0, 2, 0); // 24 sc
      const b = makeHero('b');                                                        // 0 sc
      const c = ensureBourse(makeHero('c'), idNeufDeBanc); bourseInstanceOf(c)!.money = M(0, 1, 0); // 12 sc
      const { get, set } = makeHarness([a, b, c]);                                    // total 36 sc
      const ok = payFromGroup(get, set, M(0, 5, 0), { purpose: 'Cargaison' });        // 60 sc > 36
      expect(ok).toBe(false);
      expect(bourseOf(get().party[0])).toEqual(M(0, 2, 0)); // intact
      expect(bourseOf(get().party[1])).toEqual(M(0, 0, 0));
      expect(bourseOf(get().party[2])).toEqual(M(0, 1, 0)); // intact
    });
  });

  describe('distributeCredit — répartition PAR TÊTE par défaut, reste au doyen', () => {
    it('3 héros, 10 sous : chacun 3, le doyen (1er) prend le reste (1)', () => {
      const heroes = [makeHero('a'), makeHero('b'), makeHero('c')];
      const { get, set } = makeHarness(heroes);
      distributeCredit(get, set, M(0, 0, 10));
      expect(bourseOf(get().party[0])).toEqual(M(0, 0, 4)); // doyen : 3 + reste 1
      expect(bourseOf(get().party[1])).toEqual(M(0, 0, 3));
      expect(bourseOf(get().party[2])).toEqual(M(0, 0, 3));
    });

    it('allocation explicite : répartit exactement comme fourni', () => {
      const heroes = [makeHero('a'), makeHero('b')];
      const { get, set } = makeHarness(heroes);
      distributeCredit(get, set, M(0, 0, 0), soloPayer('b', M(1, 0, 0)));
      expect(bourseOf(get().party[0])).toEqual(M(0, 0, 0));
      expect(bourseOf(get().party[1])).toEqual(M(1, 0, 0));
    });
  });

  it('perHead : division entière en sous de cuivre, reste au doyen ; groupe vide → allocation vide', () => {
    const heroes = [makeHero('a'), makeHero('b'), makeHero('c')];
    const alloc = perHead(heroes, M(0, 0, 10));
    expect(alloc.a).toEqual(M(0, 0, 4)); // 10/3 = 3 reste 1 → doyen 3+1=4
    expect(alloc.b).toEqual(M(0, 0, 3));
    expect(alloc.c).toEqual(M(0, 0, 3));
    expect(perHead([], M(0, 0, 10))).toEqual({});
  });

  it('soloPayer : allocation à un seul héros', () => {
    expect(soloPayer('h1', M(0, 2, 0))).toEqual({ h1: M(0, 2, 0) });
  });

  describe('condCtx — Condition {kind:"money"} routée sur la bourse du groupe (régression flowCore.ts:328)', () => {
    it('une bourse du groupe couvrant le seuil → TRUE', () => {
      const hero = ensureBourse(makeHero('a'), idNeufDeBanc); bourseInstanceOf(hero)!.money = M(1, 0, 0);
      const { get } = makeHarness([hero]);
      expect(evalCondition({ kind: 'money', atLeast: { gold: 1 } }, condCtx(get))).toBe(true);
    });

    it('bourses du groupe sous le seuil → FALSE', () => {
      const hero = ensureBourse(makeHero('a'), idNeufDeBanc); bourseInstanceOf(hero)!.money = M(0, 5, 0);
      const { get } = makeHarness([hero]);
      expect(evalCondition({ kind: 'money', atLeast: { gold: 1 } }, condCtx(get))).toBe(false);
    });
  });

  describe('drainGroup — PERTE SCRIPTÉE gloutonne PLAFONNÉE (giveMoney négatif, ne s’esquive jamais)', () => {
    it('perte > total du groupe : TOUTES les bourses tombent à 0 (jamais négatif)', () => {
      const a = ensureBourse(makeHero('a'), idNeufDeBanc); bourseInstanceOf(a)!.money = M(0, 2, 0); // 24 sc
      const b = ensureBourse(makeHero('b'), idNeufDeBanc); bourseInstanceOf(b)!.money = M(0, 1, 0); // 12 sc
      const { get, set } = makeHarness([a, b]); // total 36 sc
      drainGroup(get, set, M(0, 5, 0)); // 60 sc > 36
      expect(bourseOf(get().party[0])).toEqual(M(0, 0, 0));
      expect(bourseOf(get().party[1])).toEqual(M(0, 0, 0));
    });

    it('perte couverte par le total : débite gloutonnement dans l’ordre, reste intact au-delà', () => {
      const a = ensureBourse(makeHero('a'), idNeufDeBanc); bourseInstanceOf(a)!.money = M(0, 5, 0); // 60 sc
      const b = ensureBourse(makeHero('b'), idNeufDeBanc); bourseInstanceOf(b)!.money = M(0, 3, 0); // 36 sc
      const { get, set } = makeHarness([a, b]);
      drainGroup(get, set, M(0, 6, 0)); // 72 sc : a vidé (60), b ponctionné de 12 (1 pistole)
      expect(bourseOf(get().party[0])).toEqual(M(0, 0, 0));
      expect(bourseOf(get().party[1])).toEqual(M(0, 2, 0)); // 36 − 12 = 24 sc
    });
  });
});
