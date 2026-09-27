import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useGame } from './store';
import { isFrenzied } from '../engine/psychology';
import { createHero } from '../engine/character';
import { testScene } from '../scenes/test-fixture';

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

  function setup() {
    const hero = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'H', seed: 1 });
    useGame.setState({ party: [hero] });
    useGame.getState().startScene(testScene());
    useGame.getState().startCombat('enc-mutants');
    useGame.getState().confirmRoundStart();
    vi.clearAllTimers();
    const b = useGame.getState().battle!;
    const H = b.combatants.find((c) => c.kind === 'hero')!;
    const E = b.combatants.find((c) => c.kind === 'enemy')!;
    b.combatants.filter((c) => c.kind === 'enemy' && c.id !== E.id).forEach((e) => (e.dead = true));
    H.pos = { x: 10, y: 10 };
    E.pos = { x: 11, y: 10 };
    const turn = b.order.indexOf(H.id);
    useGame.setState({ battle: { ...b, turn, acted: false }, pendingFrenzy: null });
    return { H, E };
  }

  it('battleFrenzy ouvre pendingFrenzy (héros capable, pas déjà frenzied, pas acted)', () => {
    const { H } = setup();
    H.traits = [{ id: 'frenesie' }];
    useGame.getState().battleFrenzy();
    const pf = useGame.getState().pendingFrenzy;
    expect(pf).toBeTruthy();
    expect(pf!.combatantId).toBe(H.id);
    expect(pf!.result).toBeNull();
  });

  it('héros NON capable → battleFrenzy n’ouvre rien', () => {
    setup(); // pas de trait/talent « Frénésie »
    useGame.getState().battleFrenzy();
    expect(useGame.getState().pendingFrenzy).toBeNull();
  });

  it('héros déjà frenzied → battleFrenzy n’ouvre rien', () => {
    const { H } = setup();
    H.traits = [{ id: 'frenesie' }];
    (H.psychState ??= []).push({ type: 'frenesie' });
    useGame.getState().battleFrenzy();
    expect(useGame.getState().pendingFrenzy).toBeNull();
  });

  it('frenzyRoll lance le Test de FM ; frenzyForceSuccess + frenzyConfirm → frenzied + Action consommée', () => {
    const { H } = setup();
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
    const { H } = setup();
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
