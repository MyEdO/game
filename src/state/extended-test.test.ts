import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { useGame } from './store';
import { createHero } from '../engine/character';
import { setRule, resetRule } from '../engine/policy';

/** Test Étendu SÉQUENTIEL (LDB 12 l.172-174 : « atteindre un certain DR … les DR obtenus à chaque
 *  Round sont additionnés … Si le DR total passe en dessous de 0, recommencer depuis le début »).
 *  2ᵉ consommateur de la fabrique UNIQUE — SÉQUENTIEL (chaque Round dépend du total) là où le
 *  Contre-sort est PARALLÈLE (jets indépendants). Ex. enfoncer une porte renforcée (DR cible). */
describe('Test Étendu séquentiel (porte DR cumulé)', () => {
  beforeEach(() => { useGame.setState({ battle: null, pendingExtendedTest: null }); });

  function hero() {
    const h = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'Brawn', seed: 1 });
    h.fortune = 2; h.resilience = 1;
    useGame.setState({ party: [h] });
    return h;
  }

  it('cumule le DR Round par Round jusqu’à la cible (≥ 2 Rounds = vraiment séquentiel)', () => {
    useGame.getState().seedRng(7);
    const h = hero();
    useGame.getState().startExtendedTest({ actorId: h.id, label: 'Enfoncer la porte', skillLabel: 'Force', target: 70, targetDR: 15 });
    let rounds = 0;
    let prevTotal = 0;
    while (useGame.getState().pendingExtendedTest && rounds++ < 40) {
      const p = useGame.getState().pendingExtendedTest!;
      expect(p.total).toBe(prevTotal); // le total reporté du Round précédent (dépendance séquentielle)
      const cur = p.rounds[p.rounds.length - 1];
      useGame.getState().extendedTestRoll(cur.id);
      const rr = useGame.getState().pendingExtendedTest!.rounds;
      expect(rr[rr.length - 1].result).toBeTruthy(); // chaque Round a SON jet
      useGame.getState().extendedTestNext();
      prevTotal = useGame.getState().pendingExtendedTest?.total ?? prevTotal;
    }
    expect(useGame.getState().pendingExtendedTest).toBeNull(); // la porte a cédé
    expect(rounds).toBeGreaterThan(1); // un seul jet ne suffisait pas — DR cumulés
  });

  it('un Round à DR négatif fait repartir le total à 0 + ouvre un nouveau Round', () => {
    const h = hero();
    useGame.getState().startExtendedTest({ actorId: h.id, label: 'Forcer', skillLabel: 'Force', target: 50, targetDR: 20 });
    const p = useGame.getState().pendingExtendedTest!;
    // total à 5, Round raté à DR -8 → total clampé à 0 (« recommencer depuis le début »).
    useGame.setState({ pendingExtendedTest: { ...p, total: 5, rounds: [{ id: 'round-1', interactive: true, result: { roll: 95, sl: -8, success: false } }] } });
    useGame.getState().extendedTestNext();
    const after = useGame.getState().pendingExtendedTest!;
    expect(after.total).toBe(0);
    expect(after.rounds).toHaveLength(2); // un nouveau Round s'ouvre (la tâche continue)
  });

  it('Dissipation (LDB 46 l.158-160) : DR cumulé atteignant le NI retire les effets du sort de ses porteurs', () => {
    const h = hero();
    const cible = { id: 'cible', name: 'Cible', kind: 'hero', conditions: [],
      activeEffects: [{ label: 'Écorce', char: 'agilite', bonus: -10, duration: { scale: 'rounds', left: 5 },
        spell: { spellId: 'ecorce', ni: 2, casterId: h.id, label: 'Écorce' } }] } as any;
    useGame.setState({ battle: { round: 1, combatants: [h, cible], log: [] } as any });
    useGame.getState().startExtendedTest({ actorId: h.id, label: 'Dissiper Écorce', skillLabel: 'Langue (Magick)',
      target: 60, targetDR: 2, dispel: { spellId: 'ecorce', casterId: h.id, label: 'Écorce' } });
    const p = useGame.getState().pendingExtendedTest!;
    // un Round réussi à DR +2 → atteint le NI 2 → dissipation.
    useGame.setState({ pendingExtendedTest: { ...p, rounds: [{ id: 'round-1', interactive: true, result: { roll: 10, sl: 2, success: true } }] } });
    useGame.getState().extendedTestNext();
    expect(useGame.getState().pendingExtendedTest).toBeNull(); // réussi
    const t = useGame.getState().battle!.combatants.find((c) => c.id === 'cible')!;
    expect((t.activeEffects ?? []).some((e) => e.spell?.spellId === 'ecorce')).toBe(false); // effets du sort retirés
  });

  it('mêmes verbes d’influence que tout flux : Chance relance, Résilience garantit le Round', () => {
    const h = hero();
    useGame.getState().startExtendedTest({ actorId: h.id, label: 'Forcer', skillLabel: 'Force', target: 30, targetDR: 50 });
    const p = useGame.getState().pendingExtendedTest!;
    useGame.setState({ pendingExtendedTest: { ...p, rounds: [{ id: 'round-1', interactive: true, result: { roll: 88, sl: -5, success: false }, rerolled: false }] } });
    useGame.getState().extendedTestReroll('round-1'); // Chance : relance le Round propre raté
    expect(useGame.getState().party[0].fortune).toBe(1); // 1 Point de Chance dépensé
    // Résilience (nouveau flux) : Round garanti réussi.
    useGame.getState().startExtendedTest({ actorId: h.id, label: 'Forcer', skillLabel: 'Force', target: 30, targetDR: 50 });
    useGame.getState().extendedTestForceSuccess('round-1');
    expect(useGame.getState().pendingExtendedTest!.rounds[0].result!.success).toBe(true);
    expect(useGame.getState().party[0].resilience).toBe(0); // 1 Point de Résilience dépensé
  });
});

describe('Test Étendu — règle « DR 0 = ±1 minimum » (LDB 12 l.185)', () => {
  beforeEach(() => { useGame.setState({ battle: null, pendingExtendedTest: null }); });
  afterEach(() => resetRule('test-extended-min-sl'));

  function setRound(total: number, sl: number, success: boolean) {
    const h = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'B', seed: 1 });
    useGame.setState({ party: [h] });
    useGame.getState().startExtendedTest({ actorId: h.id, label: 'X', skillLabel: 'Force', target: 50, targetDR: 30 });
    const p = useGame.getState().pendingExtendedTest!;
    useGame.setState({ pendingExtendedTest: { ...p, total, rounds: [{ id: 'round-1', interactive: true, result: { roll: success ? 40 : 96, sl, success } }] } });
  }

  it('défaut : un Round réussi à DR 0 ne change pas le total', () => {
    setRound(4, 0, true);
    useGame.getState().extendedTestNext();
    expect(useGame.getState().pendingExtendedTest!.total).toBe(4);
  });
  it('règle ON : un Round réussi à DR 0 ajoute +1', () => {
    setRound(4, 0, true);
    setRule('test-extended-min-sl', true);
    useGame.getState().extendedTestNext();
    expect(useGame.getState().pendingExtendedTest!.total).toBe(5);
  });
  it('règle ON : un Round raté à DR 0 retire 1 (puis clamp ≥ 0)', () => {
    setRound(4, 0, false);
    setRule('test-extended-min-sl', true);
    useGame.getState().extendedTestNext();
    expect(useGame.getState().pendingExtendedTest!.total).toBe(3);
  });
});
