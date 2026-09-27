import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useGame } from './store';
import { avanceEtapeCascade } from './cascadeTestKit';
import { applyAttackResult } from './combatFlow';
import { combatAdvanceBlocked } from './combatGate';
import { createHero } from '../engine/character';
import { testScene } from '../scenes/test-fixture';
import type { AttackResult } from '../engine/combat';

// Coup Critique / Assommante en révélation + gel de l'IA.
describe('Conséquences d’attaque en révélation (store)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllTimers();
    useGame.setState({ pendingCascade: null, battle: null });
  });
  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  function battle() {
    const hero = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'H', seed: 1 });
    useGame.setState({ party: [hero] });
    useGame.getState().startScene(testScene);
    useGame.getState().startCombat('enc-mutants');
    useGame.getState().confirmRoundStart();
    vi.clearAllTimers();
    const b = useGame.getState().battle!;
    return { b, hero: b.combatants.find((c) => c.kind === 'hero')!, enemy: b.combatants.find((c) => c.kind === 'enemy')! };
  }

  it('un Coup Critique ouvre une séquence de conséquence « Coup Critique » (panneau riche)', () => {
    useGame.getState().seedRng(2);
    const { hero, enemy } = battle();
    useGame.setState({ pendingCascade: null });
    const res: AttackResult = {
      hit: true, attackerRoll: 33, netSL: 2, critical: true, advantageTo: 'attacker',
      defenderDefeated: false, woundsLost: 3, location: 'corps', log: 'touche !',
    } as AttackResult;
    applyAttackResult(useGame.getState, useGame.setState, hero, enemy, hero.weapons[0], res);
    // La Blessure critique se tire d'abord (étape unique, #1426) — aucun siège ne tenant l'ennemi, le
    // socle l'a résolue d'office : on la franchit, et la RÉVÉLATION riche s'appende derrière.
    avanceEtapeCascade(useGame.getState);
    const c = useGame.getState().pendingCascade;
    expect(c?.purpose).toBe('combat');
    const crit = c?.participants.find((s) => s.kind === 'critical');
    expect(crit).toBeTruthy();
    expect(crit!.reveal?.kind).toBe('critical'); // charge riche → panneau CriticalBody inline
    expect(typeof crit!.reveal?.dice).toBe('number');
  });

  it('l’avancement de tour est GELÉ tant qu’une révélation est à l’écran, et REPART à son acquittement', () => {
    const { b, enemy } = battle();
    const turn = b.order.indexOf(enemy.id);
    // #942 L8 : la révélation est une ÉTAPE d'affichage de la séquence de combat — c'est `pendingCascade`
    // (terme UNIQUE de `combatAdvanceBlocked`) qui gèle l'avancement, plus une file parallèle.
    useGame.setState({
      battle: { ...b, turn, acted: true },
      pendingCascade: {
        title: 'Coup Critique', purpose: 'combat', cursor: 0, log: [],
        participants: [{ id: 'cons-critical-0', kind: 'critical', reveal: { kind: 'critical', title: 'Coup Critique', dice: 50, lines: ['x'] } }],
      },
    });
    // La GARDE UNIQUE de reprise (`combatAdvanceBlocked`) est l'unité mesurée : c'est ELLE que la
    // séquence ouverte doit fermer (un `battleEndTurn` seul ne le prouverait pas — `combatBusy` le
    // bloquerait déjà de son côté, et le test resterait vert avec la garde débranchée).
    expect(combatAdvanceBlocked(useGame.getState())).toBe(true);
    useGame.getState().battleEndTurn(); // → advanceTurn, gelé par la séquence ouverte
    expect(useGame.getState().battle!.turn).toBe(turn); // pas avancé
    useGame.getState().cascadeNext(); // acquittement de l'étape → séquence close, l'IA reprend
    expect(useGame.getState().pendingCascade).toBeNull();
    expect(combatAdvanceBlocked(useGame.getState())).toBe(false); // la garde s'ouvre à l'acquittement
    // …et la REPRISE est mesurée pour de vrai : la clôture arme le beat de l'IA (`resumeSuspendedAI` →
    // `resumeEnemyTurn`), dont l'échéance fait AVANCER le tour. Sans ce beat, le combat resterait figé
    // sur un tour d'IA que plus personne ne joue.
    vi.advanceTimersByTime(5000);
    expect(useGame.getState().battle!.turn).not.toBe(turn);
  });

  it('une séquence `test` ouverte EN COMBAT rend AUSSI la main à l’IA à sa clôture (reprise fondée sur l’ÉTAT)', () => {
    const { b, enemy } = battle();
    const turn = b.order.indexOf(enemy.id);
    // Patron RÉEL : un Test déclenché en plein tour (`routeTriggeredTest`, `openSkillTest`) ouvre une
    // séquence de purpose `test` PENDANT le combat. Elle gèle l'avancement comme les autres…
    useGame.setState({
      battle: { ...b, turn, acted: true },
      pendingCascade: {
        title: 'Test', purpose: 'test', cursor: 0, log: [],
        participants: [{ id: 'cons-effet-0', kind: 'effet', reveal: { kind: 'effet', title: 'Conséquence', lines: ['x'] } }],
      },
    });
    expect(combatAdvanceBlocked(useGame.getState())).toBe(true);
    useGame.getState().cascadeNext();
    expect(useGame.getState().pendingCascade).toBeNull();
    // …et sa clôture doit rendre la main : le `purpose` de la séquence n'a jamais décrit l'état du combat.
    vi.advanceTimersByTime(5000);
    expect(useGame.getState().battle!.turn).not.toBe(turn);
  });

  // Déviation Critique FOLDÉE (P3a) : le Critique pré-tiré + le choix Dévier/Subir = une ÉTAPE de la
  // séquence (panneau riche). « Subir » applique CE Critique ; « Dévier » l'ignore (−1 PA).
  it('Déviation Critique → étape de CHOIX inline : « Subir » applique le Critique, « Dévier » l’ignore', () => {
    useGame.getState().seedRng(2);
    const { hero, enemy } = battle();
    const heroNow = () => useGame.getState().battle!.combatants.find((c) => c.kind === 'hero')!;
    hero.armour.corps = 3; // PA au corps → la déviation est possible
    const res = {
      hit: true, attackerRoll: 33, netSL: 2, critical: true, advantageTo: 'attacker',
      defenderDefeated: false, woundsLost: 3, location: 'corps', critLocation: 'corps', log: 'touche !',
    } as AttackResult;

    // (1) Le Critique sur le héros armé SUSPEND, en posant une ÉTAPE DE CHOIX (Critique pré-tiré + options).
    useGame.setState({ pendingCascade: null });
    const suspended = applyAttackResult(useGame.getState, useGame.setState, enemy, hero, enemy.weapons[0], res);
    expect(suspended).toBe(true);
    const devId = useGame.getState().pendingCascade!.participants.find((s) => s.kind === 'deviation')!.id;
    useGame.getState().cascadeTableRoll(devId); // le dé de sévérité tombe DANS la MÊME fenêtre (#1426)
    const dev = useGame.getState().pendingCascade?.participants.find((s) => s.kind === 'deviation');
    expect(dev?.reveal?.kind).toBe('critical'); // panneau riche porté par l'étape, sous la ligne de dé

    // (2) « Subir » applique CE Critique.
    const cwBefore = heroNow().criticalWounds ?? 0;
    useGame.getState().cascadeChoose(devId, 'subir');
    useGame.getState().cascadeNext();
    expect(heroNow().criticalWounds ?? 0).toBeGreaterThan(cwBefore);

    // (3) « Dévier » ignore le Critique → aucune Blessure critique.
    const h = heroNow();
    h.wounds = { current: 20, max: 20, base: 20 } as never;
    h.criticalWounds = 0;
    useGame.setState({ pendingCascade: null });
    applyAttackResult(useGame.getState, useGame.setState, enemy, hero, enemy.weapons[0], res);
    const devId2 = useGame.getState().pendingCascade!.participants.find((s) => s.kind === 'deviation')!.id;
    useGame.getState().cascadeTableRoll(devId2);
    useGame.getState().cascadeChoose(devId2, 'devier');
    useGame.getState().cascadeNext();
    expect(heroNow().criticalWounds ?? 0).toBe(0); // pas de Blessure critique appliquée
  });
});
