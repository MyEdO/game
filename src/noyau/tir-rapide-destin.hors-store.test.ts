/**
 * #4860 — un Destin ouvert au milieu d'une séquence la suspend ; après le choix, elle reprend où elle était
 * (LDB 17 l.29-32). La boucle des Tirs rapides de l'IA (LDB 11 l.97-103) : les tireurs restants tirent une fois,
 * puis le Round s'ouvre. L'acteur actif mis hors de combat par le coup : son tour passe au suivant.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { activeCombatant, advanceTurn } from './combatFlow';
import { ouvrirLeBanc, type Banc } from './banc.testkit';
import type { BattleState } from './etat';
import { initialFields } from './stateFields';
import { initialNet } from './etat';
import { createHero } from '../engine/character';
import { seedBattleRng } from './battleRng';
import { imposerLesD100 } from './battleRng.testkit';
import { emptyScene } from './monde/scene';
import { nomEnVue } from './visionDuGroupe';
import { t } from '../i18n';
import type { Combatant, Weapon } from '../engine/types';
import { avanceEtapeCascade, draineCascade, poseSurDeNonTombe } from './cascade.testkit';
import { blessuresDeBase } from '../engine/combattantDeTest.testkit';
import { heroDuDuel, MELEE, ouvrirLeDuel } from './combatDeTest.testkit';
import { frapper } from './coupHorsBataille.testkit';
import { testScene } from '../scenes/test-fixture';
import { resetRule, setRule } from '../engine/policy';
import { idsDeTest } from '../engine/idsDeTest.testkit';
import { addCondition, COND, isOutOfAction } from '../engine/conditions';

let banc: Banc;
beforeEach(() => { banc = ouvrirLeBanc(); seedBattleRng(3); });
afterEach(() => { resetRule('combat-cible-inconsciente'); });

const ARC = (): Weapon => ({ uid: 'arc', label: 'Arc', type: 'distance', damage: { plusBF: false, flat: 1 }, range: 30, qualities: [], loaded: true } as unknown as Weapon);
const g = () => banc.getState();
const de = (id: string): Combatant => g().battle!.combatants.find((c) => c.id === id)!;
/** Les marqueurs de Tir rapide de `id`, nommé comme le groupe le voit. */
const tirsDe = (id: string) => g().battle!.log.filter((l) => l.actorId === id && l.text === t('cf.tirRapide', { name: nomEnVue(g(), id)! })).length;

/** Deux héros, E1 (Tir rapide ×2) et, sur demande, E2 (×1), arcs à Bout portant ; H1 à 0 Blessure et 1 Destin. Fin du
 *  Round 1, puis le Round 2 lancé : E1 tire le premier sur H1 (LDB 11 l.103). */
function tirRapideSurUnHerosADestin(mode: 'local' | 'hote', tireurs: 1 | 2): void {
  const mk = (id: string, kind: 'heros' | 'ennemi', pos: { x: number; y: number }): Combatant => {
    const c = createHero({ idNeuf: idsDeTest, speciesId: 'humains-reiklander', careerId: 'soldat', label: id, seed: 3 });
    c.id = id; c.label = id; c.kind = kind; c.pos = pos; c.fortune = 0;
    c.wounds = blessuresDeBase(200, 200, c);
    return c;
  };
  const H1 = mk('h1', 'heros', { x: 0, y: 0 });
  const H2 = mk('h2', 'heros', { x: 0, y: 4 });
  const E1 = mk('e1', 'ennemi', { x: 1, y: 0 });
  const E2 = mk('e2', 'ennemi', { x: 1, y: 4 });
  E1.talents = [{ talentId: 'tir-rapide', times: 2 }];
  E2.talents = tireurs === 2 ? [{ talentId: 'tir-rapide', times: 1 }] : [];
  E1.weapons = [ARC()]; E2.weapons = [ARC()];
  const battle = {
    combatants: [H1, H2, E1, E2], order: ['h1', 'h2', 'e1', 'e2'], turn: 3, round: 1, action: null, selectedSpellId: null,
    reachable: new Map(), movementUsed: 0, movedPreAction: false, acted: false, log: [], over: null,
  } as unknown as BattleState;
  const net = mode === 'local' ? { ...g().net, mode: 'local' as const, mySeat: 0, ownership: {} } : { ...initialNet(), mode: 'hote' as const, mySeat: 0, slots: [0, 0, 0, 0], ownership: {} };
  banc.setState({ ...initialFields(), party: [H1, H2], mode: 'battle', battle, scene: emptyScene('scene-test', 8, 8), net });
  de('h1').fate = 1;
  advanceTurn(banc.getState, banc.setState);
  de('h1').wounds.current = 0;
  de('h1').loseNextMovement = true; de('h2').loseNextMovement = true;
  if (g().pendingRoundStart) g().fenetreValider('debutDuRound');
}

