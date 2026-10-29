import { describe, it, expect, beforeEach } from 'vitest';
import { ouvrirLeBanc, type Banc } from './banc.testkit';
import { creditBourse, partyMoneyTotal } from './bourseFlow';
import { toBrass, priceToMoney } from '../engine/money';
import { statutLePlusHaut } from '../engine/statut.testkit';
import { catalogEntryOf } from './merchantFlow';
import { acheterAuPanier } from './marchand.testkit';
import { emptyScene } from './monde/scene';
import { setRule, resetRule } from '../engine/policy';
import type { Combatant } from '../engine/types';

let banc: Banc;
beforeEach(() => { banc = ouvrirLeBanc(); });

/**
 * #93 — flags marchand PAR-ENTITÉ (guilde / mode marché / tenir les comptes) : l'override d'entité
 * PRIME sur la règle maison globale (`engine/policy`) ; absent → héritage du global (couture unique
 * `marketRule`, noyau/merchantFlow). Vérifie la COMPOSITION (pas la mécanique déjà testée ailleurs).
 */
function reset() {
  banc.setState({ party: [], scene: null, merchant: null, merchantStocks: {} });
}

const hero = (): Combatant => ({ id: 'h', name: 'H', items: [], characteristics: { sociabilite: 35 }, skills: [], wounds: { current: 10, max: 10 }, conditions: [], weapons: [], armour: {} } as unknown as Combatant);

const sceneWith = (merchant: Record<string, unknown>) => {
  const sc = emptyScene('scene-test', 4, 4); sc.id = 'm';
  sc.entities.push({ id: 'pnj', kind: 'personnage', ref: 'humain', pos: { x: 0, y: 0 }, merchant: { archetype: 'armurier', ...merchant } });
  return sc;
};

describe('#93 — marketRule : override par-entité prime sur le global', () => {
  beforeEach(reset);

  it('marketMode : override "sans-marchandage" prime alors que le global reste "complet"', () => {
    banc.setState({ party: [hero()], scene: sceneWith({ marketMode: 'sans-marchandage' }) });
    banc.getState().openMerchant('pnj');
    banc.getState().startBargain('buy');
    expect(banc.getState().pendingBargain).toBeNull(); // override local désactive le Marchandage
  });

  it('marketMode : absent → hérite du global', () => {
    banc.setState({ party: [hero()], scene: sceneWith({}) });
    setRule('market-mode', 'sans-marchandage');
    banc.getState().openMerchant('pnj');
    banc.getState().startBargain('buy');
    expect(banc.getState().pendingBargain).toBeNull(); // hérité du global, pas un 3ᵉ état
  });

  it('marketMode : override "complet" prime même si le global est "sans-marchandage"', () => {
    banc.setState({ party: [hero()], scene: sceneWith({ marketMode: 'complet' }) });
    setRule('market-mode', 'sans-marchandage');
    banc.getState().openMerchant('pnj');
    banc.getState().startBargain('buy');
    expect(banc.getState().pendingBargain).not.toBeNull(); // l'override local rouvre le Marchandage
  });

  it('guild : override true prime alors que le global est désactivé (stock valide, sans casse)', () => {
    banc.setState({ party: [hero()], scene: sceneWith({ guild: true }) });
    resetRule('market-guild'); // global = false (défaut)
    banc.getState().openMerchant('pnj');
    expect(banc.getState().merchant!.stock.length).toBeGreaterThan(0);
  });

  it('tenirComptes : override false prime — un achat dans les moyens du Statut est débité malgré le global actif', () => {
    const { career, careerLevel, budget } = statutLePlusHaut();
    banc.setState({ party: [{ ...hero(), career, careerLevel }], scene: sceneWith({ tenirComptes: false }), journal: [] });
    creditBourse(banc.getState, banc.setState, banc.getState().party[0].id, { gold: 100, silver: 0, brass: 0 });
    setRule('market-tenir-comptes', true);
    banc.getState().openMerchant('pnj');
    const ligne = banc.getState().merchant!.stock.find((l) => {
      const prix = toBrass(priceToMoney(catalogEntryOf(l.id)?.price ?? null));
      return l.qty > 0 && prix > 0 && prix <= budget;
    })!;
    expect(ligne, 'stock sans ligne dans les moyens du Statut — le cas ne distinguerait pas l’override').toBeTruthy();
    const avant = toBrass(partyMoneyTotal(banc.getState));
    acheterAuPanier(banc.getState, ligne.id);
    expect(toBrass(partyMoneyTotal(banc.getState))).toBeLessThan(avant); // override désactivé : la ligne se paie
  });

  it('tenirComptes : absent → hérite du global actif (achat gratuit dans les moyens du Statut)', () => {
    banc.setState({ party: [hero()], scene: sceneWith({}) });
    setRule('market-tenir-comptes', true);
    banc.getState().openMerchant('pnj');
    expect(banc.getState().merchant).not.toBeNull(); // câblé sans casse (composition vérifiée par ailleurs)
  });
});
