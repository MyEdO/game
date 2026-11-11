/**
 * LES VERBES DE JET DU NOYAU (#3311) : un geste de jet est `jet<Verbe>(flux, …)`, le flux en premier argument. À la
 * frontière (JSON d'un hôte, intention d'un siège), un flux qui n'accepte pas le verbe, ou une rangée absente ou en
 * trop, se refuse et se dit (`creerVerbesDeJet`) ; la Résilience avant le jet lance le dé de son flux, mono comme multi
 * (LDB 17 l.68) ; le pilote d'auto-cadence joue le drive d'une étape-jet par ses gestes, chacun sur son flux ; la
 * clôture `jetValider(flux)` (#3324) se juge sur la fermeture que la fenêtre montre, et dit celle qui attend une décision.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { ouvrirLeBanc, type Banc } from './banc.testkit';
import { heroFaceAUnEnnemi } from './combatDeTest.testkit';
import { openAttackCascade } from './combatFlow';
import { tickCombatAuto } from './combatAuto';
import { intentAllowedFor } from './netOwnership';
import { fermeturesDuFlux } from './verbesOuverts';
import { libelleDeLaFermeture } from './libelles';
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
    ['un flux inconnu', () => (g().jetLancer as (flux: string) => void)('zz-inconnu'), 'jet.refus.gesteAbsent'],
    ['un flux qui n’a pas ce verbe (Résistance sur l’incantation)', () => (g().jetResister as (flux: string) => void)('incantation'), 'jet.refus.gesteAbsent'],
    ['une rangée absente sur un flux à plusieurs jets', () => (g().jetRelancer as (flux: string) => void)('chute'), 'jet.refus.rangee'],
    ['une rangée posée sur un flux à un jet', () => g().jetLancer('attaque', 'x'), 'jet.refus.rangee'],
  ] as const)('%s', (_cas, geste, cle) => {
    const avant = g();
    geste();
    expect(g().refus?.texte).toBe(t(cle));
    expect(g().pendingAttack).toBe(avant.pendingAttack);
    expect(g().battle!.combatants).toBe(avant.battle!.combatants);
  });

  it('la possession refuse à TOUT siège un geste que le flux n’accepte pas : l’annulation d’une Défense', () => {
    for (const seat of [0, 1, 2]) expect(intentAllowedFor(g(), seat, 'jetAnnuler', ['defense']), `siège ${seat}`).toBe(false);
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
    g().jetForcerLaReussite('chute', H.id);
    const rangee = g().pendingFall!.participants.find((p) => p.id === H.id)!;
    expect(rangee.result, 'le jet de la rangée est tombé').not.toBeNull();
    expect(g().battle!.combatants.find((c) => c.id === H.id)!.resilience).toBe(resilience - 1);
  });
});

describe('le pilote d’auto-cadence joue le drive d’une étape-jet, chaque geste sur son flux', () => {
  it('attaque en cadence Rapide : le jet d’attaque tombe et se confirme sans geste du joueur', () => {
    banc = ouvrirLeBanc({ cadence: 'rapide' });
    const { H, E } = heroFaceAUnEnnemi(banc, testScene());
    openAttackCascade(g, banc.setState, { attackerId: H.id, targetId: E.id, location: null, result: null, weaponUid: H.weapons[0].uid }, 'Attaque', 'action/attaquer');
    expect(g().pendingAttack?.result, 'témoin : le jet d’attaque attend').toBeNull();
    tickCombatAuto(g, banc.setState);
    banc.jusquA((s) => !s.pendingAttack, 20);
    expect(g().pendingAttack, 'le drive `jetLancer@attaque` puis `jetValider(\'attaque\')` a clos l’attaque').toBeNull();
  });
});

describe('la clôture `jetValider(flux)` (#3324) : jugée sur la fenêtre, comme les autres verbes de jet', () => {
  beforeEach(() => { banc = ouvrirLeBanc(); });

  it.each([
    ['un flux inconnu', 'zz-inconnu'],
    ['une bande, que valide sa cascade', 'cascadeEnBande'],
  ] as const)('refuse et dit %s', (_cas, flux) => {
    heroFaceAUnEnnemi(banc, testScene());
    (g().jetValider as (flux: string) => void)(flux);
    expect(g().refus?.texte).toBe(t('jet.refus.gesteAbsent'));
  });

  it('avant le jet, la clôture est fermée sans un mot : l’attaque reste en attente', () => {
    const { H, E } = heroFaceAUnEnnemi(banc, testScene());
    openAttackCascade(g, banc.setState, { attackerId: H.id, targetId: E.id, location: null, result: null, weaponUid: H.weapons[0].uid }, 'Attaque', 'action/attaquer');
    const avant = g().pendingAttack;
    g().jetValider('attaque');
    expect(g().pendingAttack).toBe(avant);
    expect(g().refus).toBeFalsy();
  });

  it('une opposition au Sort qu’une cible n’a pas jetée : la clôture se dit refusée, comme la fenêtre la montre', () => {
    const { H } = heroFaceAUnEnnemi(banc, testScene());
    banc.setState({ pendingCastOpposition: { test: { characteristic: 'force-mentale' }, participants: [{ id: H.id, interactive: true, base: 40, target: 40, result: null }] } } as unknown as Partial<Jeu>);
    const avant = g().pendingCastOpposition;
    expect(fermeturesDuFlux(g(), 'opposition').valider).toBe('oppositionsDues');
    g().jetValider('opposition');
    expect(g().refus?.texte).toBe(libelleDeLaFermeture('oppositionsDues'));
    expect(g().pendingCastOpposition).toBe(avant);
  });

  it('une chute dont une rangée n’a pas déclaré : la fenêtre et le verbe disent la même fermeture', () => {
    const { H } = heroFaceAUnEnnemi(banc, testScene());
    banc.setState({
      pendingFall: { test: testDeRegle('chute', 'tenter'), to: { x: 0, y: 1 }, metres: 4, initiateurId: H.id, participants: [
        { id: H.id, interactive: true, attempt: null, result: null },
      ] },
    } as unknown as Partial<Jeu>);
    const avant = g().pendingFall;
    expect(fermeturesDuFlux(g(), 'chute').valider).toBe('declarationsDues');
    g().jetValider('chute');
    expect(g().refus?.texte).toBe(libelleDeLaFermeture('declarationsDues'));
    expect(g().pendingFall).toBe(avant);
  });

  it('un Contre-sort en déclaration (LDB 46 l.156) : ni clôture ni annulation tant qu’un candidat n’a pas déclaré', () => {
    const { H } = heroFaceAUnEnnemi(banc, testScene());
    banc.setState({ pendingCounterspell: { participants: [{ id: H.id, interactive: true, base: 40, target: 40, result: null }] } } as unknown as Partial<Jeu>);
    const fermetures = fermeturesDuFlux(g(), 'contreSort');
    expect([fermetures.valider, fermetures.annuler]).toEqual(['declarationsDues', 'declarationsDues']);
    const avant = g().pendingCounterspell;
    g().jetValider('contreSort');
    expect(g().refus?.texte).toBe(libelleDeLaFermeture('declarationsDues'));
    expect(g().pendingCounterspell).toBe(avant);
  });

  it('un Contre-sort déclaré : la clôture attend le jet de chaque contre-lanceur qui lance (#3324)', () => {
    const { H } = heroFaceAUnEnnemi(banc, testScene());
    const rangee = { id: H.id, interactive: true, base: 40, target: 40, declared: 'solo' as const };
    banc.setState({ pendingCounterspell: { participants: [{ ...rangee, result: null }] } } as unknown as Partial<Jeu>);
    expect(fermeturesDuFlux(g(), 'contreSort').valider, 'le contre-lanceur déclaré n’a pas lancé').toBe('jetNonLance');
    banc.setState({ pendingCounterspell: { participants: [{ ...rangee, result: { dispelled: false, counter: { roll: 90, target: 40, sl: -3, success: false, isDouble: false } } }] } } as unknown as Partial<Jeu>);
    expect(fermeturesDuFlux(g(), 'contreSort').valider, 'son jet est tombé').toBeNull();
  });
});
