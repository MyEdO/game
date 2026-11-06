/**
 * La campagne lancée d'une entrée de bibliothèque (`campagneDUneEntree`, `bibliotheque.ts`) : contrat déclaré, le
 * document passe la porte ; l'`id` et la scène d'entrée sont ceux de l'ENTRÉE, `projet` l'id du document ; une scène
 * d'entrée absente du document lève `ProjetRefuse` de cause `'entree'` (#1627). Document FABRIQUÉ.
 */
import { describe, it, expect } from 'vitest';
import { campagneDUneEntree, entreesRelues } from './bibliotheque';
import { documentDeProjet, ProjetRefuse } from '../worldMap';
import { emptyScene } from '../monde/scene';
import { emptyNarratif } from '../monde/campaignNarratif';

const doc = () => documentDeProjet(
  { type: 'projet', id: 'proj-doc', label: 'Campagne du banc', versionContenu: 3, maison: 'fixture de test' },
  [{ ...emptyScene('s1', 4, 4), label: 'Salle du banc' }],
  { narratif: emptyNarratif() },
);
const entree = (startSceneId: string) => entreesRelues([{ id: 'entree-1', label: 'Libellé d’entrée', startSceneId, savedAt: 1, published: false, project: doc() }])[0];

describe('campagneDUneEntree', () => {
  it('l’entrée nomme l’id et la scène de départ ; le document, le libellé et l’id de projet', () => {
    expect(campagneDUneEntree(entree('s1'))).toMatchObject({
      id: 'entree-1', label: 'Campagne du banc', startSceneId: 's1', worldMap: null, projet: { id: 'proj-doc' },
    });
  });

  it('une scène de départ absente du document : refus de cause « entree », sur `startSceneId`', () => {
    let refus: unknown;
    try { campagneDUneEntree(entree('absente')); } catch (e) { refus = e; }
    expect(refus).toBeInstanceOf(ProjetRefuse);
    expect((refus as ProjetRefuse).cause).toBe('entree');
    expect((refus as ProjetRefuse).fautes.map((f) => f.chemin)).toEqual([['startSceneId']]);
  });
});
