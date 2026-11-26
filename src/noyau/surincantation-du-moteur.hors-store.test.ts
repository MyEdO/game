/**
 * Surincantation d'un lanceur conduit par le moteur hors combat (`surincantationDuMoteur`) : le Béni d'une partie en
 * cadence automatique, sans plateau, comme la prière du hameau du roguelite. Le jet se pose par ses coutures
 * (`incanterLeSort`, puis `jetImposerLeResultat('incantation')`). LDB 41 l.21-27
 */
import { idsDeTest } from '../engine/idsDeTest.testkit';
import { describe, it, expect } from 'vitest';
import { ouvrirLeBanc } from './banc.testkit';
import { gesteDIncantation } from './combatSlice';
import { groupeDeScenario } from '../scenes/test-scenarios/_heros';
import type { Combatant } from '../engine/types';

const GUERISON = 'benediction-de-guerison';

describe('Surincantation du moteur hors combat (LDB 41 l.21-27)', () => {
  it('Guérison, quatre blessés : le plan suit le jet relancé, et à +9 DR les quatre sont soignés', () => {
    const [pretre, ...autres] = groupeDeScenario(idsDeTest, 'pretre', 'soldat', 'tueur', 'chasseur', 'apothicaire');
    pretre.spells = [...new Set([...(pretre.spells ?? []), GUERISON])];
    pretre.skills = [...pretre.skills.filter((s) => s.id !== 'priere'), { id: 'priere', characteristic: 'sociabilite', advances: 120 }] as typeof pretre.skills;
    const blesses = autres.map((c) => ({ ...c, wounds: { ...c.wounds, current: c.wounds.max - 3 } })) as Combatant[];
    const banc = ouvrirLeBanc({ cadence: 'auto', graine: 6, etat: { party: [pretre, ...blesses] } });
    const geste = gesteDIncantation(banc.getState(), pretre.id, GUERISON, blesses[0].id)!.geste;
    (banc.actions as unknown as Record<string, (...a: unknown[]) => void>)[geste.verbe](...geste.args);
    banc.jusquA((e) => !!e.pendingCast?.result);
    expect(banc.getState().pendingCast?.result?.sl, 'témoin : le jet de la graine').toBe(4);
    expect(banc.getState().pendingCast?.overcast).toEqual({ range: 0, zone: 0, duration: 0, targets: 2, damage: 0 });
    banc.getState().jetImposerLeResultat('incantation', 3); // cible 99 : DR 9 − 0 = 9
    expect(banc.getState().pendingCast?.result?.sl).toBe(9);
    expect(banc.getState().pendingCast?.overcast).toEqual({ range: 0, zone: 0, duration: 0, targets: 3, damage: 0 });
    expect(banc.getState().pendingCast?.extraTargetIds).toEqual(blesses.slice(1).map((c) => c.id));
    banc.reprendreTout();
    const soignes = banc.getState().party.filter((c) => blesses.some((b) => b.id === c.id) && c.wounds.current > c.wounds.max - 3).map((c) => c.id);
    expect(soignes).toEqual(blesses.map((c) => c.id));
  });
});
