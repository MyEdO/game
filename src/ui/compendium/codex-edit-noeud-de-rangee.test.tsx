// @vitest-environment jsdom
/**
 * #2099 — l'entrée d'une catégorie éditable est une RANGÉE de son document : l'atelier lit ses nœuds
 * sur la rangée que DÉCLARE la route de son dataset (`noeudDeLEntree`), jamais sur l'enveloppe. Un
 * champ énuméré de rangée NICHÉE (`enumNomme`) se rend donc en `select` libellé, comme un champ de
 * racine ; une rangée dont le discriminant n'ouvre aucune branche est une faute NOMMÉE de l'atelier.
 */
import { describe, it, expect, afterEach, beforeAll } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';

import { CodexEdit, dedicatedFieldKeys, editableDataset, editableEntries, editableObjectDataset } from './CodexEdit';
import { DEFS_DE_DOCUMENT, brouillonNeuf, noeudDeLEntree, noeudObjet, schemaForFile } from '../../data/schemas/validate';
import { CATEGORY_DATASET_DERIVE, DATASET_FICHIER_DERIVE, DATASET_SUITE_DERIVE, OBJECT_CATEGORY_DERIVE } from '../../data/schemas/exposition-derivee';
import { enfantsDe } from '../../data/schemas/grammaire/descente';
import { valeursDe } from '../../data/schemas/grammaire/meta';
import { versDisque } from '../../data/schemas/grammaire/prose';
import { datasetArray, resetData, setDataset } from '../../data/overrides';
import { categoryByKey } from './registry';

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

function saisir(champ: HTMLInputElement, valeur: string): void {
  act(() => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(champ, valeur);
    champ.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

const fautesDe = (ecran: HTMLDivElement) => [...ecran.querySelectorAll('.codex-edit-errors li')].map((li) => li.textContent);
const enregistrerDe = (ecran: HTMLDivElement) => ecran.querySelector<HTMLButtonElement>('.codex-edit-bar button.btn-primary')!;
const champTexte = (ecran: HTMLDivElement, nom: string) =>
  [...ecran.querySelectorAll('.codex-edit-form label.ed-field')].find((l) => l.querySelector('span')?.textContent === nom)?.querySelector('input');

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

  it('une rangée au discriminant hors de ses branches est une faute NOMMÉE de l’atelier, levée par son contrôle', () => {
    const cargaisons = datasetArray('landCargo') as { id: string; label: string; echangeable?: unknown }[];
    const marqueurs = cargaisons.filter((c) => c.echangeable === false);
    expect(marqueurs.length, 'la case `echangeable` s’infère d’un marqueur qui précède la cible').toBeGreaterThanOrEqual(2);
    const cible = marqueurs[marqueurs.length - 1];
    setDataset('landCargo', cargaisons.map((c) => (c === cible ? { ...c, echangeable: '' } : c)) as never);
    const ecran = monter('landCargo', cible);
    const faute = (sujet: string) => [`${sujet} — JSON invalide contre son schéma :`, '  - echangeable: Entrée invalide'];
    expect(fautesDe(ecran)).toEqual(faute(cible.label));

    saisir([...ecran.querySelectorAll<HTMLInputElement>('.codex-edit-form input')].find((i) => i.value === cible.label)!, `${cible.label} bis`);
    expect(fautesDe(ecran), 'la faute se dit au libellé ÉDITÉ, jamais à celui de l’ouverture').toEqual(faute(`${cible.label} bis`));
    expect(enregistrerDe(ecran).disabled, 'une rangée sans nœud s’enregistrerait').toBe(true);

    const echangeable = [...ecran.querySelectorAll('label.ed-check')].find((l) => l.textContent === 'echangeable')?.querySelector('input');
    expect(echangeable, 'aucune case `echangeable` : la faute ne se corrige pas à l’écran').toBeTruthy();
    act(() => { echangeable!.click(); });
    expect(fautesDe(ecran)).toEqual([]);
    expect(enregistrerDe(ecran).disabled).toBe(false);
  });

  it('la faute d’une entrée EXISTANTE dont on vide le libellé se dit au libellé de sa catégorie', () => {
    const cargaisons = datasetArray('landCargo') as { id: string; label: string; echangeable?: unknown }[];
    const marqueurs = cargaisons.filter((c) => c.echangeable === false);
    const cible = marqueurs[marqueurs.length - 1];
    setDataset('landCargo', cargaisons.map((c) => (c === cible ? { ...c, echangeable: '' } : c)) as never);
    const ecran = monter('landCargo', cible);
    expect(fautesDe(ecran)[0]).toBe(`${cible.label} — JSON invalide contre son schéma :`);

    saisir(champTexte(ecran, 'Libellé')!, '');
    expect(fautesDe(ecran)[0], 'une entrée sans libellé se dit à sa catégorie, jamais au libellé de l’ouverture').toBe(`${categoryByKey('landCargo')!.label} — JSON invalide contre son schéma :`);
    expect(enregistrerDe(ecran).disabled, 'une rangée sans nœud s’enregistrerait').toBe(true);
  });

  it('la faute d’une entrée NEUVE se dit au libellé de sa catégorie, puis au libellé saisi', () => {
    const cargaisons = datasetArray('landCargo') as { id: string; label: string; echangeable?: unknown }[];
    const marqueur = cargaisons.find((c) => c.echangeable === false)!;
    setDataset('landCargo', [{ ...marqueur, id: `${marqueur.id}-tete`, echangeable: '' }, ...cargaisons] as never);
    const ecran = monter('landCargo');
    const echangeable = champTexte(ecran, 'echangeable');
    expect(echangeable, 'un échantillon `echangeable: ""` en tête infère un champ texte').toBeTruthy();
    expect(fautesDe(ecran)).toEqual([]);

    saisir(echangeable!, 'x');
    const [tete] = fautesDe(ecran);
    expect(tete).toBe(`${categoryByKey('landCargo')!.label} — JSON invalide contre son schéma :`);
    expect(enregistrerDe(ecran).disabled, 'une rangée sans nœud s’enregistrerait').toBe(true);

    saisir(champTexte(ecran, 'Libellé')!, 'Sel gemme');
    expect(fautesDe(ecran)[0]).toBe('Sel gemme — JSON invalide contre son schéma :');
  });
});
