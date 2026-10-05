import { describe, it, expect } from 'vitest';
import { CODEX } from './registry';
import { useGame } from '../../state/store';
import { emptyNarratif, type NarratifBlock } from '../../state/campaignNarratif';

/**
 * Anti-spoiler STRUCTUREL de la couche de campagne (#767). Le Compendium ne lit QUE les arrays GLOBAUX
 * (`src/data`) — jamais `useGame.getState().campaignNarratif` — donc la couche narrative d'une campagne
 * (affaires/indices/presets/objets de `narratif`) lui est disjointe PAR CONSTRUCTION. Ce test le
 * VERROUILLE : même campagne chargée (slot runtime peuplé), AUCUN id narratif n'entre dans l'index
 * Compendium (`CODEX`, le registre vivant). Une régression qui câblerait `campaignNarratif` dans un
 * `build()` de catégorie ferait apparaître ces ids → ROUGE ici.
 */
describe('anti-spoiler : la couche de campagne n’entre jamais dans l’index Compendium (#767)', () => {
  const narratif: NarratifBlock = {
    ...emptyNarratif(),
    affaires: [{ id: 'aff-corbeau-noir', titre: 'Le Corbeau noir' }],
    indices: [{ id: 'ind-lettre-scellee', affaireId: 'aff-corbeau-noir', kind: 'indice', titre: 'Lettre scellée', stades: [{ id: 's1', prose: 'Une lettre.' }] }],
    presetsPnj: [{ id: 'pnj-baron-spoiler' }],
    objets: [{ id: 'obj-relique-cachee', label: 'Relique cachée', categorie: 'trapping' } as NarratifBlock['objets'][number]],
  };

  /** Tous les ids RÉELLEMENT exposés par le Compendium — chaque item de chaque catégorie du registre. */
  function exposedCodexIds(): Set<string> {
    const ids = new Set<string>();
    for (const cat of CODEX) for (const item of cat.items) ids.add(item.id);
    return ids;
  }

  it('aucun id narratif (affaires/indices/presets/objets) n’appartient à l’index Compendium, campagne chargée', () => {
    useGame.setState({ campaignNarratif: narratif });
    try {
      const exposed = exposedCodexIds();
      const narratifIds = [
        ...narratif.affaires.map((a) => a.id),
        ...narratif.indices.map((i) => i.id),
        ...narratif.presetsPnj.map((p) => p.id),
        ...narratif.objets.map((o) => o.id),
      ];
      const leaked = narratifIds.filter((id) => exposed.has(id));
      expect(leaked, `Id(s) narratif(s) exposé(s) au Compendium (fuite anti-spoiler) :\n${leaked.join('\n')}`).toEqual([]);
    } finally {
      useGame.setState({ campaignNarratif: null });
    }
  });
});
