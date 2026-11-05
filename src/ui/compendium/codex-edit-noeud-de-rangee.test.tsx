// @vitest-environment jsdom
/**
 * #2099 — l'entrée d'une catégorie éditable est une RANGÉE de son document : l'atelier lit ses nœuds
 * sur la rangée que DÉCLARE la route de son dataset (`noeudDeLEntree`), jamais sur l'enveloppe. Un
 * champ énuméré de rangée NICHÉE (`enumNomme`) se rend donc en `select` libellé, comme un champ de
 * racine.
 */
import { describe, it, expect, afterEach, beforeAll } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';

import { CodexEdit, dedicatedFieldKeys, editableDataset, editableEntries, editableObjectDataset } from '../editor/codex/CodexEdit';
import { DEFS_DE_DOCUMENT, brouillonNeuf, noeudDeLEntree, noeudObjet, schemaForFile } from '../../data/schemas/validate';
import { CATEGORY_DATASET_DERIVE, DATASET_FICHIER_DERIVE, DATASET_SUITE_DERIVE, OBJECT_CATEGORY_DERIVE } from '../../data/schemas/exposition-derivee';
import { enfantsDe } from '../../data/schemas/grammaire/descente';
import { valeursDe } from '../../data/schemas/grammaire/meta';
import { versDisque } from '../../data/schemas/grammaire/prose';
import { resetData } from '../../data/overrides';

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});

let container: HTMLDivElement | undefined;
let root: Root | undefined;

afterEach(() => {
  if (root) act(() => { root!.unmount(); });
  container?.remove();
  root = undefined;
  container = undefined;
  resetData();
});

/** Monte l'atelier sur `entree`, ou sur une entrée NEUVE (`isNew`, comme `CompendiumScreen`). */
function monter(categorie: string, entree?: { id: string }): HTMLDivElement {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => {
    root!.render(entree
      ? <CodexEdit categoryKey={categorie} id={entree.id} onClose={() => {}} />
      : <CodexEdit categoryKey={categorie} isNew onClose={() => {}} />);
  });
  return container;
}

/** TOUTES les routes d'édition : catégorie → dataset-LISTE (`liste`) ou dataset-OBJET. */
const routes = (): { categorie: string; ds: string; liste: boolean }[] => [
  ...Object.keys(CATEGORY_DATASET_DERIVE).map((categorie) => ({ categorie, ds: editableDataset(categorie)!, liste: true })),
  ...Object.keys(OBJECT_CATEGORY_DERIVE).map((categorie) => ({ categorie, ds: editableObjectDataset(categorie)!.ds, liste: false })),
];

/** Catégories NICHÉES déclarées au registre des documents. */
const nichees = (): string[] => DEFS_DE_DOCUMENT.flatMap((d) => {
  const edit = d.exposition?.edit;
  return edit && 'niche' in edit ? Object.keys(edit.niche.categories) : [];
});

type Cas = { categorie: string; entree: { id: string }; champ: string; valeurs: Readonly<Record<string, string>> };

/** Chaque champ énuméré d'une rangée nichée, sur la première entrée qui le porte, lu sur le nœud de SA rangée. */
function casEnumeres(): Cas[] {
  return nichees().flatMap((categorie) => {
    const ds = editableDataset(categorie);
    if (!ds) return [];
    const dedies = dedicatedFieldKeys(categorie);
    const vus = new Set<string>();
    return editableEntries(categorie).flatMap((entree) =>
      enfantsDe(noeudDeLEntree(ds, entree)).flatMap(({ cle: champ, noeud }) => {
        if (champ === undefined || vus.has(champ) || dedies.has(champ) || typeof entree[champ] !== 'string') return [];
        const valeurs = valeursDe(noeud);
        if (!valeurs) return [];
        vus.add(champ);
        return [{ categorie, entree: entree as { id: string }, champ, valeurs }];
      }),
    );
  });
}

describe('atelier du Codex — nœud de la RANGÉE d’une catégorie éditable (#2099)', () => {
  it(`chaque rangée des ${routes().length} routes d'édition, existante ou NEUVE, est lue sur le nœud de SA rangée`, () => {
    let controlees = 0;
    const fautes = routes().flatMap(({ categorie, ds, liste }) => {
      const suite = DATASET_SUITE_DERIVE[ds];
      const enveloppe = noeudObjet(schemaForFile(DATASET_FICHIER_DERIVE[ds]));
      const lieu = (quelle: string) => `${categorie} « ${quelle} »`;
      const contrat = (quelle: string, rangee: Record<string, unknown>, complete: boolean): string[] => {
        const noeud = noeudDeLEntree(ds, rangee);
        const declarees = new Set(enfantsDe(noeud).map((e) => e.cle));
        return [
          ...Object.keys(rangee).filter((k) => !declarees.has(k)).map((k) => `${lieu(quelle)}.${k} non déclarée`),
          ...(suite && noeud === enveloppe ? [`${lieu(quelle)} lue sur l'enveloppe`] : []),
          ...(complete && !(noeud as { safeParse: (v: unknown) => { success: boolean } }).safeParse(versDisque(rangee)).success ? [`${lieu(quelle)} refusée par son nœud`] : []),
        ];
      };
      const existantes = editableEntries(categorie);
      controlees += existantes.length;
      return [
        ...existantes.flatMap((e) => contrat(String(e.id ?? '(objet)'), e, true)),
        ...(liste ? contrat('(neuve)', brouillonNeuf(DATASET_FICHIER_DERIVE[ds], existantes), false) : []),
      ];
    });
    expect(controlees, 'aucune rangée existante contrôlée — le contrat ne porte sur rien').toBeGreaterThan(0);
    expect(fautes, fautes.slice(0, 20).join(', ')).toEqual([]);
  });

  it('un dataset sans route d’édition déclarée LÈVE en se nommant', () => {
    expect(() => noeudDeLEntree('pasUnDataset', {})).toThrow(/« pasUnDataset »/);
  });

  const cas = casEnumeres();
  it(`${cas.length} champs énumérés de rangée mesurés`, () => {
    expect(cas.length, 'aucun champ énuméré de rangée — la mesure ne porte sur rien').toBeGreaterThan(0);
  });
  for (const { categorie, entree, champ, valeurs } of cas) {
    it(`${categorie}.${champ} se rend en select libellé par son nœud`, () => {
      monter(categorie, entree);
      const attendu = Object.entries(valeurs).map(([v, l]) => `${v}=${l}`);
      const selects = [...container!.querySelectorAll('select')].map((s) => [...s.options].filter((o) => o.value !== '').map((o) => `${o.value}=${o.textContent}`));
      expect(selects.some((o) => attendu.every((a) => o.includes(a))), `aucun select libellé pour ${champ}`).toBe(true);
    });
  }
});
