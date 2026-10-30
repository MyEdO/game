import { describe, it, expect, beforeEach } from 'vitest';
import { ouvrirLeBanc, type Banc } from '../banc.testkit';
import { scenario } from '../../scenes/test-scenarios/22-dome';
import { advanceTurn, resolveRoundBoundary } from '../combatFlow';
import { startCascade } from '../cascade';
import { revealToStep } from '../revealStep';
import { addCondition, hasCondition, COND } from '../../engine/conditions';
import type { Combatant } from '../../engine/types';

let banc: Banc;
beforeEach(() => { banc = ouvrirLeBanc(); });

const scenarioConstruit = scenario.construire();

/**
 * #2916 — chaque franchissement de Round ouvre le Round suivant une fois et une seule (pause de début de
 * Round `LDB 17 l.25`, Tir rapide `LDB 11 l.97-103`, remise du tour), quelles que soient les fenêtres que
 * la fin de Round a ouvertes. Fixture « Dôme sans sort » : la sorcière saigne (`LDB 16 l.105`), sa ligne
 * d'entretien de fin de Round ouvre une révélation ; le tireur gobelin reçoit Tir rapide à la mise en place.
 */
describe('Ouverture du Round après une révélation d’entretien (#2916)', () => {
  /** Combat du Dôme ouvert, au DERNIER tour du Round 1, l'Action et le Mouvement de l'actif déjà dépensés. */
  function dernierTourSaigne(enTete?: (b: Combatant[]) => string): { sorciere: Combatant } {
    banc.setState({ party: scenario.construire().party });
    banc.getState().startScene(scenarioConstruit.scene);
    banc.getState().startCombat('enc-dome');
    banc.getState().confirmRoundStart();
    const b = banc.getState().battle!;
    const sorciere = b.combatants.find((c) => c.id === 'sorciere')!;
    addCondition(sorciere, COND.hemorragique, 1); // ligne d'entretien de fin de Round → révélation héros
    const tireur = b.combatants.find((c) => c.label === 'Tireur gobelin')!;
    tireur.talents = [...(tireur.talents ?? []), { talentId: 'tir-rapide', times: 1 }]; // LDB 11 l.97-103
    for (const c of b.combatants) { c.loseNextAction = false; c.loseNextMovement = false; } // le Tir rapide du Round 1 a été payé à son tour
    if (enTete) {
      const id = enTete(b.combatants);
      b.baseOrder = [id, ...(b.baseOrder ?? b.order).filter((x) => x !== id)];
    }
    banc.setState({ battle: { ...b, turn: b.order.length - 1, acted: true, movementUsed: 4 }, pendingCascade: null });
    return { sorciere };
  }

  it('héros en tête : révélation close → pause de Round, Tir rapide, tour remis', () => {
    dernierTourSaigne((cs) => cs.find((c) => c.id === 'protegee')!.id);
    advanceTurn(banc.getState, banc.setState);
    const revelation = banc.getState().pendingCascade!;
    expect(revelation.participants.some((s) => s.kind === 'round'), 'la ligne d’entretien du héros ouvre sa révélation').toBe(true);
    expect(banc.getState().pendingRoundStart, 'le Round attend la fermeture de la révélation').toBeNull();

    banc.getState().cascadeNext();
    expect(banc.getState().pendingCascade).toBeNull();
    expect(banc.getState().pendingRoundStart, 'la fermeture ouvre la pause de début de Round').toEqual({ round: 2 });

    const avant = banc.getState().battle!.log.length;
    banc.getState().confirmRoundStart();
    banc.reprendreLesEnAttente();
    const b = banc.getState().battle!;
    expect(b.log.slice(avant).some((e) => /déclenche Tir rapide/.test(e.text)), 'les hooks de début de Round jouent').toBe(true);
    // Le tir d'interruption a pu ouvrir sa défense : on lit le tour posé, pas l'issue du tir.
    expect(b.order[b.turn]).toBe('protegee');
    expect(b.acted).toBe(false);
    expect(b.movementUsed).toBe(0);
  });

  it('saignement à 0 PB pendant l’entretien : Inconsciente, et la chute se lit au journal comme sur le coup', () => {
    const { sorciere } = dernierTourSaigne();
    sorciere.wounds.current = 1;
    advanceTurn(banc.getState, banc.setState);
    const b = banc.getState().battle!;
    const s = b.combatants.find((c) => c.id === sorciere.id)!;
    expect(s.wounds.current).toBe(0);
    expect(hasCondition(s, COND.inconscient)).toBe(true);
    expect(b.log.some((e) => e.text === `${s.label} est mis hors de combat !`)).toBe(true);
  });

  it('séquence en vol d’un autre `purpose` au franchissement : sa fermeture ouvre le Round, une fois', () => {
    dernierTourSaigne();
    const b = banc.getState().battle!;
    banc.setState({ battle: { ...b, turn: 0, round: 2 } });
    startCascade(banc.getState, banc.setState, {
      title: 'Hors combat', purpose: 'test',
      steps: [revealToStep({ kind: 'round', title: 'Fixture', lines: ['ligne'], severity: 'minor' }, 0)],
    });
    resolveRoundBoundary(banc.getState, banc.setState);
    expect(banc.getState().pendingRoundStart).toBeNull();
    expect(banc.getState().pendingCascade?.roundBoundary, 'la séquence en vol porte la borne du Round').toBe(true);
    banc.getState().cascadeNext();
    expect(banc.getState().pendingCascade).toBeNull();
    expect(banc.getState().pendingRoundStart).toEqual({ round: 2 });
  });

  it('IA en tête : après la pause, elle joue son tour', () => {
    dernierTourSaigne((cs) => cs.find((c) => c.kind === 'enemy' && !c.dead)!.id);
    advanceTurn(banc.getState, banc.setState);
    banc.getState().cascadeNext();
    expect(banc.getState().pendingRoundStart).toEqual({ round: 2 });
    banc.getState().confirmRoundStart();
    const cle = () => `2:0:${banc.getState().battle!.order[0]}`;
    for (let i = 0; i < 20 && banc.getState().battle!.tourIA?.cle !== cle(); i++) banc.reprendreLesEnAttente();
    expect(banc.getState().battle!.tourIA?.cle, 'le tour de l’IA en tête est décidé : elle a joué').toBe(cle());
  });
});
