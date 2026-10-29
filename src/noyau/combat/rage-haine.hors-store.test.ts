import { describe, it, expect, beforeEach } from 'vitest';
import { ouvrirLeBanc, type Banc } from '../banc.testkit';
import { runEnemyAI } from '../combatFlow';
import { createHero } from '../../engine/character';
import { seedBattleRng } from '../battleRng';
import { isFrenzied } from '../../engine/psychology';
import { psychDRAdjust } from '../../engine/combat';
import { groupesDe } from '../../engine/groups';
import { testScene } from '../../scenes/test-fixture';
import type { Combatant } from '../../engine/types';
import { ciblePsy } from '../../engine/psych/ciblage';

let banc: Banc;
beforeEach(() => { banc = ouvrirLeBanc(); });

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
  const b = banc.getState().battle!;
  b.turn = b.order.indexOf(id);
};

describe('Rage → Haine (LDB 85 l.281-283, branche « minimum 1 »)', () => {
  beforeEach(() => { banc.setState({ battle: null }); });

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

  it('Avantage 1 + adversaire ENGAGÉ → dépense tout, Haine ACTIVE ciblant le groupe de l’adversaire (+1 DR d’attaque contre lui)', () => {
    const { H, E } = setup();
    E.advantage = 1;
    auTourDe(E.id);
    runEnemyAI(banc.getState, banc.setState, E.id);
    expect(E.advantage).toBe(0); // « dépenser TOUS ses Avantages »
    expect(isFrenzied(E)).toBe(false); // < 3 → pas la branche Frénésie
    const haine = (E.psychState ?? []).find((p) => p.type === 'haine');
    expect(haine).toBeTruthy();
    expect(haine!.active).toBe(true);
    expect(haine!.cible).toBe(ciblePsy.groupe(groupesDe(H)[0])); // « envers ses adversaires en combat rapproché »
    // La Haine FAIT quelque chose : +1 DR aux Tests de Combat contre le groupe haï (LDB 21, psychDRAdjust).
    expect(psychDRAdjust(E, H)).toBe(1);
    expect(banc.getState().battle!.log.some((l) => l.text.includes('Haine'))).toBe(true);
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

  it('Haine ACTIVE couvrant déjà tous les adversaires engagés → ne re-dépense PAS (l’Avantage est conservé)', () => {
    const { H, E } = setup();
    E.advantage = 1;
    auTourDe(E.id);
    runEnemyAI(banc.getState, banc.setState, E.id); // 1ʳᵉ Rage → Haine posée, Avantage 0
    E.advantage = 2; // regagné plus tard
    banc.getState().battle!.round += 1; // « plus tard » = un AUTRE Round (un tour ne se joue qu'une fois, #1852)
    runEnemyAI(banc.getState, banc.setState, E.id);
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
    runEnemyAI(banc.getState, banc.setState, E.id);
    expect(E.advantage).toBe(1); // pas de cible au contact → pas de dépense
    expect((E.psychState ?? []).some((p) => p.type === 'haine')).toBe(false);
  });

  it('adversaire engagé SANS Groupe modélisable → pas de dépense (garde groupMatch)', () => {
    const { H, E } = setup();
    (H as Combatant).groups = [];
    H.career = undefined;
    E.advantage = 2;
    auTourDe(E.id);
    runEnemyAI(banc.getState, banc.setState, E.id);
    expect(E.advantage).toBe(2);
    expect((E.psychState ?? []).some((p) => p.type === 'haine')).toBe(false);
  });
});