/** La défense ratée à 96 ; `des` = les d100 qui suivent. */
function defenseRatee(des: number[]): void {
  g().jetLancer('defense');
  g().jetImposerLeResultat('defense', 96);
  imposerLesD100(...des);
  g().jetValider('defense');
}

describe('#4860 — le Destin ouvert par un Tir rapide de l’IA suspend la boucle des tireurs, qui reprend après le choix', () => {
  for (const mode of ['local', 'hote'] as const) for (const tireurs of [2, 1] as const) for (const issue of ['survivre', 'eviter', 'accepter'] as const) {
    it(`${mode}, ${tireurs} tireur(s), « ${issue} » : chaque tireur tire une fois, puis le Round s’ouvre`, () => {
      tirRapideSurUnHerosADestin(mode, tireurs);
      expect(g().pendingDefense, 'chemin : E1 tire le premier sur H1').toMatchObject({ attackerId: 'e1', defenderId: 'h1' });
      defenseRatee(Array(60).fill(100));
      expect(avanceEtapeCascade(g)).toBe('deviation');
      expect(g().pendingFateSave, 'chemin : le Critique létal suspendu au Destin').toMatchObject({ heroId: 'h1', source: 'hit' });
      expect(tirsDe('e2'), 'la boucle attend le Destin').toBe(0);
      g().fenetreChoisir('destin', 'issue', issue);
      expect(avanceEtapeCascade(g)).toBe('critique');
      if (tireurs === 2) {
        expect(g().pendingDefense, 'la boucle reprend : E2 tire sur H2').toMatchObject({ attackerId: 'e2', defenderId: 'h2' });
        defenseRatee(Array(60).fill(50));
        draineCascade(g);
      }
      expect(g().pendingDefense).toBeNull();
      expect(g().pendingFateSave).toBeNull();
      expect([tirsDe('e1'), tirsDe('e2')], 'chaque tireur, une fois').toEqual([1, tireurs === 2 ? 1 : 0]);
      const b = g().battle!;
      expect(b.over).toBeNull();
      expect(b.round).toBe(2);
      expect(b.tirsRapidesSuspendus).toBeUndefined();
      const actif = issue === 'eviter' ? 'h1' : 'h2';
      expect(activeCombatant(b)?.id, 'le Round ouvert sur le premier combattant en action').toBe(actif);
      const perteDuMouvement = b.log.filter((l) => l.actorId === actif && l.text === t('cf.perdLeMouvement', { name: nomEnVue(g(), actif)! })).length;
      expect([perteDuMouvement, b.movementUsed > 0], 'le Round s’ouvre une fois : son dû pris, jamais remis à zéro').toEqual([1, true]);
    });
  }

  for (const mode of ['local', 'hote'] as const) for (const tireurs of [2, 1] as const) {
    it(`${mode}, ${tireurs} tireur(s), séquence du coup close avant le Destin : la boucle reprend au choix, le Round s’ouvre une fois`, () => {
      tirRapideSurUnHerosADestin(mode, tireurs);
      expect(g().pendingDefense, 'chemin : E1 tire le premier sur H1').toMatchObject({ attackerId: 'e1', defenderId: 'h1' });
      defenseRatee(Array(60).fill(100));
      expect(avanceEtapeCascade(g)).toBe('deviation');
      for (let n = 0; g().pendingCascade && n < 5; n++) avanceEtapeCascade(g);
      expect(g().pendingCascade, 'chemin : la séquence du coup close').toBeNull();
      expect(g().pendingFateSave, 'chemin : le Destin encore ouvert').toMatchObject({ heroId: 'h1', source: 'hit' });
      expect(g().battle!.tirsRapidesSuspendus, 'chemin : la boucle parquée sous le Destin').toEqual(['e1']);
      expect(tirsDe('e2'), 'la boucle attend le Destin').toBe(0);
      g().fenetreChoisir('destin', 'issue', 'survivre');
      if (tireurs === 2) {
        expect(g().pendingDefense, 'la boucle reprend : E2 tire sur H2').toMatchObject({ attackerId: 'e2', defenderId: 'h2' });
        defenseRatee(Array(60).fill(50));
        draineCascade(g);
      }
      expect(g().pendingDefense).toBeNull();
      expect(g().pendingFateSave).toBeNull();
      expect([tirsDe('e1'), tirsDe('e2')], 'chaque tireur, une fois').toEqual([1, tireurs === 2 ? 1 : 0]);
      const b = g().battle!;
      expect(b.over).toBeNull();
      expect(b.round).toBe(2);
      expect(b.tirsRapidesSuspendus).toBeUndefined();
      expect(b.turn, 'le tour quitte E1').toBe(1);
      expect(activeCombatant(b)?.id, 'le Round ouvert sur le premier combattant en action').toBe('h2');
      const perteDuMouvement = b.log.filter((l) => l.actorId === 'h2' && l.text === t('cf.perdLeMouvement', { name: nomEnVue(g(), 'h2')! })).length;
      expect([perteDuMouvement, b.movementUsed > 0], 'le Round s’ouvre une fois : son dû pris, jamais remis à zéro').toEqual([1, true]);
    });
  }
});

