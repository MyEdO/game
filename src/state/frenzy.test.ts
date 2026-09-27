import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useGame } from './store';
import { resolvePsychAI, fireTurnStartTriggers } from './combatFlow';
import { isFrenzied } from '../engine/psychology';
import { createHero } from '../engine/character';
import { testScene } from '../scenes/test-fixture';
import type { Combatant } from '../engine/types';

describe('Frénésie — immunité psy & fin (→ Exténué)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllTimers();
    useGame.setState({ battle: null });
  });
  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  function setup() {
    const hero = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'H', seed: 1 });
    useGame.setState({ party: [hero] });
    useGame.getState().startScene(testScene);
    useGame.getState().startCombat('enc-mutants');
    useGame.getState().confirmRoundStart();
    vi.clearAllTimers();
    const b = useGame.getState().battle!;
    const H = b.combatants.find((c) => c.kind === 'hero')!;
    const E = b.combatants.find((c) => c.kind === 'enemy')!;
    b.combatants.filter((c) => c.kind === 'enemy' && c.id !== E.id).forEach((e) => (e.dead = true));
    H.pos = { x: 10, y: 10 };
    E.pos = { x: 11, y: 10 };
    useGame.setState({ battle: { ...b } });
    return { H, E };
  }

  it('un ennemi en Frénésie est immunisé à la Terreur (pas de Brisé)', () => {
    useGame.getState().seedRng(2);
    const { H, E } = setup();
    H.size = 'enorme'; // Terreur 2
    (E.psychState ??= []).push({ type: 'frenesie' });
    E.characteristics['force-mentale'] = 10;
    resolvePsychAI(useGame.getState, useGame.setState, E);
    const e = useGame.getState().battle!.combatants.find((c) => c.id === E.id)!;
    expect(e.conditions.some((c) => c.id === 'brise')).toBe(false);
    expect(e.psychState ?? []).toEqual([{ type: 'frenesie' }]); // aucune Peur ajoutée (immunisé), la Frénésie demeure
  });

  it('la Frénésie finit (Exténué) quand plus aucun ennemi n’est en Ligne de Vue', () => {
    const { H, E } = setup();
    (E.psychState ??= []).push({ type: 'frenesie' });
    (H as Combatant).dead = true; // plus d'ennemi vivant pour E
    // La sortie est un effet DÉCLENCHÉ `onTurnStart` en données (psychology.json) — joué au début du tour.
    fireTurnStartTriggers(useGame.getState, useGame.setState, E);
    const e = useGame.getState().battle!.combatants.find((c) => c.id === E.id)!;
    expect(isFrenzied(e)).toBe(false);
    expect(e.conditions.some((c) => c.id === 'extenue')).toBe(true);
  });
});
