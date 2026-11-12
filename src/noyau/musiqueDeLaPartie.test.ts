/**
 * LA MUSIQUE DE LA PARTIE (#3825, `musiqueDeLaPartie.ts`) : la scène impose sa piste ou le silence, sinon le contexte
 * (combat, intérieur, exploration) ; une sélection rend ses pistes du registre sous sa clé.
 */
import { describe, it, expect } from 'vitest';
import { musicDefsFor } from '../data/sons/musique';
import { musiqueDeLaPartie, musiqueDeLaSelection, selectionDeLaMusique, type EtatDeLaMusique } from './musiqueDeLaPartie';

const at = (over: Partial<EtatDeLaMusique>): EtatDeLaMusique => ({ mode: 'exploration', battle: null, scene: { ambiance: 'exterieur' }, ...over });

describe('la musique de la partie', () => {
  it('le contexte : combat, intérieur, exploration', () => {
    expect(selectionDeLaMusique(at({ mode: 'battle', battle: {} }))).toEqual({ ctx: 'combat' });
    expect(selectionDeLaMusique(at({ scene: { ambiance: 'interieur' } }))).toEqual({ ctx: 'interieur' });
    expect(selectionDeLaMusique(at({}))).toEqual({ ctx: 'exploration' });
    expect(selectionDeLaMusique(at({ scene: null }))).toEqual({ ctx: 'exploration' });
  });

  it('la scène impose sa piste d’ambiance ou de combat, ou le silence, chacune indépendante', () => {
    expect(selectionDeLaMusique(at({ scene: { ambiance: 'exterieur', music: { ambient: 'musique-taverne' } } }))).toEqual({ def: 'musique-taverne' });
    expect(selectionDeLaMusique(at({ mode: 'battle', battle: {}, scene: { ambiance: 'exterieur', music: { combat: 'musique-ville' } } }))).toEqual({ def: 'musique-ville' });
    const scene = { ambiance: 'exterieur' as const, music: { ambient: null } };
    expect(selectionDeLaMusique(at({ scene }))).toBe(null);
    expect(selectionDeLaMusique(at({ mode: 'battle', battle: {}, scene }))).toEqual({ ctx: 'combat' });
  });

  it('une sélection rend ses pistes sous sa clé ; le silence n’en rend aucune', () => {
    expect(musiqueDeLaPartie(at({}))).toEqual({ cle: 'ctx:exploration', pistes: musicDefsFor('exploration').map((d) => ({ id: d.id, fichiers: d.files, volume: d.volume ?? 1, canal: 'musique' })) });
    expect(musiqueDeLaSelection({ def: 'musique-taverne' })).toMatchObject({ cle: 'def:musique-taverne', pistes: [{ id: 'musique-taverne' }] });
    expect(musiqueDeLaSelection(null)).toBe(null);
  });
});
