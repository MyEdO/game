import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useGame } from '../store';
import { scenario } from '../../scenes/test-scenarios/22-dome';
import { advanceTurn, resolveRoundBoundary } from '../../noyau/combatFlow';
import { startCascade } from '../../noyau/cascade';
import { revealToStep } from '../../noyau/revealStep';
import { seedBattleRng } from '../../noyau/battleRng';
import { addCondition, hasCondition, COND } from '../../engine/conditions';
import type { Combatant } from '../../engine/types';

const scenarioConstruit = scenario.construire();

/**
 * #2916 — chaque franchissement de Round ouvre le Round suivant une fois et une seule (pause de début de
 * Round `LDB 17 l.25`, Tir rapide `LDB 11 l.97-103`, remise du tour), quelles que soient les fenêtres que
 * la fin de Round a ouvertes. Fixture « Dôme sans sort » : la sorcière saigne (`LDB 16 l.105`), sa ligne
 * d'entretien de fin de Round ouvre une révélation ; le tireur gobelin reçoit Tir rapide à la mise en place.
 */
describe('Ouverture du Round après une révélation d’entretien (#2916)', () => {
  beforeEach(() => { vi.useFakeTimers(); vi.clearAllTimers(); seedBattleRng(1); useGame.setState({ battle: null, pendingCascade: null, pendingRoundStart: null }); });
  afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); });

  /** Combat du Dôme ouvert, au DERNIER tour du Round 1, l'Action et le Mouvement de l'actif déjà dépensés. */
  function dernierTourSaigne(enTete?: (b: Combatant[]) => string): { sorciere: Combatant } {
    useGame.setState({ party: scenario.construire().party });
    useGame.getState().startScene(scenarioConstruit.scene);
    useGame.getState().startCombat('enc-dome');
    useGame.getState().confirmRoundStart();
    vi.clearAllTimers();
    const b = useGame.getState().battle!;
    const sorciere = b.combatants.find((c) => c.id === 'sorciere')!;
    addCondition(sorciere, COND.hemorragique, 1); // ligne d'entretien de fin de Round → révélation héros
    const tireur = b.combatants.find((c) => c.label === 'Tireur gobelin')!;
    tireur.talents = [...(tireur.talents ?? []), { talentId: 'tir-rapide', times: 1 }]; // LDB 11 l.97-103
    for (const c of b.combatants) { c.loseNextAction = false; c.loseNextMovement = false; } // le Tir rapide du Round 1 a été payé à son tour
    if (enTete) {
      const id = enTete(b.combatants);
      b.baseOrder = [id, ...(b.baseOrder ?? b.order).filter((x) => x !== id)];
    }
    useGame.setState({ battle: { ...b, turn: b.order.length - 1, acted: true, movementUsed: 4 }, pendingCascade: null });
    return { sorciere };
  }

  it('héros en tête : révélation close → pause de Round, Tir rapide, tour remis', () => {
    dernierTourSaigne((cs) => cs.find((c) => c.id === 'protegee')!.id);
    advanceTurn(useGame.getState, useGame.setState);
    const revelation = useGame.getState().pendingCascade!;
    expect(revelation.participants.some((s) => s.kind === 'round'), 'la ligne d’entretien du héros ouvre sa révélation').toBe(true);
    expect(useGame.getState().pendingRoundStart, 'le Round attend la fermeture de la révélation').toBeNull();

    useGame.getState().cascadeNext();
    expect(useGame.getState().pendingCascade).toBeNull();
    expect(useGame.getState().pendingRoundStart, 'la fermeture ouvre la pause de début de Round').toEqual({ round: 2 });

    const avant = useGame.getState().battle!.log.length;
    useGame.getState().confirmRoundStart();
    vi.runOnlyPendingTimers();
    const b = useGame.getState().battle!;
    expect(b.log.slice(avant).some((e) => /déclenche Tir rapide/.test(e.text)), 'les hooks de début de Round jouent').toBe(true);
    // Le tir d'interruption a pu ouvrir sa défense : on lit le tour posé, pas l'issue du tir.
    expect(b.order[b.turn]).toBe('protegee');
    expect(b.acted).toBe(false);
    expect(b.movementUsed).toBe(0);
  });

  it('saignement à 0 PB pendant l’entretien : Inconsciente, et la chute se lit au journal comme sur le coup', () => {
    const { sorciere } = dernierTourSaigne();
    sorciere.wounds.current = 1;
    advanceTurn(useGame.getState, useGame.setState);
    const b = useGame.getState().battle!;
    const s = b.combatants.find((c) => c.id === sorciere.id)!;
    expect(s.wounds.current).toBe(0);
    expect(hasCondition(s, COND.inconscient)).toBe(true);
    expect(b.log.some((e) => e.text === `${s.label} est mis hors de combat !`)).toBe(true);
  });

  it('séquence en vol d’un autre `purpose` au franchissement : sa fermeture ouvre le Round, une fois', () => {
    dernierTourSaigne();
    const b = useGame.getState().battle!;
    useGame.setState({ battle: { ...b, turn: 0, round: 2 } });
    startCascade(useGame.getState, useGame.setState, {
      title: 'Hors combat', purpose: 'test',
      steps: [revealToStep({ kind: 'round', title: 'Fixture', lines: ['ligne'], severity: 'minor' }, 0)],
    });
    resolveRoundBoundary(useGame.getState, useGame.setState);
    expect(useGame.getState().pendingRoundStart).toBeNull();
    expect(useGame.getState().pendingCascade?.roundBoundary, 'la séquence en vol porte la borne du Round').toBe(true);
    useGame.getState().cascadeNext();
    expect(useGame.getState().pendingCascade).toBeNull();
    expect(useGame.getState().pendingRoundStart).toEqual({ round: 2 });
  });

  it('IA en tête : après la pause, elle joue son tour', () => {
    dernierTourSaigne((cs) => cs.find((c) => c.kind === 'enemy' && !c.dead)!.id);
    advanceTurn(useGame.getState, useGame.setState);
    useGame.getState().cascadeNext();
    expect(useGame.getState().pendingRoundStart).toEqual({ round: 2 });
    useGame.getState().confirmRoundStart();
    for (let i = 0; i < 20 && !useGame.getState().battle!.aiTurnPlayed; i++) vi.runOnlyPendingTimers();
    const b = useGame.getState().battle!;
    expect(b.aiTurnPlayed, 'le jeton de tour de l’IA en tête est posé : elle a joué').toBe(`2:0:${b.order[0]}`);
  });
});
