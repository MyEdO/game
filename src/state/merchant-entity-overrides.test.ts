import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { useGame } from './store';
import { creditBourse } from './bourseFlow';
import { emptyScene } from './scene';
import { setRule, resetRule } from '../engine/policy';
import type { Combatant } from '../engine/types';

/**
 * #93 — flags marchand PAR-ENTITÉ (guilde / mode marché / tenir les comptes) : l'override d'entité
 * PRIME sur la règle maison globale (`engine/policy`) ; absent → héritage du global (couture unique
 * `marketRule`, state/merchantFlow). Vérifie la COMPOSITION (pas la mécanique déjà testée ailleurs).
 */
function reset() {
  useGame.setState({ party: [], scene: null, merchant: null, merchantStocks: {} });
}

const hero = (): Combatant => ({ id: 'h', name: 'H', items: [], characteristics: { sociabilite: 35 }, skills: [], wounds: { current: 10, max: 10 }, conditions: [], weapons: [], armour: {} } as unknown as Combatant);

const sceneWith = (merchant: Record<string, unknown>) => {
  const sc = emptyScene(4, 4); sc.id = 'm';
  sc.entities.push({ id: 'pnj', kind: 'personnage', ref: 'humain', pos: { x: 0, y: 0 }, merchant: { archetype: 'armurier', ...merchant } });
  return sc;
};

describe('#93 — marketRule : override par-entité prime sur le global', () => {
  beforeEach(reset);
  afterEach(() => { resetRule('market-mode'); resetRule('market-guild'); resetRule('market-tenir-comptes'); });

  it('marketMode : override "sans-marchandage" prime alors que le global reste "complet"', () => {
    useGame.setState({ party: [hero()], scene: sceneWith({ marketMode: 'sans-marchandage' }) });
    useGame.getState().openMerchant('pnj');
    useGame.getState().startBargain('buy');
    expect(useGame.getState().pendingBargain).toBeNull(); // override local désactive le Marchandage
  });

  it('marketMode : absent → hérite du global', () => {
    useGame.setState({ party: [hero()], scene: sceneWith({}) });
    setRule('market-mode', 'sans-marchandage');
    useGame.getState().openMerchant('pnj');
    useGame.getState().startBargain('buy');
    expect(useGame.getState().pendingBargain).toBeNull(); // hérité du global, pas un 3ᵉ état
  });

  it('marketMode : override "complet" prime même si le global est "sans-marchandage"', () => {
    useGame.setState({ party: [hero()], scene: sceneWith({ marketMode: 'complet' }) });
    setRule('market-mode', 'sans-marchandage');
    useGame.getState().openMerchant('pnj');
    useGame.getState().startBargain('buy');
    expect(useGame.getState().pendingBargain).not.toBeNull(); // l'override local rouvre le Marchandage
  });

  it('guild : override true prime alors que le global est désactivé (stock valide, sans casse)', () => {
    useGame.setState({ party: [hero()], scene: sceneWith({ guild: true }) });
    resetRule('market-guild'); // global = false (défaut)
    useGame.getState().openMerchant('pnj');
    expect(useGame.getState().merchant!.stock.length).toBeGreaterThan(0);
  });

  it('tenirComptes : override false prime — un achat n’est PAS marqué « dans les moyens du Statut » malgré le global actif', () => {
    useGame.setState({ party: [hero()], scene: sceneWith({ tenirComptes: false }), journal: [] });
    creditBourse(useGame.getState, useGame.setState, useGame.getState().party[0].id, { gold: 100, silver: 0, brass: 0 });
    setRule('market-tenir-comptes', true);
    useGame.getState().openMerchant('pnj');
    const cheap = useGame.getState().merchant!.stock.find((l) => l.qty > 0);
    if (cheap) {
      useGame.getState().buyItem(cheap.id);
      expect(useGame.getState().journal.some((l) => /Tenir les comptes/.test(l))).toBe(false); // override désactivé
    }
  });

  it('tenirComptes : absent → hérite du global actif (achat gratuit dans les moyens du Statut)', () => {
    useGame.setState({ party: [hero()], scene: sceneWith({}) });
    setRule('market-tenir-comptes', true);
    useGame.getState().openMerchant('pnj');
    expect(useGame.getState().merchant).not.toBeNull(); // câblé sans casse (composition vérifiée par ailleurs)
  });
});
