/**
 * #458 : le DR (SL) d'un Test de consommable HORS COMBAT doit atteindre les ops de succès du Flow —
 * chaîne utiliserLObjet→runSceneConsumableFlow→openSkillTest→jetValider('test')→runFlow→applyEffectsLoot→
 * applyEffects→handler 'ops' (`combatEffects.ts`), symétrique au chemin combat (`testDeclenche.ts:159`,
 * `runPureFlowLines(..., { sl: t.sl })`). Donnée réelle : Gesundheit (`trappings.json`, MSRC 4 l.186) —
 * `reduceDiseaseDays.daysPerSL` sur `blessure-purulente`.
 */
import { idsDeTest } from '../engine/idsDeTest.testkit';
import { describe, it, expect, beforeEach } from 'vitest';
import { ouvrirLeBanc, type Banc } from './banc.testkit';
import { createHero } from '../engine/character';
import { itemFromTrappingById } from '../engine/items';
import { seedBattleRng } from './battleRng';
import { MINUTES_PER_DAY } from '../engine/clock';
import type { Combatant } from '../engine/types';

let banc: Banc;
beforeEach(() => { banc = ouvrirLeBanc(); });

function hero(name: string, over: Partial<Combatant> = {}): Combatant {
  const h = createHero({ idNeuf: idsDeTest, speciesId: 'humains-reiklander', careerId: 'soldat', label: name, seed: 1 });
  return { ...h, id: name, ...over } as Combatant;
}

function giveItem(h: Combatant, trappingId: string, uid: string): void {
  const it = itemFromTrappingById(trappingId, idsDeTest)!;
  it.uid = uid;
  h.items = [...(h.items ?? []), it];
}

function sickHero(): Combatant {
  const h = hero('h1');
  h.diseases = [{
    id: 'blessure-purulente', symptoms: [], phase: 'active',
    minutesLeft: 20 * MINUTES_PER_DAY, durationMinutes: 20 * MINUTES_PER_DAY,
  }];
  return h;
}

beforeEach(() => {
  seedBattleRng(42);
  banc.setState({ gameTime: 8 * 60, lastUpkeepDay: 0 });
});

describe('Gesundheit hors combat (#458) — le DR du Test de scène atteint reduceDiseaseDays.daysPerSL', () => {
  it('Test réussi à DR+3 : la Blessure Purulente perd 3 jours', () => {
    const h = sickHero();
    giveItem(h, 'gesundheit', 'g1');
    banc.setState({ party: [h] });

    banc.getState().utiliserLObjet('g1');
    const pt = banc.getState().pendingTest!;
    expect(pt).toBeTruthy();
    expect(pt.actorId).toBe('h1');

    const before = banc.getState().party.find((c) => c.id === 'h1')!.diseases![0].minutesLeft;
    banc.setState({ pendingTest: { ...pt, roll: 1, success: true, sl: 3 } });
    banc.getState().jetValider('test');

    const after = banc.getState().party.find((c) => c.id === 'h1')!.diseases![0].minutesLeft;
    expect(before - after).toBe(3 * MINUTES_PER_DAY);
  });

  it('Test réussi à DR 0 : aucun jour perdu', () => {
    const h = sickHero();
    giveItem(h, 'gesundheit', 'g1');
    banc.setState({ party: [h] });

    banc.getState().utiliserLObjet('g1');
    const pt = banc.getState().pendingTest!;
    const before = banc.getState().party.find((c) => c.id === 'h1')!.diseases![0].minutesLeft;
    banc.setState({ pendingTest: { ...pt, roll: 1, success: true, sl: 0 } });
    banc.getState().jetValider('test');

    const after = banc.getState().party.find((c) => c.id === 'h1')!.diseases![0].minutesLeft;
    expect(before - after).toBe(0);
  });
});
