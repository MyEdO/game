/**
 * « Tenir les comptes » (LDB 59 l.9-11) — câblage marchand : quand l'option `market-tenir-comptes`
 * est active, un objet dont le prix listé est ≤ au niveau de Statut du groupe s'achète SANS débit
 * (« autant de fois que nécessaire »). Consomme `statusBudgetBrass` (engine/money), jusque-là inerte.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { ouvrirLeBanc, type Banc } from './banc.testkit';
import { acheterAuPanier } from './marchand.testkit';
import { emptyScene } from './monde/scene';
import { statutLePlusHaut } from '../engine/statut.testkit';
import { toBrass } from '../engine/money';
import { creditBourse, partyMoneyTotal } from './bourseFlow';
import { setRule } from '../engine/policy';
import type { Combatant } from '../engine/types';

let banc: Banc;
beforeEach(() => { banc = ouvrirLeBanc(); });

const richHero = (): Combatant => {
  const { career, careerLevel } = statutLePlusHaut();
  return { id: 'h', name: 'H', career, careerLevel, items: [], skills: [], talents: [], characteristics: {}, wounds: { current: 10, max: 10 }, conditions: [], weapons: [], armour: {} } as unknown as Combatant;
};

const merchantScene = () => {
  const sc = emptyScene('scene-test', 4, 4); sc.id = 'm';
  sc.entities.push({ id: 'pnj', kind: 'personnage', ref: 'humain', pos: { x: 0, y: 0 }, merchant: { archetype: 'armurier' } } as never);
  return sc;
};

beforeEach(() => { banc.getState().seedRng(4); });

describe('Tenir les comptes (LDB 59 l.9-11)', () => {
  it('option active : un objet ≤ Statut du groupe est acquis sans débit', () => {
    setRule('market-tenir-comptes', true);
    banc.setState({ party: [richHero()], scene: merchantScene() });
    creditBourse(banc.getState, banc.setState, banc.getState().party[0].id, { gold: 50, silver: 0, brass: 0 });
    banc.getState().openMerchant('pnj');
    const line = banc.getState().merchant!.stock.find((l) => l.qty > 0)!;
    const before = toBrass(partyMoneyTotal(banc.getState));
    acheterAuPanier(banc.getState, line.id);
    const st = banc.getState();
    expect(st.party[0].items!.some((i) => i.trappingId === line.id)).toBe(true); // objet reçu
    expect(toBrass(partyMoneyTotal(banc.getState))).toBe(before); // aucune pièce comptée (dans les moyens du Statut)
  });

  it('option désactivée : même achat débité normalement (RAW)', () => {
    setRule('market-tenir-comptes', false);
    banc.setState({ party: [richHero()], scene: merchantScene() });
    creditBourse(banc.getState, banc.setState, banc.getState().party[0].id, { gold: 50, silver: 0, brass: 0 });
    banc.getState().openMerchant('pnj');
    const line = banc.getState().merchant!.stock.find((l) => l.qty > 0)!;
    const before = toBrass(partyMoneyTotal(banc.getState));
    acheterAuPanier(banc.getState, line.id);
    expect(toBrass(partyMoneyTotal(banc.getState))).toBeLessThan(before); // débité
  });
});
