import { idsDeTest } from '../engine/idsDeTest.testkit';
import { describe, it, expect, beforeEach } from 'vitest';
import { ouvrirLeBanc, type Banc } from './banc.testkit';
import { avanceEtapeCascade, cascadeDeTest } from './cascade.testkit';
import { applyAttackResult } from './combatFlow';
import { combatAdvanceBlocked } from './combatGate';
import { createHero } from '../engine/character';
import { testScene } from '../scenes/test-fixture';
import type { AttackResult } from '../engine/combat';
import { OPS_DIFFEREES } from './combatEffects';
import { blessuresDeBase } from '../engine/combattantDeTest.testkit';

let banc: Banc;
beforeEach(() => { banc = ouvrirLeBanc(); });

// Coup Critique / Assommante en révélation + gel de l'IA.
describe('Conséquences d’attaque en révélation (store)', () => {
  function battle() {
    const hero = createHero({ idNeuf: idsDeTest, speciesId: 'humains-reiklander', careerId: 'soldat', label: 'H', seed: 1 });
    banc.setState({ party: [hero] });
    banc.getState().lancerLaScene(testScene());
    banc.getState().lancerLeCombat('enc-mutants');
    banc.getState().fenetreValider('debutDuRound');
    banc.abandonner();
    const b = banc.getState().battle!;
    return { b, hero: b.combatants.find((c) => c.kind === 'heros')!, enemy: b.combatants.find((c) => c.kind === 'ennemi')! };
  }

  it('un Coup Critique ouvre une séquence de conséquence « Coup Critique » (panneau riche)', () => {
    banc.getState().ensemencerLeTirage(2);
    const { hero, enemy } = battle();
    enemy.important = true; // LDB 18 l.44 : hors Mort subite
    banc.setState({ pendingCascade: null });
    const res: AttackResult = {
      hit: true, attackerRoll: 33, netSL: 2, critical: true, advantageTo: 'attaquant',
      defenderDefeated: false, woundsLost: 3, location: 'corps', critLocation: 'corps', log: 'touche !',
    } as AttackResult;
    applyAttackResult(banc.getState, banc.setState, hero, enemy, hero.weapons[0], res);
    // La Blessure critique se tire d'abord (étape unique, #1426) — aucun siège ne tenant l'ennemi, le
    // socle l'a résolue d'office : on la franchit, et la RÉVÉLATION riche s'appende derrière.
    avanceEtapeCascade(banc.getState);
    const c = banc.getState().pendingCascade;
    expect(c?.purpose).toBe('combat');
    const crit = c?.participants.find((s) => s.kind === 'critique');
    expect(crit).toBeTruthy();
    expect(crit!.reveal?.kind).toBe('critique'); // charge riche → panneau CriticalBody inline
    expect(typeof crit!.reveal?.dice).toBe('number');
  });

  it('l’avancement de tour est GELÉ tant qu’une révélation est à l’écran, et REPART à son acquittement', () => {
    const { b, enemy } = battle();
    const turn = b.order.indexOf(enemy.id);
    // #942 L8 : la révélation est une ÉTAPE d'affichage de la séquence de combat — c'est `pendingCascade`
    // (terme UNIQUE de `combatAdvanceBlocked`) qui gèle l'avancement, plus une file parallèle.
    banc.setState({
      battle: { ...b, turn, acted: true },
      pendingCascade: cascadeDeTest(
        [{ id: 'cons-critique-0', kind: 'critique', reveal: { kind: 'critique', title: 'Coup Critique', dice: 50, lines: ['x'] } }],
        { title: 'Coup Critique', purpose: 'combat' },
      ),
    });
    // La GARDE UNIQUE de reprise (`combatAdvanceBlocked`) est l'unité mesurée : c'est ELLE que la
    // séquence ouverte doit fermer (un `terminerLeTour` seul ne le prouverait pas — `combatBusy` le
    // bloquerait déjà de son côté, et le test resterait vert avec la garde débranchée).
    expect(combatAdvanceBlocked(banc.getState())).toBe(true);
    banc.getState().terminerLeTour(); // → advanceTurn, gelé par la séquence ouverte
    expect(banc.getState().battle!.turn).toBe(turn); // pas avancé
    banc.getState().jetValider('cascade'); // acquittement de l'étape → séquence close, l'IA reprend
    expect(banc.getState().pendingCascade).toBeNull();
    expect(combatAdvanceBlocked(banc.getState())).toBe(false); // la garde s'ouvre à l'acquittement
    // …et la REPRISE est mesurée pour de vrai : la clôture arme le beat de l'IA (`resumeSuspendedAI` →
    // `resumeEnemyTurn`), dont l'échéance fait AVANCER le tour. Sans ce beat, le combat resterait figé
    // sur un tour d'IA que plus personne ne joue.
    banc.avancer(5000);
    expect(banc.getState().battle!.turn).not.toBe(turn);
  });

  it('une séquence `test` ouverte EN COMBAT rend AUSSI la main à l’IA à sa clôture (reprise fondée sur l’ÉTAT)', () => {
    const { b, enemy } = battle();
    const turn = b.order.indexOf(enemy.id);
    // Patron RÉEL : un Test déclenché en plein tour (`routeTriggeredTest`, `openSkillTest`) ouvre une
    // séquence de purpose `test` PENDANT le combat. Elle gèle l'avancement comme les autres…
    banc.setState({
      battle: { ...b, turn, acted: true },
      pendingCascade: cascadeDeTest(
        [{ id: 'cons-effet-0', kind: 'effet', reveal: { kind: 'effet', title: 'Conséquence', lines: ['x'] } }],
        { title: 'Test' },
      ),
    });
    expect(combatAdvanceBlocked(banc.getState())).toBe(true);
    banc.getState().jetValider('cascade');
    expect(banc.getState().pendingCascade).toBeNull();
    // …et sa clôture doit rendre la main : le `purpose` de la séquence n'a jamais décrit l'état du combat.
    banc.avancer(5000);
    expect(banc.getState().battle!.turn).not.toBe(turn);
  });

  // Déviation Critique FOLDÉE (P3a) : le Critique pré-tiré + le choix Dévier/Subir = une ÉTAPE de la
  // séquence (panneau riche). « Subir » applique CE Critique ; « Dévier » l'ignore (−1 PA).
  it('Déviation Critique → étape de CHOIX inline : « Subir » applique le Critique, « Dévier » l’ignore', () => {
    banc.getState().ensemencerLeTirage(2);
    const { hero, enemy } = battle();
    const heroNow = () => banc.getState().battle!.combatants.find((c) => c.kind === 'heros')!;
    hero.armour.corps = 3; // PA au corps → la déviation est possible
    const res = {
      hit: true, attackerRoll: 33, netSL: 2, critical: true, advantageTo: 'attaquant',
      defenderDefeated: false, woundsLost: 3, location: 'corps', critLocation: 'corps', log: 'touche !',
    } as AttackResult;

    // (1) Le Critique sur le héros armé SUSPEND, en posant une ÉTAPE DE CHOIX (Critique pré-tiré + options).
    banc.setState({ pendingCascade: null });
    const suspended = applyAttackResult(banc.getState, banc.setState, enemy, hero, enemy.weapons[0], res);
    expect(suspended).toBe(OPS_DIFFEREES);
    const devId = banc.getState().pendingCascade!.participants.find((s) => s.kind === 'deviation')!.id;
    banc.getState().jetLancer('cascadeTirage', devId); // le dé de sévérité tombe DANS la MÊME fenêtre (#1426)
    const dev = banc.getState().pendingCascade?.participants.find((s) => s.kind === 'deviation');
    expect(dev?.reveal?.kind).toBe('critique'); // panneau riche porté par l'étape, sous la ligne de dé

    // (2) « Subir » applique CE Critique.
    const cwBefore = heroNow().criticalWounds ?? 0;
    banc.getState().jetRegler('cascade', 'choix', 'subir', devId);
    banc.getState().jetValider('cascade');
    expect(heroNow().criticalWounds ?? 0).toBeGreaterThan(cwBefore);

    // (3) « Dévier » ignore le Critique → aucune Blessure critique.
    const h = heroNow();
    h.wounds = blessuresDeBase(20, 20, h);
    h.criticalWounds = 0;
    banc.setState({ pendingCascade: null });
    applyAttackResult(banc.getState, banc.setState, enemy, hero, enemy.weapons[0], res);
    const devId2 = banc.getState().pendingCascade!.participants.find((s) => s.kind === 'deviation')!.id;
    banc.getState().jetLancer('cascadeTirage', devId2);
    banc.getState().jetRegler('cascade', 'choix', 'devier', devId2);
    banc.getState().jetValider('cascade');
    expect(heroNow().criticalWounds ?? 0).toBe(0); // pas de Blessure critique appliquée
  });
});
