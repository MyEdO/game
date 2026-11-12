import { idsDeTest } from '../engine/idsDeTest.testkit';
import { describe, it, expect, beforeEach } from 'vitest';
import { ouvrirLeBanc, type Banc } from './banc.testkit';
import { applyAttackResult } from './combatFlow';
import { availableAttacks } from './combatManeuvers';
import { createHero } from '../engine/character';
import { testScene } from '../scenes/test-fixture';
import { areGrappling, setGrapple } from '../engine/grapple';
import { addCondition, hasCondition, stacks, COND } from '../engine/conditions';
import { unarmedWeapon } from '../engine/items';
import type { AttackResult } from '../engine/combat';
import type { Combatant } from '../engine/types';
import { blessuresDeBase } from '../engine/combattantDeTest.testkit';
import { t } from '../i18n';

let banc: Banc;
beforeEach(() => { banc = ouvrirLeBanc(); });

// Empoignade (Issue #42.1, LDB 14 l.159/161/169).

const hitRes: AttackResult = {
  hit: true, attackerRoll: 40, netSL: 2, location: 'corps', damage: 8, woundsLost: 8,
  critical: false, advantageTo: 'attaquant', defenderDefeated: false, log: '',
};
const missRes: AttackResult = {
  hit: false, attackerRoll: 80, netSL: 0, damage: 0, woundsLost: 0,
  critical: false, advantageTo: null, defenderDefeated: false, log: '',
};

