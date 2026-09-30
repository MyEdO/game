/**
 * Effect `document { documentId }` (#679) — `apply` résout l'entrée au registre `narratif.documents` de
 * la campagne chargée (`documentById`) et pose la surface EXISTANTE `store.document` (titre, prose) ; un
 * id inconnu n'ouvre rien et le dit en console (patron `revealClue`).
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useGame } from './store';
import { applyEffects } from './combatFlow';
import { emptyScene, type Scene } from './scene';
import { emptyNarratif, type NarratifBlock } from './campaignNarratif';

const narratif: NarratifBlock = {
  ...emptyNarratif(),
  documents: [{ id: 'doc-affiche', titre: 'Affiche du Bœuf rouge', prose: 'Recherché : **Kastor Lieberung**.' }],
};

function fixtureScene(): Scene {
  const s = emptyScene(4, 4);
  s.id = 'scene-doc';
  s.entities.push({ id: 'hs', kind: 'heroStart', pos: { x: 0, y: 0 } });
  return s;
}

beforeEach(() => {
  useGame.setState({ campaignNarratif: null, party: [], scene: null, document: null });
  useGame.getState().loadProject([fixtureScene()], 'scene-doc', undefined, narratif);
});

describe('Effect `document` — le registre narratif atteint la modale', () => {
  it('id CONNU : `store.document` reçoit le titre et la prose du registre', () => {
    applyEffects(useGame.getState, useGame.setState, [{ type: 'document', documentId: 'doc-affiche' }]);
    expect(useGame.getState().document).toEqual({ title: 'Affiche du Bœuf rouge', text: 'Recherché : **Kastor Lieberung**.' });
  });

  it('document SOURCÉ : `store.document` porte aussi sa source (le badge de la modale la lit)', () => {
    useGame.getState().loadProject([fixtureScene()], 'scene-doc', undefined, {
      ...narratif,
      documents: [{ ...narratif.documents[0], source: { book: 'livre-de-base', page: 90 } }],
    });
    applyEffects(useGame.getState, useGame.setState, [{ type: 'document', documentId: 'doc-affiche' }]);
    expect(useGame.getState().document?.source).toEqual({ book: 'livre-de-base', page: 90 });
  });

  it('id INCONNU : aucune modale, un avertissement nommé', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    try {
      applyEffects(useGame.getState, useGame.setState, [{ type: 'document', documentId: 'doc-fantome' }]);
      expect(useGame.getState().document).toBeNull();
      expect(warn).toHaveBeenCalledWith('document : document inconnu « doc-fantome ».');
    } finally {
      warn.mockRestore();
    }
  });
});
