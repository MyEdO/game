/**
 * UNE ouverture de tour (`ouvrirLeTour`, #5042 V3a) : le premier tour d'un Round neuf et le tour suivant du même Round
 * rendent le même budget pour les mêmes dus — `loseNextAction`, `loseNextMovement` (Oups! 61-80, Tir rapide LDB 11
 * l.97-103), la pénalité du Maniement de deux armes (LDB 10 l.767-773) et le gate d'action (`testDAgir`, LDB 71 l.35),
 * y compris quand le premier de l'ordre est hors de combat.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ouvrirLeBanc, type Banc } from './banc.testkit';
import { heroFaceAUnEnnemi } from './combatDeTest.testkit';
import { deDeCombat, franchirLeRound, lancerLeRoundDu, ouvrirLeTourSuivant } from './ouvertureDuTour.testkit';
import { mountMovement } from './mount';
import { seedBattleRng } from './battleRng';
import { setCadence } from '../engine/cadence';
import { testScene } from '../scenes/test-fixture';
import type { Combatant } from '../engine/types';

let banc: Banc;
beforeEach(() => { banc = ouvrirLeBanc(); setCadence('rapide'); });
afterEach(() => setCadence('manuel'));

const g = () => banc.getState();
const relu = (id: string): Combatant => g().battle!.combatants.find((c) => c.id === id)!;

type Du = 'loseNextAction' | 'loseNextMovement' | 'dualStrikeDefensePenalty' | 'testDAgir';
const DUS: readonly Du[] = ['loseNextAction', 'loseNextMovement', 'dualStrikeDefensePenalty', 'testDAgir'];

/** Pose le dû `du` sur le héros `H` (le Test du gate échoue). */
function poser(H: Combatant, du: Du): void {
  if (du === 'loseNextAction') H.loseNextAction = true;
  else if (du === 'loseNextMovement') H.loseNextMovement = true;
  else if (du === 'dualStrikeDefensePenalty') H.dualStrikeDefensePenalty = -10;
  else H.activeEffects = [{ label: 'Racine de mandragore', bonus: 0, duration: { scale: 'rounds', left: 9 }, testDAgir: { characteristic: 'force-mentale' } }];
}

/** Le budget du tour du héros, ses dus relus. */
function budget(id: string) {
  const b = g().battle!;
  const H = relu(id);
  return {
    actif: b.order[b.turn] === id, acted: b.acted, movementUsed: b.movementUsed,
    loseNextAction: !!H.loseNextAction, loseNextMovement: !!H.loseNextMovement, dualStrike: H.dualStrikeDefensePenalty,
  };
}

/** Le budget attendu de l'ouverture pour le dû `du`. */
function attendu(du: Du, H: Combatant) {
  const plein = mountMovement(g().battle!, relu(H.id));
  return {
    actif: true, acted: du === 'loseNextAction',
    movementUsed: du === 'loseNextMovement' || du === 'testDAgir' ? plein : 0,
    loseNextAction: false, loseNextMovement: false, dualStrike: undefined,
  };
}

/** Ouvre le tour du héros par l'ouverture `ouverture`, le dû `du` posé ; `premierHorsDeCombat` : le premier de l'ordre
 *  du Round neuf est un ennemi hors de combat. */
function ouvrir(ouverture: 'round' | 'suivant', du: Du, premierHorsDeCombat = false) {
  seedBattleRng(7);
  const { H, E } = heroFaceAUnEnnemi(banc, testScene());
  const mort = g().battle!.combatants.find((c) => c.kind === 'ennemi' && c.id !== E.id)!;
  poser(H, du);
  deDeCombat(100);
  if (ouverture === 'suivant') ouvrirLeTourSuivant(banc, E.id, H.id);
  else {
    franchirLeRound(banc, premierHorsDeCombat ? [mort.id, H.id] : [H.id]);
    lancerLeRoundDu(banc);
  }
  banc.abandonner();
  return { H, attendu: attendu(du, H), budget: budget(H.id) };
}

describe('ouverture du tour : même budget au Round neuf et au tour suivant (#5042)', () => {
  for (const du of DUS) {
    for (const ouverture of ['round', 'suivant'] as const) {
      it(`${du} — ${ouverture === 'round' ? 'premier tour du Round' : 'tour suivant'}`, () => {
        const { budget: b, attendu: a } = ouvrir(ouverture, du);
        expect(b).toEqual(a);
      });
    }
    it(`${du} — premier tour du Round, le premier de l'ordre hors de combat`, () => {
      const { budget: b, attendu: a } = ouvrir('round', du, true);
      expect(b).toEqual(a);
    });
  }
});
