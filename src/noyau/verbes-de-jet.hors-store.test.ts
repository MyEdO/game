/**
 * LES VERBES DE JET DU NOYAU (#3311) : un geste de jet est `jet<Verbe>(flux, …)`, le flux en premier argument. À la
 * frontière (JSON d'un hôte, intention d'un siège), un flux qui n'accepte pas le verbe, ou une rangée absente ou en
 * trop, se refuse et se dit (`creerVerbesDeJet`) ; la Résilience avant le jet lance le dé de son flux, mono comme multi
 * (LDB 17 l.68) ; le pilote d'auto-cadence joue le drive d'une étape-jet par ses gestes, chacun sur son flux.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { ouvrirLeBanc, type Banc } from './banc.testkit';
import { heroFaceAUnEnnemi } from './combatDeTest.testkit';
import { openAttackCascade } from './combatFlow';
import { tickCombatAuto } from './combatAuto';
import { intentAllowedFor } from './netOwnership';
import { testScene } from '../scenes/test-fixture';
import { testDeRegle } from '../engine/reglesChiffrees';
import { t } from '../i18n';
import type { Jeu } from './etat';

let banc: Banc;
const g = () => banc.getState();

describe('frontière : un geste de jet que son flux refuse se dit, et ne change rien', () => {
  beforeEach(() => {
    banc = ouvrirLeBanc();
    heroFaceAUnEnnemi(banc, testScene());
  });

  it.each([
    ['un flux inconnu', () => (g().jetRoll as (flux: string) => void)('zz-inconnu'), 'jet.refus.gesteAbsent'],
    ['un flux qui n’a pas ce verbe (Résistance sur l’incantation)', () => (g().jetResist as (flux: string) => void)('cast'), 'jet.refus.gesteAbsent'],
    ['une rangée absente sur un flux à plusieurs jets', () => (g().jetRoll as (flux: string) => void)('fall'), 'jet.refus.rangee'],
    ['une rangée posée sur un flux à un jet', () => g().jetRoll('attack', 'x'), 'jet.refus.rangee'],
  ] as const)('%s', (_cas, geste, cle) => {
    const avant = g();
    geste();
    expect(g().refus?.texte).toBe(t(cle));
    expect(g().pendingAttack).toBe(avant.pendingAttack);
    expect(g().battle!.combatants).toBe(avant.battle!.combatants);
  });

  it('la possession refuse à TOUT siège un geste que le flux n’accepte pas : l’annulation d’une Défense', () => {
    for (const seat of [0, 1, 2]) expect(intentAllowedFor(g(), seat, 'jetCancel', ['defense']), `siège ${seat}`).toBe(false);
  });
});

describe('Résilience AVANT le jet (LDB 17 l.68) : le dé du flux tombe, puis la réussite est achetée', () => {
  beforeEach(() => { banc = ouvrirLeBanc(); });

  it('flux à plusieurs jets : la rangée du tombant jette et réussit, un Point est dépensé', () => {
    const { H } = heroFaceAUnEnnemi(banc, testScene());
    const resilience = H.resilience ?? 0;
    expect(resilience, 'témoin : le héros a de la Résilience').toBeGreaterThan(0);
    banc.setState({
      pendingFall: { test: testDeRegle('chute', 'tenter'), to: { x: 0, y: 1 }, metres: 4, initiateurId: H.id, participants: [
        { id: H.id, interactive: true, attempt: true, result: null },
      ] },
    } as unknown as Partial<Jeu>);
    g().jetForceSuccess('fall', H.id);
    const rangee = g().pendingFall!.participants.find((p) => p.id === H.id)!;
    expect(rangee.result, 'le jet de la rangée est tombé').not.toBeNull();
    expect(g().battle!.combatants.find((c) => c.id === H.id)!.resilience).toBe(resilience - 1);
  });
});

describe('le pilote d’auto-cadence joue le drive d’une étape-jet, chaque geste sur son flux', () => {
  it('attaque en cadence Rapide : le jet d’attaque tombe et se confirme sans geste du joueur', () => {
    banc = ouvrirLeBanc({ cadence: 'rapide' });
    const { H, E } = heroFaceAUnEnnemi(banc, testScene());
    openAttackCascade(g, banc.setState, { attackerId: H.id, targetId: E.id, location: null, result: null, weaponUid: H.weapons[0].uid }, 'Attaque', 'action/attack');
    expect(g().pendingAttack?.result, 'témoin : le jet d’attaque attend').toBeNull();
    tickCombatAuto(g, banc.setState);
    banc.jusquA((s) => !s.pendingAttack, 20);
    expect(g().pendingAttack, 'le drive `jetRoll@attack` puis `attackConfirm` a clos l’attaque').toBeNull();
  });
});
