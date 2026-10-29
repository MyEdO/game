import { describe, it, expect, beforeEach } from 'vitest';
import { ouvrirLeBanc, type Banc } from './banc.testkit';
import { createHero } from '../engine/character';
import { setRule } from '../engine/policy';
import { combattantDeTest } from '../engine/combattantDeTest.testkit';

let banc: Banc;
beforeEach(() => { banc = ouvrirLeBanc(); });

/** Test Étendu SÉQUENTIEL (LDB 12 l.172-174 : « atteindre un certain DR … les DR obtenus à chaque
 *  Round sont additionnés … Si le DR total passe en dessous de 0, recommencer depuis le début »).
 *  2ᵉ consommateur de la fabrique UNIQUE — SÉQUENTIEL (chaque Round dépend du total) là où le
 *  Contre-sort est PARALLÈLE (jets indépendants). Ex. enfoncer une porte renforcée (DR cible). */
describe('Test Étendu séquentiel (porte DR cumulé)', () => {
  beforeEach(() => { banc.setState({ battle: null, pendingExtendedTest: null }); });

  function hero() {
    const h = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'Brawn', seed: 1 });
    h.fortune = 2; h.resilience = 1;
    banc.setState({ party: [h] });
    return h;
  }

  it('cumule le DR Round par Round jusqu’à la cible (≥ 2 Rounds = vraiment séquentiel)', () => {
    banc.getState().seedRng(7);
    const h = hero();
    banc.getState().startExtendedTest({ actorId: h.id, label: 'Enfoncer la porte', skillLabel: 'Force', target: 70, targetDR: 15 });
    let rounds = 0;
    let prevTotal = 0;
    while (banc.getState().pendingExtendedTest && rounds++ < 40) {
      const p = banc.getState().pendingExtendedTest!;
      expect(p.total).toBe(prevTotal); // le total reporté du Round précédent (dépendance séquentielle)
      const cur = p.rounds[p.rounds.length - 1];
      banc.getState().extendedTestRoll(cur.id);
      const rr = banc.getState().pendingExtendedTest!.rounds;
      expect(rr[rr.length - 1].result).toBeTruthy(); // chaque Round a SON jet
      banc.getState().extendedTestNext();
      prevTotal = banc.getState().pendingExtendedTest?.total ?? prevTotal;
    }
    expect(banc.getState().pendingExtendedTest).toBeNull(); // la porte a cédé
    expect(rounds).toBeGreaterThan(1); // un seul jet ne suffisait pas — DR cumulés
  });

  it('un Round à DR négatif fait repartir le total à 0 + ouvre un nouveau Round', () => {
    const h = hero();
    banc.getState().startExtendedTest({ actorId: h.id, label: 'Forcer', skillLabel: 'Force', target: 50, targetDR: 20 });
    const p = banc.getState().pendingExtendedTest!;
    // total à 5, Round raté à DR -8 → total clampé à 0 (« recommencer depuis le début »).
    banc.setState({ pendingExtendedTest: { ...p, total: 5, rounds: [{ id: 'round-1', interactive: true, result: { roll: 95, sl: -8, success: false } }] } });
    banc.getState().extendedTestNext();
    const after = banc.getState().pendingExtendedTest!;
    expect(after.total).toBe(0);
    expect(after.rounds).toHaveLength(2); // un nouveau Round s'ouvre (la tâche continue)
  });

  it('Dissipation (LDB 46 l.158-160) : DR cumulé atteignant le NI retire les effets du sort de ses porteurs', () => {
    const h = hero();
    const cible = combattantDeTest({ id: 'cible', label: 'Cible', kind: 'hero',
      activeEffects: [{ label: 'Écorce', char: 'agilite', bonus: -10, duration: { scale: 'rounds', left: 5 },
        spell: { spellId: 'ecorce', ni: 2, casterId: h.id, label: 'Écorce' } }] });
    banc.setState({ battle: { round: 1, combatants: [h, cible], log: [] } as any });
    banc.getState().startExtendedTest({ actorId: h.id, label: 'Dissiper Écorce', skillLabel: 'Langue (Magick)',
      target: 60, targetDR: 2, dispel: { spellId: 'ecorce', casterId: h.id, label: 'Écorce' } });
    const p = banc.getState().pendingExtendedTest!;
    // un Round réussi à DR +2 → atteint le NI 2 → dissipation.
    banc.setState({ pendingExtendedTest: { ...p, rounds: [{ id: 'round-1', interactive: true, result: { roll: 10, sl: 2, success: true } }] } });
    banc.getState().extendedTestNext();
    expect(banc.getState().pendingExtendedTest).toBeNull(); // réussi
    const t = banc.getState().battle!.combatants.find((c) => c.id === 'cible')!;
    expect((t.activeEffects ?? []).some((e) => e.spell?.spellId === 'ecorce')).toBe(false); // effets du sort retirés
  });

  it('mêmes verbes d’influence que tout flux : Chance relance, Résilience garantit le Round', () => {
    const h = hero();
    banc.getState().startExtendedTest({ actorId: h.id, label: 'Forcer', skillLabel: 'Force', target: 30, targetDR: 50 });
    const p = banc.getState().pendingExtendedTest!;
    banc.setState({ pendingExtendedTest: { ...p, rounds: [{ id: 'round-1', interactive: true, result: { roll: 88, sl: -5, success: false }, rerolled: false }] } });
    banc.getState().extendedTestReroll('round-1'); // Chance : relance le Round propre raté
    expect(banc.getState().party[0].fortune).toBe(1); // 1 Point de Chance dépensé
    // Résilience (nouveau flux) : Round garanti réussi.
    banc.getState().startExtendedTest({ actorId: h.id, label: 'Forcer', skillLabel: 'Force', target: 30, targetDR: 50 });
    banc.getState().extendedTestForceSuccess('round-1');
    expect(banc.getState().pendingExtendedTest!.rounds[0].result!.success).toBe(true);
    expect(banc.getState().party[0].resilience).toBe(0); // 1 Point de Résilience dépensé
  });
});

describe('Test Étendu — règle « DR 0 = ±1 minimum » (LDB 12 l.185)', () => {
  beforeEach(() => { banc.setState({ battle: null, pendingExtendedTest: null }); });

  function setRound(total: number, sl: number, success: boolean) {
    const h = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'B', seed: 1 });
    banc.setState({ party: [h] });
    banc.getState().startExtendedTest({ actorId: h.id, label: 'X', skillLabel: 'Force', target: 50, targetDR: 30 });
    const p = banc.getState().pendingExtendedTest!;
    banc.setState({ pendingExtendedTest: { ...p, total, rounds: [{ id: 'round-1', interactive: true, result: { roll: success ? 40 : 96, sl, success } }] } });
  }

  it('défaut : un Round réussi à DR 0 ne change pas le total', () => {
    setRound(4, 0, true);
    banc.getState().extendedTestNext();
    expect(banc.getState().pendingExtendedTest!.total).toBe(4);
  });
  it('règle ON : un Round réussi à DR 0 ajoute +1', () => {
    setRound(4, 0, true);
    setRule('test-extended-min-sl', true);
    banc.getState().extendedTestNext();
    expect(banc.getState().pendingExtendedTest!.total).toBe(5);
  });
  it('règle ON : un Round raté à DR 0 retire 1 (puis clamp ≥ 0)', () => {
    setRound(4, 0, false);
    setRule('test-extended-min-sl', true);
    banc.getState().extendedTestNext();
    expect(banc.getState().pendingExtendedTest!.total).toBe(3);
  });
});
