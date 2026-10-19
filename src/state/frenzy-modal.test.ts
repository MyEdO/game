import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useGame } from './store';
import { isFrenzied } from '../engine/psychology';
import { heroFaceAUnEnnemi } from './combatDeTest.testkit';

describe('Entrée en Frénésie du héros — modale (Test de FM)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllTimers();
    useGame.setState({ pendingFrenzy: null, battle: null });
  });
  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it('battleFrenzy ouvre pendingFrenzy (héros capable, pas déjà frenzied, pas acted)', () => {
    const { H } = heroFaceAUnEnnemi();
    H.traits = [{ id: 'frenesie' }];
    useGame.getState().battleFrenzy();
    const pf = useGame.getState().pendingFrenzy;
    expect(pf).toBeTruthy();
    expect(pf!.combatantId).toBe(H.id);
    expect(pf!.result).toBeNull();
  });

  it('héros NON capable → battleFrenzy n’ouvre rien', () => {
    heroFaceAUnEnnemi(); // pas de trait/talent « Frénésie »
    useGame.getState().battleFrenzy();
    expect(useGame.getState().pendingFrenzy).toBeNull();
  });

  it('héros déjà frenzied → battleFrenzy n’ouvre rien', () => {
    const { H } = heroFaceAUnEnnemi();
    H.traits = [{ id: 'frenesie' }];
    (H.psychState ??= []).push({ type: 'frenesie' });
    useGame.getState().battleFrenzy();
    expect(useGame.getState().pendingFrenzy).toBeNull();
  });

  it('frenzyRoll lance le Test de FM ; frenzyForceSuccess + frenzyConfirm → frenzied + Action consommée', () => {
    const { H } = heroFaceAUnEnnemi();
    H.traits = [{ id: 'frenesie' }];
    H.resilience = 1; // Résilience pour forcer le succès
    useGame.getState().battleFrenzy();
    useGame.getState().frenzyRoll();
    const r = useGame.getState().pendingFrenzy!.result!;
    expect(typeof r.success).toBe('boolean');
    expect(typeof r.roll).toBe('number');
    useGame.getState().frenzyForceSuccess(); // garantit le succès (Résilience)
    useGame.getState().frenzyConfirm();
    const h = useGame.getState().battle!.combatants.find((c) => c.id === H.id)!;
    expect(isFrenzied(h)).toBe(true);
    expect(useGame.getState().battle!.acted).toBe(true);
    expect(useGame.getState().pendingFrenzy).toBeNull();
  });

  it('frenzyConfirm sur échec → pas frenzied mais Action consommée', () => {
    const { H } = heroFaceAUnEnnemi();
    H.traits = [{ id: 'frenesie' }];
    H.characteristics['force-mentale'] = 1; // Test de FM raté quasi sûr
    useGame.getState().seedRng(3);
    useGame.getState().battleFrenzy();
    useGame.getState().frenzyRoll();
    const r = useGame.getState().pendingFrenzy!.result!;
    useGame.getState().frenzyConfirm();
    const h = useGame.getState().battle!.combatants.find((c) => c.id === H.id)!;
    expect(isFrenzied(h)).toBe(r.success); // suit le résultat (FM 1 → échec attendu)
    expect(useGame.getState().battle!.acted).toBe(true);
  });
});
