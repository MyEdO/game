/**
 * Un même Test, deux conducteurs : le héros (flux de jet, modale) et l'IA (jet inline, ou la fenêtre de son geste
 * jouée d'office) jettent la même valeur de Test (`testValue`, LDB 16 l.125) et affrontent la même cible. Héros et ennemi à
 * caractéristiques égales, Sonné ×3 l'un et l'autre. Le dé de l'IA est posé sur la cible du héros
 * (réussite), puis juste au-dessus (échec).
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { ouvrirLeBanc, type Banc } from './banc.testkit';
import { aiHandGate, attackWardGate, openAttackCascade } from './combatFlow';
import { actionALaClotureDeLaFrenesie, deDeCombat, franchirLeRound, jouerLeTourDeLIA, lancerLeRoundDu } from './ouvertureDuTour.testkit';
import { heroFaceAUnEnnemi, reluDans } from './combatDeTest.testkit';
import { testScene } from '../scenes/test-fixture';
import { isFrenzied } from '../engine/psychology';
import { tavernGameValue } from './tavernFlow';
import { findTavernGameById } from '../engine/tavernGame';
import type { Combatant } from '../engine/types';
import { deFixe } from '../engine/dice.testkit';

let banc: Banc;
beforeEach(() => { banc = ouvrirLeBanc(); });

const g = () => banc.getState();

/** Héros et ennemi au contact, mêmes caractéristiques et mêmes talents, Sonné ×3 l'un et l'autre. */
function jumeauxSonnes(): { H: Combatant; E: Combatant } {
  const { H, E } = heroFaceAUnEnnemi(banc, testScene());
  const caracs = { ...H.characteristics, 'force-mentale': 60, dexterite: 60 };
  for (const c of [H, E]) {
    c.characteristics = { ...caracs };
    c.talents = [];
    c.conditions = [{ id: 'sonne', value: 3 }];
  }
  return { H, E };
}

/** Le tour de l'IA jumelle du héros, capable de Frénésie, Sonnée ×3 ou non, à 11 cases du héros (aucune frappe ce
 *  tour, avec ou sans Frénésie), aux dés de combat `de` : l'Action à la clôture de son Test, et sa Frénésie. */
function tourDeLIA(de: number, sonne: boolean): { actionALaCloture: boolean | undefined; frenetique: boolean } {
  const { H, E } = jumeauxSonnes();
  if (!sonne) E.conditions = [];
  E.traits = [{ id: 'frenesie' }];
  E.pos = { x: H.pos!.x + 11, y: H.pos!.y };
  banc.setState({ battle: { ...g().battle! } });
  deDeCombat(de);
  const actionALaCloture = actionALaClotureDeLaFrenesie(banc, () => jouerLeTourDeLIA(banc, H.id, E.id));
  return { actionALaCloture, frenetique: isFrenzied(reluDans(g, E)) };
}

/** La cible du héros porte les −30 de Sonné ×3 ; l'IA réussit au dé égal à cette cible et échoue juste au-dessus. */
function memeCible(cibleHeros: number, attendue: number, ia: (de: number) => boolean): void {
  expect(cibleHeros, 'cible du héros : 60 −30 Sonné, plus la Difficulté').toBe(attendue);
  expect(ia(cibleHeros), `dé ${cibleHeros} : réussite sur la cible du héros`).toBe(true);
  expect(ia(cibleHeros + 1), `dé ${cibleHeros + 1} : échec au-dessus de la cible du héros`).toBe(false);
}

beforeEach(() => { banc.setState({ battle: null, pendingFrenzy: null, pendingWard: null, pendingHandGate: null, pendingAttack: null, pendingCascade: null }); });

