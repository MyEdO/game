import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useGame } from '../store';
import { runEnemyAI } from '../combatFlow';
import { createHero } from '../../engine/character';
import { seedBattleRng } from '../battleRng';
import { isFrenzied } from '../../engine/psychology';
import { psychDRAdjust } from '../../engine/combat';
import { testScene } from '../../scenes/test-fixture';
import type { Combatant } from '../../engine/types';

/**
 * Trait Rage — LDB 85 l.281-283 : « Elle peut dépenser tous ses Avantages (minimum 1) pour que celui
 * devienne Haine envers ses adversaires en combat rapproché. Elle peut aussi dépenser tous ses
 * Avantages (minimum 3) pour entrer en Frénésie. » Hook `rage` (onTurnStart, décision IA RNG-free) :
 * ≥ 3 → Frénésie (politique historique) ; sinon ≥ 1 ET adversaires ENGAGÉS non couverts → tout
 * dépenser pour la Haine (état psy CIBLÉ, LDB 21 : +1 DR aux Tests de Combat contre le groupe via
 * `psychDRAdjust`, immunité à sa Peur — pas du vide).
 */
/** Le combattant PREND son rang d'initiative : `runEnemyAI` refuse un tour qui n'est pas celui de
 *  l'actif, et refuse de rejouer un tour déjà joué (jeton de tour, #1852). */
const auTourDe = (id: string): void => {
  const b = useGame.getState().battle!;
  b.turn = b.order.indexOf(id);
};

describe('Rage → Haine (LDB 85 l.281-283, branche « minimum 1 »)', () => {
  beforeEach(() => { vi.useFakeTimers(); vi.clearAllTimers(); useGame.setState({ battle: null }); });
  afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); });

  function setup() {
    const hero = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'H', seed: 1 });
    useGame.setState({ party: [hero] });
    useGame.getState().startScene(testScene);
    seedBattleRng(777);
    useGame.getState().startCombat('enc-mutants');
    useGame.getState().confirmRoundStart();
    vi.clearAllTimers();
    const b = useGame.getState().battle!;
    const H = b.combatants.find((c) => c.kind === 'hero')!;
    const enemies = b.combatants.filter((c) => c.kind === 'enemy');
    enemies.slice(1).forEach((e) => (e.dead = true));
    const E = enemies[0];
    E.traits = [{ id: 'rage' }];
    H.pos = { x: 10, y: 10 };
    E.pos = { x: 11, y: 10 }; // au contact
    E.engagedWith = [H.id];
    H.engagedWith = [E.id];
    useGame.setState({ battle: { ...b } });
    return { H, E };
  }

  it('Avantage 1 + adversaire ENGAGÉ → dépense tout, Haine ACTIVE ciblant le groupe de l’adversaire (+1 DR d’attaque contre lui)', () => {
    const { H, E } = setup();
    E.advantage = 1;
    auTourDe(E.id);
    runEnemyAI(useGame.getState, useGame.setState, E.id);
    expect(E.advantage).toBe(0); // « dépenser TOUS ses Avantages »
    expect(isFrenzied(E)).toBe(false); // < 3 → pas la branche Frénésie
    const haine = (E.psychState ?? []).find((p) => p.type === 'haine');
    expect(haine).toBeTruthy();
    expect(haine!.active).toBe(true);
    expect(haine!.cible).toBe(H.groups?.[0]); // « envers ses adversaires en combat rapproché »
    // La Haine FAIT quelque chose : +1 DR aux Tests de Combat contre le groupe haï (LDB 21, psychDRAdjust).
    expect(psychDRAdjust(E, H)).toBe(1);
    expect(useGame.getState().battle!.log.some((l) => l.text.includes('Haine'))).toBe(true);
  });

  it('Avantage ≥ 3 → la branche FRÉNÉSIE prime (politique historique conservée)', () => {
    const { E } = setup();
    E.advantage = 3;
    auTourDe(E.id);
    runEnemyAI(useGame.getState, useGame.setState, E.id);
    expect(isFrenzied(E)).toBe(true);
    expect(E.advantage).toBe(0);
    expect((E.psychState ?? []).some((p) => p.type === 'haine')).toBe(false);
  });

  it('Haine ACTIVE couvrant déjà tous les adversaires engagés → ne re-dépense PAS (l’Avantage est conservé)', () => {
    const { H, E } = setup();
    E.advantage = 1;
    auTourDe(E.id);
    runEnemyAI(useGame.getState, useGame.setState, E.id); // 1ʳᵉ Rage → Haine posée, Avantage 0
    E.advantage = 2; // regagné plus tard
    useGame.getState().battle!.round += 1; // « plus tard » = un AUTRE Round (un tour ne se joue qu'une fois, #1852)
    runEnemyAI(useGame.getState, useGame.setState, E.id);
    expect(E.advantage).toBe(2); // déjà couvert → pas de re-dépense
    expect((E.psychState ?? []).filter((p) => p.type === 'haine')).toHaveLength(1);
    expect(H.id).toBeTruthy();
  });

  it('Avantage 1 SANS adversaire au contact → rien (la Haine vise « ses adversaires en combat rapproché »)', () => {
    const { H, E } = setup();
    E.engagedWith = [];
    H.engagedWith = [];
    E.advantage = 1;
    auTourDe(E.id);
    runEnemyAI(useGame.getState, useGame.setState, E.id);
    expect(E.advantage).toBe(1); // pas de cible au contact → pas de dépense
    expect((E.psychState ?? []).some((p) => p.type === 'haine')).toBe(false);
  });

  it('adversaire engagé SANS Groupe modélisable → pas de dépense (garde groupMatch)', () => {
    const { H, E } = setup();
    (H as Combatant).groups = [];
    E.advantage = 2;
    auTourDe(E.id);
    runEnemyAI(useGame.getState, useGame.setState, E.id);
    expect(E.advantage).toBe(2);
    expect((E.psychState ?? []).some((p) => p.type === 'haine')).toBe(false);
  });
});
