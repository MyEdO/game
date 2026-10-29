/**
 * « Tenir les comptes » (LDB 59 l.9-11) — câblage marchand : quand l'option `market-tenir-comptes`
 * est active, un objet dont le prix listé est ≤ au niveau de Statut du groupe s'achète SANS débit
 * (« autant de fois que nécessaire »). Consomme `statusBudgetBrass` (engine/money), jusque-là inerte.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { useGame } from './store';
import { acheterAuPanier } from '../noyau/marchand.testkit';
import { emptyScene } from '../noyau/monde/scene';
import { statutLePlusHaut } from '../engine/statut.testkit';
import { toBrass } from '../engine/money';
import { creditBourse, partyMoneyTotal } from '../noyau/bourseFlow';
import { setRule, resetRule } from '../engine/policy';
import type { Combatant } from '../engine/types';

const richHero = (): Combatant => {
  const { career, careerLevel } = statutLePlusHaut();
  return { id: 'h', name: 'H', career, careerLevel, items: [], skills: [], talents: [], characteristics: {}, wounds: { current: 10, max: 10 }, conditions: [], weapons: [], armour: {} } as unknown as Combatant;
};

const merchantScene = () => {
  const sc = emptyScene('scene-test', 4, 4); sc.id = 'm';
  sc.entities.push({ id: 'pnj', kind: 'personnage', ref: 'humain', pos: { x: 0, y: 0 }, merchant: { archetype: 'armurier' } } as never);
  return sc;
};

beforeEach(() => { useGame.getState().seedRng(4); });
afterEach(() => resetRule('market-tenir-comptes'));

describe('Tenir les comptes (LDB 59 l.9-11)', () => {
  it('option active : un objet ≤ Statut du groupe est acquis sans débit', () => {
    setRule('market-tenir-comptes', true);
    useGame.setState({ party: [richHero()], scene: merchantScene() });
    creditBourse(useGame.getState, useGame.setState, useGame.getState().party[0].id, { gold: 50, silver: 0, brass: 0 });
    useGame.getState().openMerchant('pnj');
    const line = useGame.getState().merchant!.stock.find((l) => l.qty > 0)!;
    const before = toBrass(partyMoneyTotal(useGame.getState));
    acheterAuPanier(useGame.getState, line.id);
    const st = useGame.getState();
    expect(st.party[0].items!.some((i) => i.trappingId === line.id)).toBe(true); // objet reçu
    expect(toBrass(partyMoneyTotal(useGame.getState))).toBe(before); // aucune pièce comptée (dans les moyens du Statut)
  });

  it('option désactivée : même achat débité normalement (RAW)', () => {
    setRule('market-tenir-comptes', false);
    useGame.setState({ party: [richHero()], scene: merchantScene() });
    creditBourse(useGame.getState, useGame.setState, useGame.getState().party[0].id, { gold: 50, silver: 0, brass: 0 });
    useGame.getState().openMerchant('pnj');
    const line = useGame.getState().merchant!.stock.find((l) => l.qty > 0)!;
    const before = toBrass(partyMoneyTotal(useGame.getState));
    acheterAuPanier(useGame.getState, line.id);
    expect(toBrass(partyMoneyTotal(useGame.getState))).toBeLessThan(before); // débité
  });
});
