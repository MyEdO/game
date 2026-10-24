/**
 * Garde-fou E3b « tout éditable au Codex sans JSON brut » : pour CHAQUE catégorie éditable (datasets
 * tableaux ET objets — details/names), aucun champ ne doit retomber sur le repli générique
 * `kind:'json'`. Tout champ « objet / tableau d'objets » est soit couvert par un éditeur dédié
 * (`dedicatedFieldKeys`), soit d'un kind structuré (text/number/checkbox/stringList/source/recordNumber).
 *
 * Rejoue la MÊME projection que `CodexEdit` (mêmes `editableEntries` + `dedicatedFieldKeys`) → si un
 * nouveau dataset/champ introduit un `json`, ce test casse jusqu'à ce qu'il ait un éditeur structuré.
 */
import { describe, it, expect } from 'vitest';
import { CODEX } from './registry';
import { inferFields } from './editFields';
import { datasetFile, datasetObject, datasetObjectFile } from '../../data/overrides';
import { metaPourFichier, noeudDeLEntree } from '../../data/schemas/validate';
import { refFieldCfg } from './refField/RefField';
import { isEditableCategory, editableEntries, editableDataset, editableObjectDataset, dedicatedFieldKeys } from '../editor/codex/CodexEdit';

describe('Codex — aucun champ éditable n’infère kind:json (E3b)', () => {
  const editable = CODEX.filter((c) => isEditableCategory(c.key));

  it('toutes les catégories éditables sont couvertes (au moins une)', () => {
    expect(editable.length).toBeGreaterThan(0);
  });

  for (const cat of editable) {
    it(`${cat.key} : aucun champ ne retombe sur le repli json`, () => {
      // Rejoue EXACTEMENT la décision de rendu de `CodexEdit.fields.map` : un champ retombe sur
      // `<JsonField>` UNIQUEMENT s'il n'est ni couvert par un éditeur dédié (`dedicatedFieldKeys`),
      // ni par un `RefField` (`refFieldCfg`), ET que son kind inféré est 'json'.
      const handled = dedicatedFieldKeys(cat.key);
      const entrees = editableEntries(cat.key);
      const objet = editableObjectDataset(cat.key);
      const dataset = objet?.ds ?? editableDataset(cat.key)!;
      const fichier = objet ? datasetObjectFile(objet.ds) : datasetFile(editableDataset(cat.key)!);
      const racines = objet ? [datasetObject(objet.ds)] : entrees;
      const json = racines.flatMap((entree) => inferFields(entrees, {
        meta: metaPourFichier(fichier), noeud: noeudDeLEntree(dataset, entree as object),
      }).filter((f) => !handled.has(f.key) && !refFieldCfg(cat.key, f.key) && f.kind === 'json')
        .map((f) => f.key));
      expect(json, `champs ${cat.key} encore en json : ${json.join(', ')}`).toEqual([]);
    });
  }
});
