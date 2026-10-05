// @vitest-environment jsdom
/**
 * Un sélecteur reçoit le NŒUD de son champ (#1988) : la sous-liste que déclare la feuille `idDe` du
 * schéma se lit sur ce nœud (`refusDuNoeud`), jamais une fermeture `filter` du registre `REF_FIELD`
 * qui la redéclarerait. Monté comme au Codex (`CodexEdit.tsx`, `noeud={f.noeud}`).
 */
import { describe, it, expect } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { RefField, refFieldCfg, refusDuNoeud, type RefFieldCfg } from './RefField';
import { declarationDeFeuilleDId, idsDeLaSousListe } from '../../data/schemas/grammaire/ref';
import { DATASET_FICHIER_DERIVE } from '../../data/schemas/exposition-derivee';
import { noeudObjet, schemaForFile } from '../../data/schemas/validate';
import { enfantsDe, ouverts } from '../../data/schemas/grammaire/descente';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

/** Chaque champ `(dataset, champ)` dont REF_FIELD porte un sélecteur de dataset ET dont la feuille est restreinte. */
const CHAMPS_RESTREINTS = Object.entries(DATASET_FICHIER_DERIVE).flatMap(([ds, fichier]) => {
  const entree = noeudObjet(schemaForFile(fichier));
  return entree === undefined
    ? []
    : enfantsDe(entree).flatMap(({ cle, noeud }) => {
        const cfg = cle === undefined ? undefined : refFieldCfg(ds, cle);
        const feuille = ouverts([noeud]).map(declarationDeFeuilleDId).find((d) => d !== undefined);
        return cfg && 'ds' in cfg && refusDuNoeud(noeud) && feuille?.sousListe !== undefined
          ? [[`${ds}.${cle}`, cfg, noeud, idsDeLaSousListe(feuille.type, feuille.sousListe)] as const]
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

describe('REF_FIELD — la sous-liste du schéma se lit sur le nœud du champ', () => {
  it('témoin : les champs restreints du Codex sont trouvés (Terrains › Matière, Bâtiments › Couverture)', () => {
    expect(CHAMPS_RESTREINTS.map(([nom]) => nom)).toEqual(expect.arrayContaining(['terrains.matiere', 'buildings.roofMaterial']));
  });

  it.each(CHAMPS_RESTREINTS)('%s : aucune fermeture `filter`, options = ids admis par la feuille au registre', (_nom, cfg, noeud, admis) => {
    expect('filter' in cfg && cfg.filter !== undefined).toBe(false);
    expect(options(cfg, noeud).sort()).toEqual([...admis].sort());
  });
});
