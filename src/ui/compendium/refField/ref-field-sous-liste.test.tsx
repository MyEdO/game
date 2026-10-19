// @vitest-environment jsdom
/**
 * Un sélecteur reçoit le NŒUD de son champ (#1988) : la sous-liste que déclare la feuille `idDe` du
 * schéma se lit sur ce nœud (`refusDuNoeud`), jamais une fermeture `filter` qui la redéclarerait.
 * Les champs sont trouvés par la route du Codex (`Field` de `CodexEdit.tsx` : `kind === 'text'` puis
 * `cfgDeLaFeuille(field.noeud)`), sur les champs que `inferFields` y infère.
 */
import { describe, it, expect } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { RefField, cfgDeLaFeuille, refusDuNoeud, type RefFieldCfg } from './RefField';
import { inferFields } from '../editFields';
import { declarationDeFeuilleDId, idsDeLaSousListe } from '../../../data/schemas/grammaire/ref';
import { DATASET_FICHIER_DERIVE, DATASET_SUITE_DERIVE } from '../../../data/schemas/exposition-derivee';
import { datasetArray, type DatasetKey } from '../../../data/overrides';
import { metaPourFichier, noeudObjet, schemaForFile } from '../../../data/schemas/validate';
import { ouverts } from '../../../data/schemas/grammaire/descente';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

/** Chaque champ `(dataset, champ)` que le Codex route vers un sélecteur de feuille `idDe` RESTREINTE. */
const CHAMPS_RESTREINTS = Object.entries(DATASET_FICHIER_DERIVE)
  .filter(([ds]) => DATASET_SUITE_DERIVE[ds] === '')
  .flatMap(([ds, fichier]) => {
    const noeud = noeudObjet(schemaForFile(fichier));
    const entrees = datasetArray(ds as DatasetKey) as Record<string, unknown>[];
    return noeud === undefined || !Array.isArray(entrees)
      ? []
      : inferFields(entrees, { meta: metaPourFichier(fichier), noeud }).flatMap((f) => {
          const cfg = f.kind === 'text' ? cfgDeLaFeuille(f.noeud) : undefined;
          const feuille = ouverts([f.noeud]).map(declarationDeFeuilleDId).find((d) => d !== undefined);
          return cfg && refusDuNoeud(f.noeud) && feuille?.sousListe !== undefined
            ? [[`${ds}.${f.key}`, cfg, f.noeud, idsDeLaSousListe(feuille.type, feuille.sousListe)] as const]
            : [];
        });
  });

/** Les valeurs d'option d'un `RefField` monté sur ce nœud (hors choix vide). */
function options(cfg: RefFieldCfg, noeud: unknown): string[] {
  const host = document.createElement('div');
  document.body.appendChild(host);
  const root = createRoot(host);
  act(() => { root.render(<RefField cfg={cfg} noeud={noeud} value="" nullable onChange={() => {}} />); });
  const valeurs = [...host.querySelectorAll('select option')].map((o) => (o as HTMLOptionElement).value).filter((v) => v !== '');
  act(() => { root.unmount(); });
  host.remove();
  return valeurs;
}

describe('sélecteur de feuille `idDe` — la sous-liste du schéma se lit sur le nœud du champ', () => {
  it('témoin : les champs restreints du Codex sont trouvés (Terrains › Matière, Bâtiments › Couverture)', () => {
    expect(CHAMPS_RESTREINTS.map(([nom]) => nom)).toEqual(expect.arrayContaining(['terrains.matiere', 'buildings.roofMaterial']));
  });

  it.each(CHAMPS_RESTREINTS)('%s : aucune fermeture `filter`, options = ids admis par la feuille au registre', (_nom, cfg, noeud, admis) => {
    expect('filter' in cfg && cfg.filter !== undefined).toBe(false);
    expect(options(cfg, noeud).sort()).toEqual([...admis].sort());
  });
});
