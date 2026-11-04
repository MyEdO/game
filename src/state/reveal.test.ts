import { describe, it, expect, beforeEach } from 'vitest';
import { useGame } from './store';
import { pushReveal } from '../noyau/combatEffects';
import { poserLeLocalStorage } from '../lib/stockage.testkit';

/**
 * RÉVÉLATION = étape d'AFFICHAGE de la cascade (#942 L8), côté web : l'étape d'affichage EN VOL traverse la
 * sauvegarde du navigateur. Le contrat de la séquence se joue au banc du noyau (`src/noyau/reveal.hors-store.test.ts`).
 */
describe('révélation → étape d’affichage de cascade', () => {
  beforeEach(() => useGame.setState({ pendingCascade: null, suspendedCascades: [], battle: null }));

  it('SAVE/LOAD RÉEL (saveGame → loadGame) avec une étape d’affichage EN VOL : la révélation traverse la save', () => {
    poserLeLocalStorage();
    pushReveal(useGame.setState, { kind: 'mutation', title: 'Mutation — Écailles', dice: 42, lines: ['a', 'b'], subjectId: 'h1', severity: 'grave' }, { autoClose: 'grave' });
    expect(useGame.getState().saveGame(1)).toBe(true);
    useGame.setState({ pendingCascade: null }); // « nouvelle partie » : l'état est écrasé avant le chargement
    expect(useGame.getState().loadGame(1)).toBe(true); // chemin RÉEL : lireLaSauvegarde → lireSave → applyLoadedSave
    const step = useGame.getState().pendingCascade!.participants[0];
    expect(step.kind).toBe('mutation');
    expect(step.reveal).toEqual({ kind: 'mutation', title: 'Mutation — Écailles', dice: 42, lines: ['a', 'b'], subjectId: 'h1', severity: 'grave' });
    expect(step.autoCloseMs).toBe(9000); // la cadence DÉCLARÉE est de la DONNÉE : elle survit au JSON
    useGame.getState().cascadeNext(); // …et la séquence restaurée se dénoue normalement
    expect(useGame.getState().pendingCascade).toBeNull();
  });
});
