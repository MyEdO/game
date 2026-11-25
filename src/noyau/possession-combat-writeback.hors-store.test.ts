/**
 * Cascade combat → Possession (#618, #4804) — une bête possédée entre en rencontre par `projeterLaBete`
 * (`Combatant.id === Possession.uid`) ; à la fin du combat, `finalizeBattle` écrit son état sur la possession :
 * blessée → `blessures`, morte → `destroyed:true` (items CO-LOCALISÉS), indemne → aucune Blessure portée.
 */
import { idsDeTest } from '../engine/idsDeTest.testkit';
import { describe, it, expect, beforeEach } from 'vitest';
import { ouvrirLeBanc, type Banc } from './banc.testkit';
import { finalizeBattle } from './combatFlow';
import { createHero } from '../engine/character';
import { testScene } from '../scenes/test-fixture';
import { inBattleId } from './monde/combatants';
import type { Possession } from '../engine/possession';
import type { ItemInstance } from '../engine/types';

let banc: Banc;
beforeEach(() => { banc = ouvrirLeBanc(); });

describe('finalizeBattle — writeback de la bête possédée (#618, #4804)', () => {
  function rencontre(blessures?: number) {
    const W = createHero({ idNeuf: idsDeTest, speciesId: 'humains-reiklander', careerId: 'soldat', label: 'W', seed: 3 });
    banc.setState({ party: [W] });
    banc.getState().lancerLaScene(testScene());
    const mule: Possession = {
      uid: 'pos-1', nature: 'bete', ownerId: W.id, label: 'Marguerite',
      location: { kind: 'avec-le-groupe' }, items: [{ itemId: 'sac-a-dos', qty: 1 } as unknown as ItemInstance],
      ref: { id: 'mule' }, sansCavalier: true, ...(blessures !== undefined ? { blessures } : {}),
    };
    banc.setState({ possessions: [mule] });
    banc.getState().lancerLeCombat('enc-mutants');
    const bete = inBattleId(banc.getState().battle!, 'pos-1')!;
    expect(bete.kind, 'prémisse : la mule entre en rencontre').toBe('heros');
    return bete;
  }
  const possession = () => banc.getState().possessions.find((x) => x.uid === 'pos-1');

  it('blessée sans Blessures portées → ses Blessures courantes sont écrites sur la possession', () => {
    const bete = rencontre();
    bete.wounds.current = bete.wounds.max - 3;
    finalizeBattle(banc.getState, banc.setState);
    expect(possession()).toMatchObject({ blessures: bete.wounds.max - 3 });
  });

  it('entre avec ses Blessures portées, puis les garde à la sortie', () => {
    const bete = rencontre(2);
    expect(bete.wounds.current).toBe(2);
    finalizeBattle(banc.getState, banc.setState);
    expect(possession()).toMatchObject({ blessures: 2 });
  });

  it('rétablie au maximum du profil → la possession ne porte plus de Blessures', () => {
    const bete = rencontre(2);
    bete.wounds.current = bete.wounds.max;
    finalizeBattle(banc.getState, banc.setState);
    expect(possession()).not.toHaveProperty('blessures');
  });

  it('tuée → destroyed:true, items CO-LOCALISÉS', () => {
    const bete = rencontre();
    bete.wounds.current = 0;
    bete.dead = true;
    finalizeBattle(banc.getState, banc.setState);
    expect(possession()).toMatchObject({ destroyed: true, items: [expect.anything()] });
  });
});
