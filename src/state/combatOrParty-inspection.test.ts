/**
 * LIAISON WEB du clic de combat (#1822, #240) : la fiche ouverte (`inspectId`, clé de l'adaptateur) ne change pas le
 * verdict de `combatantClickActs`. Le décideur est au noyau (`src/noyau/combatOrParty.hors-store.test.ts`).
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { useGame } from './store';
import { combatantClickActs } from '../noyau/combatOrParty';
import { poserLeCombat } from '../noyau/combatOrParty.testkit';
import { combattantDeTest } from '../engine/combattantDeTest.testkit';

describe('combatantClickActs — la fiche ouverte de l’adaptateur', () => {
  beforeEach(() => { useGame.setState({ battle: null, party: [], inspectId: null }); });
  const combat = (over?: Record<string, unknown>) => poserLeCombat(useGame.setState, over);

  it('aucun MODE d’inspection ne coupe le clic (#1822) : fiche de l’ennemi ouverte, il s’attaque toujours ; l’allié, jamais', () => {
    const { enemy, ally } = combat();
    useGame.setState({ inspectId: enemy.id });
    expect(combatantClickActs(useGame.getState, enemy)).toBe(true);
    expect(combatantClickActs(useGame.getState, ally)).toBe(false);
  });

  it('COQUE ennemie (#240) : le verdict du clic ne dépend pas de la fiche ouverte', () => {
    combat();
    const hull = combattantDeTest({ id: 'hull1', label: 'Le Serpent de Sel', kind: 'pnj', bodyShape: 'vehicule' });
    useGame.setState({ battle: { ...useGame.getState().battle!, combatants: [...useGame.getState().battle!.combatants, hull] } });
    const avant = combatantClickActs(useGame.getState, hull);
    useGame.setState({ inspectId: hull.id });
    expect(combatantClickActs(useGame.getState, hull)).toBe(avant);
  });
});
