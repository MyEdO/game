import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { imposerLesD100 } from '../noyau/battleRng.testkit';
import { useGame } from './store';
import { makePregens } from '../data/pregens';
import { setRule, resetRule } from '../engine/policy';
import { emptyScene } from '../noyau/monde/scene';
import { testValue } from '../engine/skills';
import { describeBargain } from '../noyau/flowOutcomes';
import type { Combatant, SkillInstance } from '../engine/types';
import { idNeufDeBanc } from '../lib/entityId.testkit';

/**
 * #2547 — Marchandage de VENTE gagné par un Négociateur, par la couture du jeu (`startBargain` →
 * `bargainRoll` → `bargainConfirm`) : LDB 59 l.54, LDB 10 l.818 ; arbitrage #2547 (2026-10-09).
 */
const get = useGame.getState.bind(useGame);
const set = useGame.setState.bind(useGame);

/** Meneur Négociateur à exactement 80 en Marchandage. */
function negociateur(): Combatant {
  const [h] = makePregens(idNeufDeBanc);
  h.talents = [...h.talents.filter((t) => t.talentId !== 'negociateur'), { talentId: 'negociateur', times: 1 }];
  h.skills = h.skills.filter((s) => s.id !== 'marchandage');
  h.skills.push({ id: 'marchandage', advances: 0 } as SkillInstance);
  h.skills[h.skills.length - 1].advances = 80 - testValue(h, 'marchandage');
  return h;
}

/** Ouvre l'armurier ambulant (Marchandage 45) et marchande la VENTE, d100 imposés (joueur, marchand). */
function marchanderLaVente(joueur: number, marchand: number): void {
  const sc = emptyScene('scene-test', 4, 4); sc.id = 'm';
  sc.entities.push({ id: 'pnj', kind: 'personnage', ref: 'humain', pos: { x: 0, y: 0 }, merchant: { archetype: 'armurier' } } as never);
  set({ party: [negociateur()], scene: sc, merchant: null, merchantStocks: {}, journal: [], pendingCascade: null, pendingBargain: null } as never);
  get().openMerchant('pnj');
  get().startBargain('sell');
  imposerLesD100(joueur, marchand);
  get().bargainRoll();
}

describe('#2547 — vente marchandée par un Négociateur (LDB 59 l.54, LDB 10 l.818)', () => {
  beforeEach(() => setRule('test-auto-bands', 'off'));
  afterEach(() => { resetRule('test-auto-bands'); vi.restoreAllMocks(); });

  it('gagnée sans Stupéfiant : ½ du listé, +10 % — libellé et issue retenue', () => {
    marchanderLaVente(70, 40); // 70 sur 80 → DR 1 ; 40 sur 45 → DR 0
    const pb = get().pendingBargain!;
    expect(pb.negotiator).toBe(true);
    expect(pb.result!.attackerWins).toBe(true);
    expect(describeBargain(pb)).toBe('Gagné (½ du prix listé, +10 %)');
    get().bargainConfirm();
    expect(get().merchant!.bargainSell).toMatchObject({ won: true, negotiator: true });
  });

  it('gagnée de 6 DR ou plus : ½ du listé, +20 %', () => {
    marchanderLaVente(5, 95); // 5 sur 80 → DR 7 ; 95 sur 45 → DR −5
    const pb = get().pendingBargain!;
    expect(pb.result!.netSL).toBeGreaterThanOrEqual(6);
    expect(describeBargain(pb)).toBe('Gagné (½ du prix listé, +20 %)');
  });
});
