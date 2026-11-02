import { describe, it, expect, beforeEach } from 'vitest';
import { ouvrirLeBanc, type Banc } from '../banc.testkit';
import { runEnemyAI } from '../combatFlow';
import { createHero } from '../../engine/character';
import { seedBattleRng } from '../battleRng';
import { isFrenzied } from '../../engine/psychology';
import { psychDRAdjust } from '../../engine/combat';
import { groups } from '../../data';
import { testScene } from '../../scenes/test-fixture';
import type { Combatant } from '../../engine/types';
import { ciblePsy } from '../../engine/psych/ciblage';

let banc: Banc;
beforeEach(() => { banc = ouvrirLeBanc(); });

/** Le combattant PREND son rang d'initiative : `runEnemyAI` refuse un tour qui n'est pas celui de
 *  l'actif, et refuse de rejouer un tour déjà joué (jeton de tour, #1852). */
const auTourDe = (id: string): void => {
  const b = banc.getState().battle!;
  b.turn = b.order.indexOf(id);
};

/** Le Groupe relatif des adversaires Engagés, choisi par sa forme. */
const engages = groups.find((g) => g.relatif === 'engagesAvecPorteur');

/** Trait Rage : LDB 85 l.282 ; la Cible de la Haine, Q12 B (#3045). Hook `rage` (onTurnStart). */
describe('Rage → Haine (LDB 85 l.282, branche « minimum 1 »)', () => {
  it('précondition : la donnée a le Groupe relatif des Engagés', () => {
    expect(engages).toBeDefined();
  });

  function setup() {
    const hero = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'H', seed: 1 });
    banc.setState({ party: [hero] });
    banc.getState().startScene(testScene());
    seedBattleRng(777);
    banc.getState().startCombat('enc-mutants');
    banc.getState().confirmRoundStart();
    banc.abandonner();
    const b = banc.getState().battle!;
    const H = b.combatants.find((c) => c.kind === 'hero')!;
    const enemies = b.combatants.filter((c) => c.kind === 'enemy');
    enemies.slice(1).forEach((e) => (e.dead = true));
    const E = enemies[0];
    E.traits = [{ id: 'rage' }];
    H.pos = { x: 10, y: 10 };
    E.pos = { x: 11, y: 10 }; // au contact
    E.engagedWith = [H.id];
    H.engagedWith = [E.id];
    banc.setState({ battle: { ...b } });
    return { H, E };
  }

  it('Avantage 1 + adversaire ENGAGÉ → dépense tout, UNE Haine ACTIVE envers les adversaires Engagés', () => {
    const { H, E } = setup();
    E.advantage = 1;
    auTourDe(E.id);
    runEnemyAI(banc.getState, banc.setState, E.id);
    expect(E.advantage).toBe(0);
    expect(isFrenzied(E)).toBe(false);
    const haines = (E.psychState ?? []).filter((p) => p.type === 'haine');
    expect(haines).toHaveLength(1);
    expect(haines[0].active).toBe(true);
    expect(haines[0].cible).toBe(ciblePsy.groupe(engages!.id));
    expect(psychDRAdjust(E, H)).toBe(1);
    expect(banc.getState().battle!.log.some((l) => l.text.includes('Haine'))).toBe(true);
  });

  it('la Haine vise tout adversaire Engagé tant qu’elle dure, et lui seul (Q12 B)', () => {
    const { H, E } = setup();
    E.advantage = 1;
    auTourDe(E.id);
    runEnemyAI(banc.getState, banc.setState, E.id);
    E.engagedWith = [];
    H.engagedWith = [];
    expect(psychDRAdjust(E, H)).toBe(0);
    E.engagedWith = [H.id];
    H.engagedWith = [E.id];
    expect(psychDRAdjust(E, H)).toBe(1);
  });

  it('Avantage ≥ 3 → la branche FRÉNÉSIE prime (politique historique conservée)', () => {
    const { E } = setup();
    E.advantage = 3;
    auTourDe(E.id);
    runEnemyAI(banc.getState, banc.setState, E.id);
    expect(isFrenzied(E)).toBe(true);
    expect(E.advantage).toBe(0);
    expect((E.psychState ?? []).some((p) => p.type === 'haine')).toBe(false);
  });

  it('Haine des Engagés déjà ACTIVE → ne re-dépense PAS (l’Avantage est conservé)', () => {
    const { E } = setup();
    E.advantage = 1;
    auTourDe(E.id);
    runEnemyAI(banc.getState, banc.setState, E.id); // 1ʳᵉ Rage → Haine posée, Avantage 0
    E.advantage = 2; // regagné plus tard
    banc.getState().battle!.round += 1; // « plus tard » = un AUTRE Round (un tour ne se joue qu'une fois, #1852)
    runEnemyAI(banc.getState, banc.setState, E.id);
    expect(E.advantage).toBe(2);
    expect((E.psychState ?? []).filter((p) => p.type === 'haine')).toHaveLength(1);
  });

  it('Avantage 1 SANS adversaire Engagé → rien', () => {
    const { H, E } = setup();
    E.engagedWith = [];
    H.engagedWith = [];
    E.advantage = 1;
    auTourDe(E.id);
    runEnemyAI(banc.getState, banc.setState, E.id);
    expect(E.advantage).toBe(1);
    expect((E.psychState ?? []).some((p) => p.type === 'haine')).toBe(false);
  });

  it('un adversaire Engagé sans aucun Groupe est haï : la Cible ne lit que l’Engagement', () => {
    const { H, E } = setup();
    (H as Combatant).groups = [];
    H.career = undefined;
    E.advantage = 2;
    auTourDe(E.id);
    runEnemyAI(banc.getState, banc.setState, E.id);
    expect(E.advantage).toBe(0);
    expect(psychDRAdjust(E, H)).toBe(1);
  });
});