describe('Empoignade — store + funnel (LDB 14 l.159/161/169)', () => {
  function setup() {
    const hero = createHero({ idNeuf: idsDeTest, speciesId: 'humains-reiklander', careerId: 'soldat', label: 'H', seed: 1 });
    banc.setState({ party: [hero] });
    banc.getState().lancerLaScene(testScene());
    banc.getState().lancerLeCombat('enc-mutants');
    banc.getState().fenetreValider('debutDuRound');
    banc.abandonner();
    const b = banc.getState().battle!;
    const H = b.combatants.find((c) => c.kind === 'heros')!;
    const enemies = b.combatants.filter((c) => c.kind === 'ennemi');
    return { H, enemies };
  }

  const live = (id: string) => banc.getState().battle!.combatants.find((c) => c.id === id)!;

  /** Place le tour sur H, Action libre, H Engagé avec `foe`. */
  function activate(H: Combatant, foe: Combatant) {
    H.engagedWith = [foe.id];
    foe.engagedWith = [H.id];
    const b = banc.getState().battle!;
    const turn = b.order.indexOf(H.id);
    banc.setState({ battle: { ...b, turn, action: null, movementUsed: 0, acted: false } });
  }

  // ── b. Initiation (déclarée avant le jet, « au lieu des Dégâts ») ──
  it('initiation : touche en mode Empoignade → les deux Empoignés, cible Empêtrée, ZÉRO Dégât', () => {
    const { H, enemies } = setup();
    const E = enemies[0];
    enemies.slice(1).forEach((e) => (e.dead = true));
    activate(H, E);
    const h = live(H.id), e = live(E.id);
    const woundsBefore = e.wounds.current;
    // grapple=true (10ᵉ arg) : sur une touche, pose l'Empoignade au lieu de blesser.
    applyAttackResult(banc.getState, banc.setState, h, e, unarmedWeapon(), { ...hitRes }, { suite: { grapple: true } });
    expect(areGrappling(live(H.id), live(E.id))).toBe(true);
    expect(hasCondition(live(E.id), COND.empetre)).toBe(true);
    expect(live(E.id).wounds.current).toBe(woundsBefore); // pas de Dégâts sur l'initiation
  });

  it('initiation qui RATE → ni Empoignade ni Empêtré', () => {
    const { H, enemies } = setup();
    const E = enemies[0];
    enemies.slice(1).forEach((e) => (e.dead = true));
    activate(H, E);
    applyAttackResult(banc.getState, banc.setState, live(H.id), live(E.id), unarmedWeapon(), { ...missRes }, { suite: { grapple: true } });
    expect(areGrappling(live(H.id), live(E.id))).toBe(false);
    expect(hasCondition(live(E.id), COND.empetre)).toBe(false);
  });

  it('NON-régression : une touche SANS Empoignade inflige toujours des Dégâts (et n’Empoigne pas)', () => {
    const { H, enemies } = setup();
    const E = enemies[0];
    enemies.slice(1).forEach((e) => (e.dead = true));
    activate(H, E);
    const e0 = live(E.id);
    e0.armour = { tete: 0, corps: 0, brasG: 0, brasD: 0, jambeG: 0, jambeD: 0 } as never;
    e0.wounds = blessuresDeBase(20, 20, e0);
    const before = live(E.id).wounds.current;
    applyAttackResult(banc.getState, banc.setState, live(H.id), live(E.id), unarmedWeapon(), { ...hitRes }); // pas de grapple
    expect(live(E.id).wounds.current).toBeLessThan(before); // Dégâts appliqués
    expect(areGrappling(live(H.id), live(E.id))).toBe(false);
  });

  // ── c. Action « pendant l'Empoignade » ──
  it('availableAttacks expose « Empoignade » quand les deux sont Empoignés', () => {
    const { H, enemies } = setup();
    const E = enemies[0];
    enemies.slice(1).forEach((e) => (e.dead = true));
    activate(H, E);
    setGrapple(live(H.id), live(E.id));
    const opts = availableAttacks(live(H.id), banc.getState().battle!);
    expect(opts.some((o) => o.id === 'grapple' && o.targeting === 'grapple')).toBe(true);
  });

  it('Avantage supérieur → « Briser » dispo, libère l’Empoignade et retire l’Empêtré de l’acteur', () => {
    const { H, enemies } = setup();
    const E = enemies[0];
    enemies.slice(1).forEach((e) => (e.dead = true));
    activate(H, E);
    const h = live(H.id), e = live(E.id);
    setGrapple(h, e);
    addCondition(h, COND.empetre, 1); // (met l'Avantage à 0)
    h.advantage = 2; e.advantage = 0; // Avantage strictement supérieur
    banc.getState().ouvrirLEmpoignade(E.id);
    const pd = banc.getState().pendingGrapple!;
    expect(pd.canBreak).toBe(true);
    banc.getState().jetRegler('empoignade', 'briser', true);
    expect(banc.getState().pendingGrapple).toBeNull();
    expect(areGrappling(live(H.id), live(E.id))).toBe(false);
    expect(hasCondition(live(H.id), COND.empetre)).toBe(false);
    expect(banc.getState().battle!.acted).toBe(false); // Briser est GRATUIT
  });

  it('Avantage NON supérieur → « Briser » est fermé : refusé en le disant, l’Empoignade tient', () => {
    const { H, enemies } = setup();
    const E = enemies[0];
    enemies.slice(1).forEach((e) => (e.dead = true));
    activate(H, E);
    const h = live(H.id), e = live(E.id);
    setGrapple(h, e);
    h.advantage = 0; e.advantage = 2;
    banc.getState().ouvrirLEmpoignade(E.id);
    const pd = banc.getState().pendingGrapple!;
    expect(pd.canBreak).toBeFalsy();
    banc.getState().jetRegler('empoignade', 'briser', true);
    expect(banc.getState().pendingGrapple).toBe(pd);
    expect(areGrappling(live(H.id), live(E.id))).toBe(true);
    expect(banc.getState().refus?.texte).toBe(t('jet.ferme.nonOffert'));
  });

  it('Test de Force gagné, option Dégâts → BF + DR en IGNORANT les PA (cible blindée subit autant que nue)', () => {
    const { H, enemies } = setup();
    const E = enemies[0];
    enemies.slice(1).forEach((e) => (e.dead = true));
    activate(H, E);
    const h = live(H.id), e = live(E.id);
    h.characteristics = { ...h.characteristics, force: 40 } as never; // BF 4
    e.characteristics = { ...e.characteristics, endurance: 30 } as never;  // BE 3
    e.armour = { tete: 5, corps: 5, brasG: 5, brasD: 5, jambeG: 5, jambeD: 5 } as never; // PA ignorés
    e.wounds = blessuresDeBase(20, 20, e);
    setGrapple(h, e);
    banc.getState().ouvrirLEmpoignade(E.id);
    const pd = banc.getState().pendingGrapple!;
    // Force l'issue : l'acteur l'emporte avec DR net 2 (def.sl 2 vs atk.sl 0).
    banc.setState({ pendingGrapple: { ...pd,
      def: { roll: 30, target: 40, success: true, sl: 2, isDouble: false },
      atk: { roll: 50, target: 40, success: true, sl: 0, isDouble: false },
      result: 'reussite' } });
    banc.getState().jetValider('empoignade');
    expect(banc.getState().pendingGrapple?.phase).toBe('options');
    const before = live(E.id).wounds.current;
    banc.getState().jetRegler('empoignade', 'issue', 'degats');
    // BF(4) + DR(2) = 6, − BE(3) = 3, PA ignorés (armure 5 sans effet).
    expect(before - live(E.id).wounds.current).toBe(3);
    expect(banc.getState().battle!.acted).toBe(true);
  });

  it('option Empêtrer → l’adversaire gagne l’État Empêtré', () => {
    const { H, enemies } = setup();
    const E = enemies[0];
    enemies.slice(1).forEach((e) => (e.dead = true));
    activate(H, E);
    const h = live(H.id), e = live(E.id);
    setGrapple(h, e);
    banc.getState().ouvrirLEmpoignade(E.id);
    const pd = banc.getState().pendingGrapple!;
    banc.setState({ pendingGrapple: { ...pd, def: pd.atk, result: 'reussite', phase: 'jet' } });
    banc.getState().jetValider('empoignade');
    banc.getState().jetRegler('empoignade', 'issue', 'empetrer');
    expect(hasCondition(live(E.id), COND.empetre)).toBe(true);
  });

  it('option Se libérer → retire son propre Empêtré (1 + DR pions)', () => {
    const { H, enemies } = setup();
    const E = enemies[0];
    enemies.slice(1).forEach((e) => (e.dead = true));
    activate(H, E);
    const h = live(H.id), e = live(E.id);
    setGrapple(h, e);
    addCondition(h, COND.empetre, 3); // 3 pions sur l'acteur
    banc.getState().ouvrirLEmpoignade(E.id);
    const pd = banc.getState().pendingGrapple!;
    // DR net 1 (def.sl 1 vs atk.sl 0) → retire 1 + 1 = 2 pions.
    banc.setState({ pendingGrapple: { ...pd,
      def: { roll: 30, target: 40, success: true, sl: 1, isDouble: false },
      atk: { roll: 50, target: 40, success: true, sl: 0, isDouble: false },
      result: 'reussite', phase: 'jet' } });
    banc.getState().jetValider('empoignade');
    banc.getState().jetRegler('empoignade', 'issue', 'liberer');
    expect(stacks(live(H.id), COND.empetre)).toBe(1); // 3 − (1 + DR 1) = 1
  });

  /** LDB 14 l.161 : le Test opposé de Force EST l'Action — avant le jet on y renonce, après il se joue. */
  it('renoncer avant le jet ferme la fenêtre sans rien consommer ; après le jet, le refus est dit et rien ne bouge', () => {
    const { H, enemies } = setup();
    const E = enemies[0];
    enemies.slice(1).forEach((e) => (e.dead = true));
    activate(H, E);
    setGrapple(live(H.id), live(E.id));
    banc.getState().ouvrirLEmpoignade(E.id);
    banc.getState().jetAnnuler('empoignade');
    expect(banc.getState().pendingGrapple).toBeNull();
    expect(banc.getState().battle!.acted).toBe(false);

    banc.getState().ouvrirLEmpoignade(E.id);
    banc.getState().jetLancer('empoignade');
    const lance = banc.getState().pendingGrapple;
    expect(lance?.result).toBeTruthy();
    banc.getState().jetAnnuler('empoignade');
    expect(banc.getState().pendingGrapple).toBe(lance);
    expect(banc.getState().refus?.texte).toBe(`Renoncement refusé : ${H.label} a déjà engagé son action, elle se joue jusqu’au bout.`);
  });

  it('Test de Force PERDU → l’adversaire gagne +1 Avantage', () => {
    const { H, enemies } = setup();
    const E = enemies[0];
    enemies.slice(1).forEach((e) => (e.dead = true));
    activate(H, E);
    const h = live(H.id), e = live(E.id);
    setGrapple(h, e);
    e.advantage = 1;
    banc.getState().ouvrirLEmpoignade(E.id);
    const pd = banc.getState().pendingGrapple!;
    banc.setState({ pendingGrapple: { ...pd, def: pd.atk, result: 'echec' } });
    banc.getState().jetValider('empoignade');
    expect(live(E.id).advantage).toBe(2); // +1 Avantage (l.161)
    expect(banc.getState().pendingGrapple).toBeNull();
    expect(banc.getState().battle!.acted).toBe(true);
  });
});