describe('même Test, héros et IA Sonnés ×3 : même cible (LDB 16 l.125)', () => {
  it('entrée en Frénésie : un Test de Force Mentale, donc l’Action, que le Sonné n’a pas — ni le héros ni l’IA n’entrent (LDB 21 l.31 ; LDB 13 l.106 ; LDB 16 l.125)', () => {
    const { H } = jumeauxSonnes();
    H.traits = [{ id: 'frenesie' }];
    g().entrerEnFrenesie();
    expect(g().pendingFrenzy, 'le héros Sonné a ouvert le Test d’entrée en Frénésie').toBeNull();
    expect(tourDeLIA(1, true).actionALaCloture, 'l’IA Sonnée a ouvert le Test d’entrée en Frénésie').toBeUndefined();
  });

  it('entrée en Frénésie hors Sonné : héros et IA jettent la même cible, et le Test prend l’Action de l’un et de l’autre (LDB 21 l.31 ; LDB 13 l.106)', () => {
    const { H } = jumeauxSonnes();
    H.conditions = [];
    H.traits = [{ id: 'frenesie' }];
    g().entrerEnFrenesie();
    g().jetLancer('frenesie');
    const cible = g().pendingFrenzy!.result!.target!;
    g().jetValider('frenesie');
    expect(g().battle!.acted, 'le Test du héros a pris son Action').toBe(true);
    memeCible(cible, 60, (de) => {
      const tour = tourDeLIA(de, false);
      expect(tour.actionALaCloture, `dé ${de} : le Test de l’IA a pris son Action`).toBe(true);
      return tour.frenetique;
    });
  });

  it('Bénédiction de Protection (Test de Force Mentale Accessible, LDB 41)', () => {
    const { H, E } = jumeauxSonnes();
    (H as { activeEffects?: unknown[] }).activeEffects = [{ label: 'Bénédiction de Protection', bonus: 0, duration: { scale: 'rounds', left: 6 }, attackWardFM: true }];
    banc.setState({ pendingWard: { attackerId: H.id, targetId: E.id, result: null } } as never);
    g().jetLancer('protection');
    const cible = g().pendingWard!.result!.target!;
    memeCible(cible, 50, (de) => attackWardGate(E, H, deFixe(de)).allowed);
  });

  it('Main ensanglantée (Test de Dextérité Accessible, AA 07 l.117)', () => {
    const { H, E } = jumeauxSonnes();
    H.handGates = ['main']; E.handGates = ['main'];
    openAttackCascade(g, banc.setState, { attackerId: H.id, targetId: E.id, location: null, result: null }, 'Attaque', 'action/attaquer');
    const cible = g().pendingHandGate!.target;
    memeCible(cible, 50, (de) => {
      deDeCombat(de);
      return aiHandGate(g, banc.setState, E);
    });
  });
});

describe('Test d’un seul conducteur, Sonné ×3 : la valeur de Test (LDB 16 l.125)', () => {
  it('partie de taverne à la caractéristique (Bras de fer, Force)', () => {
    const { H } = jumeauxSonnes();
    const sansEtat = { ...H, conditions: [] };
    expect(tavernGameValue(H, findTavernGameById('bras-de-fer')!)).toBe(tavernGameValue(sansEtat, findTavernGameById('bras-de-fer')!) - 30);
  });

  /** L'ennemi Stupide, sans allié à ses côtés, passe le début du Round au dé `de` : son tour s'ouvre-t-il sans Action ? */
  function stupidePerdSonTour(de: number): boolean {
    const { E } = jumeauxSonnes();
    E.traits = [{ id: 'stupide' }];
    E.characteristics = { ...E.characteristics, intelligence: 40 };
    deDeCombat(de);
    franchirLeRound(banc, [E.id]);
    lancerLeRoundDu(banc);
    banc.abandonner();
    const b = g().battle!;
    expect(b.order[b.turn], 'le tour de l’ennemi Stupide s’ouvre').toBe(E.id);
    return b.acted;
  }
  it('Stupide (LDB 85 l.335) : Test d’Intelligence Facile, cible 40 −30 Sonné +40 = 50', () => {
    expect(stupidePerdSonTour(50), 'dé 50 : réussite').toBe(false);
    expect(stupidePerdSonTour(51), 'dé 51 : échec, tour perdu').toBe(true);
  });
});
