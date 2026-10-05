import { describe, it, expect } from 'vitest';
import { combatAdvanceBlocked } from './combatGate';
import type { ArbiterState } from './modalArbiter';
import { cascadeDeTest } from './cascadeTestKit';

/**
 * Garde unique de reprise (A1) — strictement ISO aux 4 gardes historiques. Les `opts` reflètent
 * ce que CHAQUE site surveillait : `resumeSuspendedAI` ignorait `pendingCast` (`{cast:false}`),
 * seul `maybeRunEnemyTurn` testait `pendingRoundStart` ici (`{roundStart:true}`).
 */
const battle = { over: false } as unknown as ArbiterState['battle'];
const s = (extra: Partial<ArbiterState>): ArbiterState => ({ battle, ...extra });

describe('combatAdvanceBlocked — garde de reprise unifiée (A1, iso)', () => {
  it('aucun pending + combat en cours → non bloqué', () => {
    expect(combatAdvanceBlocked(s({}))).toBe(false);
  });

  it('pas de combat / combat terminé → bloqué', () => {
    expect(combatAdvanceBlocked({})).toBe(true);
    expect(combatAdvanceBlocked(s({ battle: { over: true } as unknown as ArbiterState['battle'] }))).toBe(true);
  });

  it('modales du cœur commun (fateSave/cascade) → bloqué', () => {
    expect(combatAdvanceBlocked(s({ pendingFateSave: {} as never }))).toBe(true);
    // Ni la Maladresse ni la RÉVÉLATION ne sont des pendings à part : ce sont des ÉTAPES de
    // `pendingCascade` (#942 L8) — un seul terme les couvre toutes.
    expect(combatAdvanceBlocked(s({ pendingCascade: cascadeDeTest([]) }))).toBe(true);
    expect(combatAdvanceBlocked(s({ pendingCascade: cascadeDeTest([{ id: 'r', kind: 'round', reveal: { kind: 'round', title: 'x', lines: [] } }]) }))).toBe(true);
  });

  it('pendingCast : bloque par défaut, MAIS pas avec {cast:false} (iso resumeSuspendedAI)', () => {
    expect(combatAdvanceBlocked(s({ pendingCast: {} as never }))).toBe(true);
    expect(combatAdvanceBlocked(s({ pendingCast: {} as never }), { cast: false })).toBe(false);
  });

  it('pendingRoundStart : ignoré par défaut, MAIS bloque avec {roundStart:true} (iso maybeRunEnemyTurn)', () => {
    expect(combatAdvanceBlocked(s({ pendingRoundStart: {} as never }))).toBe(false);
    expect(combatAdvanceBlocked(s({ pendingRoundStart: {} as never }), { roundStart: true })).toBe(true);
  });
});
