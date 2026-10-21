import { describe, it, expect } from 'vitest';
import { documentDuNarratif, indiceDuNarratif, objetDuNarratif, presetDuNarratif, resolvePresetCreature } from './resolveursDuNarratif';
import { emptyNarratif } from './campaignNarratif';
import type { NarratifBlock } from '../../data/schemas/defs-scenes/narratif';
import { findCreatureById } from '../../data';

/** Un narratif de projet passé en ARGUMENT (#2817) : aucun store n'est chargé ni importé ici. */
const LAME = 'campagne-lame-maudite';
const narratif: NarratifBlock = {
  ...emptyNarratif(),
  presetsPnj: [{ id: 'pnj-baron', base: 'brigand', profil: { label: 'Le Baron' } }],
  objets: [{ id: LAME, label: 'Lame maudite', categorie: 'melee', subType: null } as NarratifBlock['objets'][number]],
  documents: [{ id: 'doc-lettre', titre: 'Lettre scellée', prose: 'Une lettre.' } as NarratifBlock['documents'][number]],
  indices: [{ id: 'ind-lettre', affaireId: 'aff-x', kind: 'indice', titre: 'Lettre', stades: [{ id: 's1', prose: 'Une lettre.' }] }],
};

describe('résolveurs de la couche de campagne sur un narratif passé en argument (#767, #2817)', () => {
  it('résout le preset, l’objet, le document et l’indice du narratif donné', () => {
    expect(presetDuNarratif(narratif)('pnj-baron')?.profil?.label).toBe('Le Baron');
    expect(objetDuNarratif(narratif)(LAME)?.label).toBe('Lame maudite');
    expect(documentDuNarratif(narratif)('doc-lettre')?.titre).toBe('Lettre scellée');
    expect(indiceDuNarratif(narratif)('ind-lettre')?.titre).toBe('Lettre');
  });

  it('l’objet chaîne campagne-D’ABORD puis catalogue global ; sans narratif, seul le global répond', () => {
    expect(objetDuNarratif(narratif)('dague')?.label).toBe('Dague');
    expect(objetDuNarratif(null)(LAME)).toBeUndefined();
    expect(objetDuNarratif(null)('dague')?.label).toBe('Dague');
    expect(presetDuNarratif(undefined)('pnj-baron')).toBeUndefined();
  });

  it('`resolvePresetCreature` fusionne la base globale et le profil du preset résolu par le narratif donné', () => {
    const r = resolvePresetCreature('pnj-baron', presetDuNarratif(narratif))!;
    expect(r.creature.label).toBe('Le Baron');
    expect(r.creature.char).toEqual(findCreatureById('brigand')!.char);
    expect(resolvePresetCreature('pnj-baron', presetDuNarratif(emptyNarratif()))).toBeUndefined();
  });

  it('un narratif édité (nouvelle identité) se résout à neuf, l’ancien garde ses entrées', () => {
    const edite: NarratifBlock = { ...narratif, presetsPnj: [{ id: 'pnj-baron', base: 'brigand', profil: { label: 'Le Baron renommé' } }] };
    expect(presetDuNarratif(edite)('pnj-baron')?.profil?.label).toBe('Le Baron renommé');
    expect(presetDuNarratif(narratif)('pnj-baron')?.profil?.label).toBe('Le Baron');
  });
});
