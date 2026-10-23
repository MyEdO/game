import { describe, it, expect } from 'vitest';
import { useGame } from './store';
import { createHero } from '../engine/character';
import { idNeufDeBanc } from '../lib/entityId.testkit';

/**
 * Résilience « Je ne faillirai pas ! » = AVANT le jet (LDB 17 l.68, mode principal « au lieu de
 * lancer les dés ») ET après un Test échoué (« Vous pouvez même faire ce choix après un Test qui
 * a échoué ») — les DEUX modes sont RAW et testés ici.
 */
function setPendingTest(over: Partial<any> = {}) {
  useGame.setState({
    party: [{ id: 'h1', name: 'Héros', resilience: 2 } as any],
    pendingTest: {
      actorId: 'h1', actorName: 'Héros', label: 'Test', skillValue: 40, difficulty: 'intermediaire',
      requireSL: 0, target: 40, roll: null, success: false, sl: 0,
      ...over,
    } as any,
  });
}

describe('testForceSuccess — Résilience AVANT le jet', () => {
  it('avant le jet (roll==null) : réussite garantie, DR ≥ 1, dé choisi, 1 Résilience dépensée', () => {
    setPendingTest();
    useGame.getState().testForceSuccess();
    const pt = useGame.getState().pendingTest!;
    expect(pt.success).toBe(true);
    expect(pt.sl).toBeGreaterThanOrEqual(1);
    expect(pt.roll).toBe(1); // « vous choisissez le résultat » → 01
    expect(pt.forced).toBe(true);
    expect(useGame.getState().party[0].resilience).toBe(1);
  });

  it('respecte le DR requis (Test étendu) : DR ≥ requireSL', () => {
    setPendingTest({ requireSL: 3 });
    useGame.getState().testForceSuccess();
    expect(useGame.getState().pendingTest!.sl).toBeGreaterThanOrEqual(3);
  });

  it('APRÈS un Test échoué (RAW l.73 « vous choisissez le résultat ») : dé CHOISI 01 → DR max', () => {
    setPendingTest({ roll: 88, success: false, sl: -2 });
    useGame.getState().testForceSuccess();
    const pt = useGame.getState().pendingTest!;
    expect(pt.success).toBe(true);
    expect(pt.roll).toBe(1); // sans enjeu de double, le choix rationnel est le score le plus bas
    expect(pt.sl).toBe(4); // dizaine(40) − dizaine(01) : le DR maximal atteignable contre une cible de 40
    expect(pt.forced).toBe(true);
    expect(useGame.getState().party[0].resilience).toBe(1);
  });

  it('Test déjà réussi : no-op (pas de gaspillage de Résilience)', () => {
    setPendingTest({ roll: 12, success: true, sl: 2 });
    useGame.getState().testForceSuccess();
    expect(useGame.getState().party[0].resilience).toBe(2);
  });

  it('sans Résilience : no-op', () => {
    setPendingTest();
    useGame.setState({ party: [{ id: 'h1', name: 'Héros', resilience: 0 } as any] });
    useGame.getState().testForceSuccess();
    expect(useGame.getState().pendingTest!.success).toBe(false);
  });
});

describe('Résilience pré-jet — autres modales (synthèse de succès)', () => {
  it('soin : avant le jet → réussite garantie (01), 1 Résilience dépensée', () => {
    useGame.setState({
      party: [{ id: 'h1', name: 'Soigneur', resilience: 1 } as any],
      battle: null,
      pendingHeal: { healerId: 'h1', healerName: 'Soigneur', targetId: 'h1', targetName: 'Soigneur', mode: 'wounds', intBonus: 3, sl: 0, success: false, roll: null, target: 50 } as any,
    });
    useGame.getState().healForceSuccess();
    const ph = useGame.getState().pendingHeal!;
    expect(ph.success).toBe(true);
    expect(ph.roll).toBe(1);
    expect(useGame.getState().party[0].resilience).toBe(0);
  });

  it('frénésie : avant le jet → entrée garantie, 1 Résilience dépensée', () => {
    const brute = { ...createHero({ idNeuf: idNeufDeBanc, speciesId: 'humains-reiklander', careerId: 'soldat', label: 'Brute', seed: 1 }), id: 'e1', resilience: 1 };
    useGame.setState({
      battle: { combatants: [brute] } as any,
      pendingFrenzy: { combatantId: 'e1', result: null } as any,
    });
    useGame.getState().frenzyForceSuccess();
    expect(useGame.getState().pendingFrenzy!.result!.success).toBe(true);
    expect(useGame.getState().battle!.combatants[0].resilience).toBe(0);
  });
});
