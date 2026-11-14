/**
 * Effect `document { documentId }` (#679) — `apply` résout l'entrée au registre `narratif.documents` de
 * la campagne chargée (`documentDuNarratif`) et pose la surface EXISTANTE `document` de l'état (titre, prose, origine) ; un
 * id inconnu n'ouvre rien et le dit en console (patron `revealClue`). Le document SUSPEND la suite jusqu'à
 * sa fermeture (`fenetreFermer('document')`, EDO 02 l.89-95, #686).
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ouvrirLeBanc, type Banc } from './banc.testkit';
import { runFlow, applyEffects } from './combatEffects';
import type { Flow } from '../data/schemas/defs-scenes/effets';
import { emptyScene, type Scene } from './monde/scene';
import { emptyNarratif } from './monde/campaignNarratif';
import type { NarratifBlock } from '../data/schemas/defs-scenes/narratif';

let banc: Banc;
beforeEach(() => { banc = ouvrirLeBanc(); });

const narratif: NarratifBlock = {
  ...emptyNarratif(),
  documents: [
    { id: 'doc-affiche', titre: 'Affiche du Bœuf rouge', prose: 'Recherché : **Kastor Lieberung**.' },
    { id: 'doc-heritage', titre: 'Document 3 : L’héritage', prose: 'Cher Herr Lieberung,' },
    { id: 'doc-affidavit', titre: 'Document 4 : L’affidavit', prose: 'Kastor Aloysius Lieberung.' },
  ],
};
const get = () => banc.getState();
const remettre = (documentId: string): Flow => ({ kind: 'effet', effet: { type: 'document', documentId } });

function fixtureScene(): Scene {
  const s = emptyScene('scene-test', 4, 4);
  s.id = 'scene-doc';
  s.entities.push({ id: 'hs', kind: 'heroStart', pos: { x: 0, y: 0 } });
  return s;
}

beforeEach(() => {
  banc.getState().chargerLeProjet({ scenes: [fixtureScene()], entryId: 'scene-doc', narratif, projet: null });
});

describe('Effect `document` — le registre narratif atteint la modale', () => {
  it('id CONNU : `store.document` reçoit le titre et la prose du registre, et l’id de l’entrée qui les porte', () => {
    applyEffects(banc.getState, banc.setState, [{ type: 'document', documentId: 'doc-affiche' }]);
    expect(banc.getState().document).toMatchObject({ title: 'Affiche du Bœuf rouge', text: 'Recherché : **Kastor Lieberung**.', documentId: 'doc-affiche' });
  });

  it('document SOURCÉ : `store.document` porte aussi sa source (le badge de la modale la lit)', () => {
    banc.getState().chargerLeProjet({ scenes: [fixtureScene()], entryId: 'scene-doc', narratif: {
      ...narratif,
      documents: [{ ...narratif.documents[0], source: { book: 'livre-de-base', page: 90 } }],
    }, projet: null });
    applyEffects(banc.getState, banc.setState, [{ type: 'document', documentId: 'doc-affiche' }]);
    expect(banc.getState().document?.source).toEqual({ book: 'livre-de-base', page: 90 });
  });

  it('id INCONNU : aucune modale, un avertissement nommé', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    try {
      applyEffects(banc.getState, banc.setState, [{ type: 'document', documentId: 'doc-fantome' }]);
      expect(banc.getState().document).toBeNull();
      expect(warn).toHaveBeenCalledWith('document : document inconnu « doc-fantome ».');
    } finally {
      warn.mockRestore();
    }
  });
});

describe('Effect `document` — chaque document se lit avant la suite', () => {
  it('`seq [3, 4]` : le 3 s’affiche ; le 4 après sa fermeture ; la suite après le 4', () => {
    runFlow(get, banc.setState, { kind: 'sequence', etapes: [remettre('doc-heritage'), remettre('doc-affidavit'), { kind: 'effet', effet: { type: 'setFlag', flag: 'lus' } }] });
    expect(get().document?.title).toBe('Document 3 : L’héritage');
    get().fenetreFermer('document');
    expect(get().document?.title).toBe('Document 4 : L’affidavit');
    expect(get().flags.lus).toBeUndefined();
    get().fenetreFermer('document');
    expect(get().document).toBeNull();
    expect(get().flags.lus).toBe(true);
  });

  it('`applyEffects` : le reste du LOT attend la fermeture', () => {
    applyEffects(get, banc.setState, [{ type: 'document', documentId: 'doc-heritage' }, { type: 'setFlag', flag: 'reste-du-lot' }]);
    expect(get().flags['reste-du-lot']).toBeUndefined();
    get().fenetreFermer('document');
    expect(get().flags['reste-du-lot']).toBe(true);
  });

  it('chez l’invité, fermer ne rejoue rien : l’hôte tient le Flow', () => {
    runFlow(get, banc.setState, { kind: 'sequence', etapes: [remettre('doc-heritage'), { kind: 'effet', effet: { type: 'setFlag', flag: 'suite' } }] });
    banc.setState({ net: { ...get().net, mode: 'invite' } });
    get().fenetreFermer('document');
    expect(get().document?.title).toBe('Document 3 : L’héritage');
    expect(get().flags.suite).toBeUndefined();
  });
});
