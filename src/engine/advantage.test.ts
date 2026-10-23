import { describe, it, expect, afterEach } from 'vitest';
import { advantageCap, advantageCapFor, gainAdvantage, avantageApresPerte } from './advantage';
import { setRule, resetRule } from './policy';
import type { Combatant } from './types';
import { applyOps, avantageDeCampSansFiche } from './ops';
import { TAVERN_GAMES } from './tavernGame';
import { createHero } from './character';
import { desDuTest } from './dice.testkit';
import { idNeufDeBanc } from '../lib/entityId.testkit';

const c = (advantage: number) => ({ advantage }) as Combatant;
const ci = (advantage: number, I: number) =>
  ({ advantage, characteristics: { initiative: I }, conditions: [], weapons: [], activeEffects: [], liveTraits: [] }) as unknown as Combatant;

describe('gainAdvantage — plafond « Limiter les Avantages » (LDB 14 l.198)', () => {
  afterEach(() => resetRule('combat-advantage-cap'));
  it('gagne n (défaut 1) et clampe au plafond (défaut 10)', () => {
    expect(advantageCap()).toBe(10);
    const a = c(0); gainAdvantage(a); expect(a.advantage).toBe(1);
    const b = c(9); gainAdvantage(b, 2); expect(b.advantage).toBe(advantageCap());
    const d = c(10); gainAdvantage(d); expect(d.advantage).toBe(10);
  });
  it('n ≤ 0 est sans effet (jamais une perte)', () => {
    const a = c(5); gainAdvantage(a, 0); gainAdvantage(a, -3); expect(a.advantage).toBe(5);
  });
  it('le plafond suit la règle in-game (preuve « un seul edit »)', () => {
    setRule('combat-advantage-cap', 5);
    const a = c(4); gainAdvantage(a, 10); expect(a.advantage).toBe(5);
  });
});

describe('avantageApresPerte — perte d’Avantage (LDB 14 l.219)', () => {
  it('sans montant : tout est perdu ; avec montant : n retirés, plancher 0', () => {
    expect(avantageApresPerte(4)).toBe(0);
    expect(avantageApresPerte(4, 1)).toBe(3);
    expect(avantageApresPerte(1, 3)).toBe(0);
    expect(avantageApresPerte(0, 1)).toBe(0);
  });
});

describe('Plafond d’Avantage = Bonus d’Initiative (LDB 14 l.197, règle optionnelle)', () => {
  afterEach(() => { resetRule('combat-advantage-cap-bi'); resetRule('combat-advantage-cap'); });
  it('off (défaut) : advantageCapFor = plafond fixe', () => {
    expect(advantageCapFor(ci(0, 45))).toBe(10);
  });
  it('on : advantageCapFor = Bonus d’Initiative (dizaines de l’Initiative), prime sur le plafond fixe', () => {
    setRule('combat-advantage-cap-bi', true);
    expect(advantageCapFor(ci(0, 45))).toBe(4); // BI = 4
    expect(advantageCapFor(ci(0, 38))).toBe(3); // BI = 3
  });
  it('gainAdvantage clampe au Bonus d’Initiative quand la règle est active', () => {
    setRule('combat-advantage-cap-bi', true);
    const a = ci(2, 45); gainAdvantage(a, 10); expect(a.advantage).toBe(4);
  });
});

/** Les verbes d'Avantage du vocabulaire d'ops (`engine/ops.ts`), joués SANS couche state (aucun hook). */
describe('ops d’Avantage — gain additif, complétion, perte totale', () => {
  afterEach(() => resetRule('combat-advantage-cap'));
  const heros = () => { const h = createHero({ idNeuf: idNeufDeBanc, speciesId: 'humains-reiklander', careerId: 'soldat', label: 'Lutteur', seed: 1 }); h.advantage = 0; return h; };

  it('`gainAdvantage` S’ADDITIONNE (NADJ 16 l.34, LDB 14 l.204-209) et s’arrête au plafond (l.198)', () => {
    setRule('combat-advantage-cap', 3);
    const h = heros();
    for (let i = 0; i < 2; i++) applyOps(h, [{ op: 'gainAdvantage', amount: 1 }], { idNeuf: idNeufDeBanc, rng: desDuTest, caster: h });
    expect(h.advantage).toBe(2);
    applyOps(h, [{ op: 'gainAdvantage', amount: 5 }], { idNeuf: idNeufDeBanc, rng: desDuTest, caster: h });
    expect(h.advantage).toBe(3);
  });

  it('`topUpAdvantage` COMPLÈTE jusqu’à `amount`, sans jamais retirer (MDG 16 l.11)', () => {
    const h = heros();
    applyOps(h, [{ op: 'topUpAdvantage', amount: 2 }], { idNeuf: idNeufDeBanc, rng: desDuTest, caster: h });
    applyOps(h, [{ op: 'topUpAdvantage', amount: 2 }], { idNeuf: idNeufDeBanc, rng: desDuTest, caster: h });
    expect(h.advantage).toBe(2);
    h.advantage = 4;
    applyOps(h, [{ op: 'topUpAdvantage', amount: 2 }], { idNeuf: idNeufDeBanc, rng: desDuTest, caster: h });
    expect(h.advantage).toBe(4);
  });

  it('`spendAdvantage` sans `amount` fait perdre TOUS les Avantages (LDB 14 l.219)', () => {
    const h = heros();
    h.advantage = 4;
    applyOps(h, [{ op: 'spendAdvantage' }], { idNeuf: idNeufDeBanc, rng: desDuTest, caster: h });
    expect(h.advantage).toBe(0);
  });
});

describe('avantageDeCampSansFiche — l’Avantage d’un camp sans fiche (#2333)', () => {
  it('lit le vocabulaire d’Avantage par les primitives : gain plafonné, perte totale ou de 1, plancher 0', () => {
    expect(avantageDeCampSansFiche(1, [{ op: 'gainAdvantage', amount: 1 }], 3, desDuTest)).toBe(2);
    expect(avantageDeCampSansFiche(2, [{ op: 'gainAdvantage', amount: 5 }], 3, desDuTest), 'plafond').toBe(3);
    expect(avantageDeCampSansFiche(3, [{ op: 'spendAdvantage' }], 3, desDuTest), 'tout').toBe(0);
    expect(avantageDeCampSansFiche(2, [{ op: 'spendAdvantage', amount: 1 }], 3, desDuTest)).toBe(1);
    expect(avantageDeCampSansFiche(0, [{ op: 'spendAdvantage', amount: 1 }], 3, desDuTest), 'plancher').toBe(0);
  });

  it('une op hors du vocabulaire d’Avantage LÈVE, nommée', () => {
    expect(() => avantageDeCampSansFiche(0, [{ op: 'topUpAdvantage', amount: 1 }], 3, desDuTest)).toThrow(/topUpAdvantage/);
  });

  it('chaque `roundOps.winner` des jeux de taverne est lisible par lui', () => {
    for (const g of TAVERN_GAMES) {
      if (!g.roundOps?.winner) continue;
      expect(() => avantageDeCampSansFiche(0, g.roundOps!.winner!, 10, desDuTest), g.id).not.toThrow();
    }
  });
});
