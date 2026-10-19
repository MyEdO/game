import { describe, it, expect, beforeEach } from 'vitest';
import { useGame } from './store';
import { applyEffects } from './combatEffects';
import { resetFields } from './stateFields';
import type { Effect } from '../noyau/monde/scene';

/**
 * Objectifs courants (#238 « je fais quoi maintenant ? ») : la pile `store.objectives`, posée/mise à
 * jour/retirée par les Effets `setObjective`/`clearObjective`, keyée par id STABLE. Persiste entre les
 * scènes (hors `stateFields`, comme `flags`), vidée en nouvelle partie.
 */
describe('Effets setObjective / clearObjective', () => {
  beforeEach(() => useGame.setState({ objectives: [], journal: [] }));

  it('pose un objectif (et l’archive au journal)', () => {
    applyEffects(useGame.getState, useGame.setState, [{ type: 'setObjective', id: 'a', desc: 'Trouver Gustav' }] as Effect[]);
    expect(useGame.getState().objectives).toEqual([{ id: 'a', text: 'Trouver Gustav' }]);
    expect(useGame.getState().journal.join('\n')).toContain('Trouver Gustav');
  });

  it('re-poser le même id MET À JOUR le texte et le remonte en tête (pas de doublon)', () => {
    applyEffects(useGame.getState, useGame.setState, [
      { type: 'setObjective', id: 'a', desc: 'Étape 1' },
      { type: 'setObjective', id: 'b', desc: 'Étape 2' },
      { type: 'setObjective', id: 'a', desc: 'Étape 1 bis' },
    ] as Effect[]);
    expect(useGame.getState().objectives).toEqual([
      { id: 'b', text: 'Étape 2' },
      { id: 'a', text: 'Étape 1 bis' },
    ]);
  });

  it('clearObjective avec id retire cet objectif seul', () => {
    applyEffects(useGame.getState, useGame.setState, [
      { type: 'setObjective', id: 'a', desc: 'A' },
      { type: 'setObjective', id: 'b', desc: 'B' },
      { type: 'clearObjective', id: 'a' },
    ] as Effect[]);
    expect(useGame.getState().objectives).toEqual([{ id: 'b', text: 'B' }]);
  });

  it('clearObjective sans id vide toute la pile', () => {
    applyEffects(useGame.getState, useGame.setState, [
      { type: 'setObjective', id: 'a', desc: 'A' },
      { type: 'setObjective', id: 'b', desc: 'B' },
      { type: 'clearObjective' },
    ] as Effect[]);
    expect(useGame.getState().objectives).toEqual([]);
  });
});

describe('Objectifs — persistance', () => {
  it('champ présent dans l’état initial (donc snapshotté par la sauvegarde, zéro-maintenance)', () => {
    expect(useGame.getInitialState().objectives).toEqual([]);
  });

  it('n’est PAS réinitialisé au changement de scène (resetOn scène = non) — un objectif traverse les scènes', () => {
    expect(resetFields('scene')).not.toHaveProperty('objectives');
    expect(resetFields('combatStart')).not.toHaveProperty('objectives');
  });
});