/** Le duel à deux héros, le tour à H (tenu par le joueur). */
function duelAuTourDeH(): { H: Combatant; E: Combatant } {
  const T2 = createHero({ idNeuf: idsDeTest, speciesId: 'humains-reiklander', careerId: 'soldat', label: 'T', seed: 2 });
  const { H, E, poser } = ouvrirLeDuel(banc, { scene: testScene(), party: [heroDuDuel(), T2] }, 'enc-mutants', 'heros');
  poser(H, H.pos!);
  return { H, E };
}

describe('#4860 — l’acteur actif tenu par un joueur, mis hors de combat par le coup : son tour ne reste pas figé après le Destin', () => {
  it('Destin choisi pendant la séquence du coup (deux Critiques, LDB 18 l.53), « Meurs un autre jour » : à sa clôture, le tour reste au joueur, qui le finit', () => {
    const { H, E } = duelAuTourDeH();
    H.wounds.current = 1;
    frapper(banc, E, H, [11, 90, 1], MELEE);
    expect(avanceEtapeCascade(g, poseSurDeNonTombe(53), () => 'subir')).toBe('deviation');
    expect(avanceEtapeCascade(g, poseSurDeNonTombe(100), () => 'subir')).toBe('deviation');
    expect(g().pendingFateSave, 'chemin : la mort suspendue au Destin').toMatchObject({ heroId: H.id, source: 'hit' });
    expect(g().pendingCascade, 'chemin : la séquence du coup encore ouverte').not.toBeNull();
    g().fenetreChoisir('destin', 'issue', 'survivre');
    draineCascade(g);
    expect(isOutOfAction(de(H.id)), 'chemin : H hors de combat').toBe(true);
    expect(g().battle!.over).toBeNull();
    expect(g().pendingFateSave, 'aucune modale en attente : le combat ne se fige pas').toBeNull();
    expect(g().pendingCascade, 'la séquence du coup est close').toBeNull();
    expect(activeCombatant(g().battle!)?.id).toBe(H.id);
    g().terminerLeTour();
    expect(activeCombatant(g().battle!)?.id).not.toBe(H.id);
  });

  it('mort-auto (LDB 16 l.113) sur le héros actif, « Meurs un autre jour » (LDB 17 l.31) : le tour reste au joueur, qui le finit', () => {
    const { H, E } = duelAuTourDeH();
    setRule('combat-cible-inconsciente', 'mort-auto');
    H.wounds.current = 0;
    if (!H.conditions.some((c) => c.id === COND.inconscient)) addCondition(H, COND.inconscient);
    expect(activeCombatant(g().battle!)?.id, 'chemin : le tour est à H').toBe(H.id);
    frapper(banc, E, H, [30], MELEE);
    expect(g().pendingFateSave, 'chemin : la mort-auto suspendue au Destin').toMatchObject({ heroId: H.id, source: 'hit' });
    g().fenetreChoisir('destin', 'issue', 'survivre');
    expect(isOutOfAction(de(H.id)), 'chemin : H hors de combat').toBe(true);
    expect(g().battle!.over).toBeNull();
    expect(g().pendingFateSave, 'aucune modale en attente : le combat ne se fige pas').toBeNull();
    expect(activeCombatant(g().battle!)?.id).toBe(H.id);
    g().terminerLeTour();
    expect(activeCombatant(g().battle!)?.id).not.toBe(H.id);
  });
});
