import { describe, it, expect, beforeEach } from 'vitest';
import { ouvrirLeBanc, type Banc } from './banc.testkit';
import { applyEffects } from './combatEffects';
import { resetFields } from './stateFields';
import { etatInitialDuJeu } from './etat';
import type { Effect } from '../data/schemas/defs-scenes/effets';

let banc: Banc;
beforeEach(() => { banc = ouvrirLeBanc(); });

/**
 * Objectifs courants (#238 « je fais quoi maintenant ? ») : la pile `objectives` de l'état du jeu, posée/mise à
 * jour/retirée par les Effets `setObjective`/`clearObjective`, keyée par id STABLE. Persiste entre les
 * scènes (hors `stateFields`, comme `flags`), vidée en nouvelle partie.
 */
describe('Effets setObjective / clearObjective', () => {
  beforeEach(() => banc.setState({ objectives: [], journal: [] }));

  it('pose un objectif (et l’archive au journal)', () => {
    applyEffects(banc.getState, banc.setState, [{ type: 'setObjective', id: 'a', desc: 'Trouver Gustav' }] as Effect[]);
    expect(banc.getState().objectives).toEqual([{ id: 'a', text: 'Trouver Gustav' }]);
    expect(banc.getState().journal.join('\n')).toContain('Trouver Gustav');
  });

  it('re-poser le même id MET À JOUR le texte et le remonte en tête (pas de doublon)', () => {
    applyEffects(banc.getState, banc.setState, [
      { type: 'setObjective', id: 'a', desc: 'Étape 1' },
      { type: 'setObjective', id: 'b', desc: 'Étape 2' },
      { type: 'setObjective', id: 'a', desc: 'Étape 1 bis' },
    ] as Effect[]);
    expect(banc.getState().objectives).toEqual([
      { id: 'b', text: 'Étape 2' },
      { id: 'a', text: 'Étape 1 bis' },
    ]);
  });

  it('clearObjective avec id retire cet objectif seul', () => {
    applyEffects(banc.getState, banc.setState, [
      { type: 'setObjective', id: 'a', desc: 'A' },
      { type: 'setObjective', id: 'b', desc: 'B' },
      { type: 'clearObjective', id: 'a' },
    ] as Effect[]);
    expect(banc.getState().objectives).toEqual([{ id: 'b', text: 'B' }]);
  });

  it('clearObjective sans id vide toute la pile', () => {
    applyEffects(banc.getState, banc.setState, [
      { type: 'setObjective', id: 'a', desc: 'A' },
      { type: 'setObjective', id: 'b', desc: 'B' },
      { type: 'clearObjective' },
    ] as Effect[]);
    expect(banc.getState().objectives).toEqual([]);
  });
});

describe('Objectifs — persistance', () => {
  it('champ présent dans l’état initial (donc snapshotté par la sauvegarde, zéro-maintenance)', () => {
    expect(etatInitialDuJeu().objectives).toEqual([]);
  });

  it('n’est PAS réinitialisé au changement de scène (resetOn scène = non) — un objectif traverse les scènes', () => {
    expect(resetFields('scene')).not.toHaveProperty('objectives');
    expect(resetFields('combatStart')).not.toHaveProperty('objectives');
  });
});
