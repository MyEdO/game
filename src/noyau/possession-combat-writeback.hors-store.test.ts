/**
 * Cascade combat → Possession (#618 SOCLE POSSESSIONS, dernier item DoD) — un combattant issu d'une
 * Possession (bête montée/de bât en pièce, convention `Combatant.id === Possession.uid`, `pos-N`) qui
 * finit le combat écrit son état vers le registre `possessions` — MÊME couture que le writeback héros
 * (`carryOverState`) déjà fait par `finalizeBattle` : blessée → `wounds.current` persisté (clampé à son
 * max) ; morte → `destroyed:true`, ses `items`/`cargo` restent CO-LOCALISÉS sur la Possession (jamais
 * évaporés — miroir du patron `travelFlow.ts` bête abandonnée : `{ ...p, destroyed: true }`).
 */
import { idsDeTest } from '../engine/idsDeTest.testkit';
import { describe, it, expect, beforeEach } from 'vitest';
import { ouvrirLeBanc, type Banc } from './banc.testkit';
import { finalizeBattle } from './combatFlow';
import { createHero } from '../engine/character';
import { testScene } from '../scenes/test-fixture';
import type { Possession } from '../engine/possession';
import type { Combatant, ItemInstance } from '../engine/types';
import { blessuresDeBase, blessuresSurLeProfil } from '../engine/combattantDeTest.testkit';

let banc: Banc;
beforeEach(() => { banc = ouvrirLeBanc(); });

describe('finalizeBattle — writeback Possession (bête/serviteur/véhicule en pièce, #618)', () => {
  function setup() {
    const W = createHero({ idNeuf: idsDeTest, speciesId: 'humains-reiklander', careerId: 'soldat', label: 'W', seed: 3 });
    banc.setState({ party: [W] });
    banc.getState().lancerLaScene(testScene());
    banc.getState().lancerLeCombat('enc-mutants');
    banc.getState().fenetreValider('debutDuRound');
    banc.abandonner();
    return banc.getState().battle!;
  }

  const mule = (uid: string): Possession => ({
    uid, nature: 'bete', ownerId: 'W', label: 'Marguerite',
    location: { kind: 'avec-le-groupe' }, items: [{ itemId: 'sac-a-dos', qty: 1 } as unknown as ItemInstance],
    ref: { id: 'mule' }, wounds: { current: 8, max: 8 },
  });

  it('bête possession BLESSÉE en combat → wounds persisté sur la Possession (clampé à son max)', () => {
    const battle = setup();
    banc.setState({ possessions: [mule('pos-1')] });
    const combatant: Combatant = blessuresSurLeProfil({
      ...battle.combatants[0], id: 'pos-1', label: 'Marguerite', kind: 'pnj',
      wounds: blessuresDeBase(8, 3), dead: false,
    });
    banc.setState({ battle: { ...battle, combatants: [...battle.combatants, combatant] } });
    finalizeBattle(banc.getState, banc.setState);
    const p = banc.getState().possessions.find((x) => x.uid === 'pos-1');
    expect(p?.nature === 'bete' && p.wounds).toEqual({ current: 3, max: 8 });
  });

  it('bête possession TUÉE en combat → destroyed:true, items CO-LOCALISÉS (pas évaporés)', () => {
    const battle = setup();
    banc.setState({ possessions: [mule('pos-1')] });
    const combatant: Combatant = blessuresSurLeProfil({
      ...battle.combatants[0], id: 'pos-1', label: 'Marguerite', kind: 'pnj',
      wounds: blessuresDeBase(8, 0), dead: true,
    });
    banc.setState({ battle: { ...battle, combatants: [...battle.combatants, combatant] } });
    finalizeBattle(banc.getState, banc.setState);
    const p = banc.getState().possessions.find((x) => x.uid === 'pos-1');
    expect(p?.destroyed).toBe(true);
    expect(p?.items).toHaveLength(1);
  });

  it('bête possession SURVIT indemne → aucune mutation, wounds inchangé, destroyed absent', () => {
    const battle = setup();
    banc.setState({ possessions: [mule('pos-1')] });
    const combatant: Combatant = blessuresSurLeProfil({
      ...battle.combatants[0], id: 'pos-1', label: 'Marguerite', kind: 'pnj',
      wounds: blessuresDeBase(8), dead: false,
    });
    banc.setState({ battle: { ...battle, combatants: [...battle.combatants, combatant] } });
    finalizeBattle(banc.getState, banc.setState);
    const p = banc.getState().possessions.find((x) => x.uid === 'pos-1');
    expect(p?.destroyed).toBeUndefined();
    expect(p?.nature === 'bete' && p.wounds).toEqual({ current: 8, max: 8 });
  });
});
