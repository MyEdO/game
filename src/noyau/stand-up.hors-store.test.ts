import { idsDeTest } from '../engine/idsDeTest.testkit';
import { describe, it, expect, beforeEach } from 'vitest';
import { ouvrirLeBanc, type Banc } from './banc.testkit';
import { createHero } from '../engine/character';
import { testScene } from '../scenes/test-fixture';
import { hasCondition } from '../engine/conditions';
import { blessuresDeBase } from '../engine/combattantDeTest.testkit';

let banc: Banc;
beforeEach(() => { banc = ouvrirLeBanc(); });

describe('À Terre — se relever / pas de Course (LDB 16 l.37, 18 l.15)', () => {
  beforeEach(() => {
    banc.setState({ battle: null });
  });

  function setup() {
    const hero = createHero({ idNeuf: idsDeTest, speciesId: 'humains-reiklander', careerId: 'soldat', label: 'H', seed: 1 });
    banc.setState({ party: [hero] });
    banc.getState().lancerLaScene(testScene());
    banc.getState().lancerLeCombat('enc-mutants');
    banc.getState().fenetreValider('debutDuRound');
    banc.abandonner();
    const b = banc.getState().battle!;
    const H = b.combatants.find((c) => c.kind === 'heros')!;
    H.engagedWith = [];
    const turn = b.order.indexOf(H.id);
    banc.setState({ battle: { ...b, turn, movementUsed: 0, acted: false } });
    return { H };
  }

  it('À Terre + ≥1 PB → seRelever retire À Terre et consomme le Mouvement (pas l’Action)', () => {
    const { H } = setup();
    H.conditions = [{ id: 'a-terre', value: 1 }];
    H.wounds = blessuresDeBase(12, 5, H);
    banc.setState({ battle: { ...banc.getState().battle! } });
    banc.getState().seRelever();
    const st = banc.getState();
    const h = st.battle!.combatants.find((c) => c.id === H.id)!;
    expect(hasCondition(h, 'a-terre')).toBe(false);
    expect(st.battle!.movementUsed).toBeGreaterThan(0); // se relever consomme le (plein) Mouvement
    expect(st.battle!.acted).toBe(false); // l'Action reste disponible
  });

  it('À Terre + 0 PB → ne peut PAS se relever (LDB 18 l.15)', () => {
    const { H } = setup();
    H.conditions = [{ id: 'a-terre', value: 1 }];
    H.wounds = blessuresDeBase(12, 0, H);
    banc.setState({ battle: { ...banc.getState().battle! } });
    banc.getState().seRelever();
    const h = banc.getState().battle!.combatants.find((c) => c.id === H.id)!;
    expect(hasCondition(h, 'a-terre')).toBe(true); // reste au sol
  });

  it('À Terre → ouvrirLaCourse n’ouvre rien (pas de Course au sol)', () => {
    const { H } = setup();
    H.conditions = [{ id: 'a-terre', value: 1 }];
    H.wounds = blessuresDeBase(12, 5, H);
    banc.setState({ battle: { ...banc.getState().battle! }, pendingRun: null });
    banc.getState().ouvrirLaCourse();
    expect(banc.getState().pendingRun).toBeNull();
  });
});
