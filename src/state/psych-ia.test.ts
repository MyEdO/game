import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useGame } from './store';
import { resolvePsychAI } from './combatFlow';
import { fearSourceFor } from '../engine/psychology';
import { createHero } from '../engine/character';
import { testScene } from '../scenes/test-fixture';
import type { Combatant } from '../engine/types';

describe('Psychologie IA (Peur/Terreur au début du tour)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllTimers();
    useGame.setState({ battle: null });
  });
  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it('fearSourceFor : Énorme AGRESSIVE vs Moyenne → Terreur 2 ; statbloc Peur 4 ; rien si pas de source', () => {
    const big = { id: 'b', kind: 'enemy', size: 'enorme' } as Combatant; // adversaire → agressive (LDB 85 l.381-383)
    const med = { id: 'm', kind: 'hero', size: 'moyenne' } as Combatant;
    expect(fearSourceFor(med, big)).toEqual({ kind: 'terreur', indice: 2 });
    expect(fearSourceFor(med, { id: 'p', kind: 'enemy', size: 'moyenne', causesPeur: 4 } as Combatant)).toEqual({ kind: 'peur', indice: 4 });
    expect(fearSourceFor(med, med)).toBeNull();
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
    E.pos = { x: 11, y: 10 }; // adjacent → Ligne de Vue dégagée
    useGame.setState({ battle: { ...b } });
    return { H, E };
  }

  it('un ennemi face à un héros Énorme (Terreur) gagne Brisé + une Peur en psychState', () => {
    useGame.getState().seedRng(2);
    const { H, E } = setup();
    H.size = 'enorme'; // gap 2 → Terreur 2
    E.characteristics['force-mentale'] = 10; // Test de Calme raté → Brisé
    resolvePsychAI(useGame.getState, useGame.setState, E);
    const e = useGame.getState().battle!.combatants.find((c) => c.id === E.id)!;
    expect(e.conditions.some((c) => c.id === 'brise')).toBe(true);
    expect((e.psychState ?? []).some((p) => p.type === 'peur' && p.sourceId === H.id)).toBe(true);
  });

  it('un ennemi Immunité (Psychologie) n’est pas affecté', () => {
    const { H, E } = setup();
    H.size = 'monstrueuse';
    E.psychImmune = true;
    resolvePsychAI(useGame.getState, useGame.setState, E);
    const e = useGame.getState().battle!.combatants.find((c) => c.id === E.id)!;
    expect(e.conditions.some((c) => c.id === 'brise')).toBe(false);
    expect(e.psychState ?? []).toEqual([]);
  });

  /**
   * #1231 — Belliqueux (LDB 85 l.51) : « Tant qu'elle a plus d'Avantages que son adversaire ». Son
   * adversaire se lit à l'Engagement (LDB 13 l.169-171, symétrique), pas au camp : une créature engagée
   * contre un membre de SON camp, avec plus d'Avantages que lui, gagne bien l'Immunité Psychologique.
   */
  it('Belliqueux : l’adversaire ENGAGÉ du même camp compte — plus d’Avantages que lui ⇒ immunité psy', () => {
    useGame.getState().seedRng(2);
    const { H, E } = setup();
    H.size = 'enorme'; // Terreur 2 pour E s'il n'est pas immunisé
    E.characteristics['force-mentale'] = 10; // Calme raté à coup sûr
    E.traits = [...(E.traits ?? []), { id: 'belliqueux' }];
    E.advantage = 2;
    const rival = useGame.getState().battle!.combatants.find((c) => c.kind === 'enemy' && c.id !== E.id)!;
    rival.dead = false; rival.wounds = { current: 10, max: 10 }; rival.advantage = 0; rival.pos = { x: 12, y: 10 };
    E.engagedWith = [rival.id]; rival.engagedWith = [E.id]; // camarades qui en viennent aux mains
    useGame.setState({ battle: { ...useGame.getState().battle! } });
    resolvePsychAI(useGame.getState, useGame.setState, E);
    const e = useGame.getState().battle!.combatants.find((c) => c.id === E.id)!;
    expect(e.conditions.some((c) => c.id === 'brise')).toBe(false);
    expect(e.psychState ?? []).toEqual([]);
  });
});
