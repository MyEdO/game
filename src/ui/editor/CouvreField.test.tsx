// @vitest-environment jsdom
/**
 * `CouvreField` / `SelecteurDEntreeDeFiche` (#2290) : les options sont les entrées des fiches COMMITÉES
 * (`docs/dossiers/<ABBR>/<NN>.json`) ; ajouter, retirer, liste vide qui se dit vide, entrée introuvable
 * dite introuvable. Puis les deux câblages du narratif : `couvre` d'un preset PNJ et l'onglet Écarts.
 */
import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import { act, useState, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { CouvreField } from './CouvreField';
import { NarratifEditor, type ProjetEdite } from './NarratifEditor';
import { emptyNarratif, type NarratifBlock } from '../../state/campaignNarratif';
import { narratifSchema } from '../../data/schemas/defs-scenes/narratif';
import { ficheDeDossier, idDEntree } from '../../data/source/dossier';
import { coupeAuMot } from '../../lib/coupeAuMot.mjs';
import { creatures } from '../../data';
import { ENTREES_DE_DOSSIER } from '../../data/dossiers';
import ficheEdo01 from '../../../docs/dossiers/EDO/01.json';

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});

/** Une entrée RÉELLE de la fiche commitée : le premier beat du chapitre 1 d'EDO. */
const beat = ficheDeDossier.parse(ficheEdo01).beats[0];
const ID_BEAT = idDEntree('EDO', '01', beat.id);
const TITRE = beat.titre;

let container: HTMLDivElement;
let root: Root;
let couvre: string[] | undefined;
let narratif: NarratifBlock;

function monter(node: ReactNode) {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => { root.render(node); });
}

afterEach(() => {
  act(() => { root.unmount(); });
  container.remove();
});

function HarnaisCouvre({ initial }: { initial?: string[] }) {
  const [v, setV] = useState<string[] | undefined>(initial);
  couvre = v;
  return <CouvreField value={v} sujet="du témoin" onChange={setV} />;
}

function HarnaisNarratif({ initial }: { initial: NarratifBlock }) {
  const [p, setP] = useState<ProjetEdite>({ scenes: [], worldMap: null, narratif: initial });
  narratif = p.narratif;
  return <NarratifEditor projet={p} onChange={setP} onClose={() => {}} />;
}

const parNom = (nom: string): HTMLElement => {
  const el = container.querySelector(`[aria-label="${nom}"]`);
  if (!el) throw new Error(`contrôle « ${nom} » introuvable`);
  return el as HTMLElement;
};
function click(el: HTMLElement) {
  act(() => { el.dispatchEvent(new MouseEvent('click', { bubbles: true })); });
}
function choisir(el: HTMLElement, value: string) {
  const proto = el instanceof HTMLSelectElement ? HTMLSelectElement.prototype
    : el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  act(() => {
    Object.getOwnPropertyDescriptor(proto, 'value')!.set!.call(el, value);
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  });
}
const onglet = (texte: string) => {
  const b = [...container.querySelectorAll('button')].find((e) => (e.textContent ?? '').includes(texte));
  if (!b) throw new Error(`onglet « ${texte} » introuvable`);
  click(b as HTMLElement);
};

describe('CouvreField — `couvre` au clic, options des fiches commitées (#2290)', () => {
  it('liste vide : elle le DIT, et le sélecteur offre les entrées de la fiche commitée, id global + texte court', () => {
    expect(TITRE, 'le premier beat de la fiche commitée porte un titre').not.toBe('');
    monter(<HarnaisCouvre />);
    expect(container.querySelector('.empty')?.textContent).toBe('Aucune entrée de fiche couverte.');
    const option = [...parNom('Ajouter une entrée de fiche couverte du témoin').querySelectorAll('option')].find((o) => o.value === ID_BEAT);
    expect(option?.textContent).toBe(`${ID_BEAT} — ${coupeAuMot(TITRE, 70)}`);
  });

  it('ajouter pose l’identifiant ; la rangée le montre, l’option prise se désactive ; ✕ retire et la liste vidée disparaît', () => {
    monter(<HarnaisCouvre />);
    choisir(parNom('Ajouter une entrée de fiche couverte du témoin'), ID_BEAT);
    expect(couvre).toEqual([ID_BEAT]);
    const rangee = container.querySelector('.listrow')!;
    expect(rangee.tagName, 'la rangée n’est pas cliquable : ni bouton, ni famille de style').toBe('DIV');
    expect(rangee.hasAttribute('data-variant')).toBe(false);
    expect(rangee.querySelector('.lr-name')?.textContent).toBe(coupeAuMot(TITRE, 70));
    expect(rangee.querySelector('.chip')?.textContent).toBe(ID_BEAT);
    const prise = [...parNom('Ajouter une entrée de fiche couverte du témoin').querySelectorAll('option')].find((o) => o.value === ID_BEAT);
    expect(prise?.disabled).toBe(true);

    click(parNom(`Retirer ${ID_BEAT} du témoin`));
    expect(couvre).toBeUndefined();
    expect(container.querySelector('.empty')).not.toBeNull();
  });

  it('un texte court COUPÉ se lit en entier : infobulle de la rangée, de l’option et du sélecteur qui la porte', () => {
    const longue = ENTREES_DE_DOSSIER.find((e) => coupeAuMot(e.libelle, 70) !== e.libelle);
    if (!longue) throw new Error('aucune entrée commitée de plus de 70 caractères');
    monter(<HarnaisCouvre initial={[longue.id]} />);
    expect(container.querySelector('.listrow')?.getAttribute('title')).toBe(longue.libelle);
    const option = [...parNom('Ajouter une entrée de fiche couverte du témoin').querySelectorAll('option')].find((o) => o.value === longue.id);
    expect(option?.title).toBe(longue.libelle);
    act(() => { root.unmount(); });
    container.remove();
    monter(<HarnaisNarratif initial={{ ...emptyNarratif(), ecartes: [{ entree: longue.id, motif: 'm' }] }} />);
    onglet('Écarts');
    expect(parNom('Entrée écartée 1').title).toBe(longue.libelle);
  });

  it('un `change` portant une entrée DÉJÀ couverte est ignoré : aucun doublon', () => {
    monter(<HarnaisCouvre initial={[ID_BEAT]} />);
    choisir(parNom('Ajouter une entrée de fiche couverte du témoin'), ID_BEAT);
    expect(couvre).toEqual([ID_BEAT]);
    expect(container.querySelectorAll('.listrow')).toHaveLength(1);
  });

  it('une entrée absente des fiches commitées reste affichée, dite introuvable', () => {
    monter(<HarnaisCouvre initial={['EDO-99#b1']} />);
    const rangee = container.querySelector('.listrow')!;
    expect(rangee.querySelector('.lr-name')?.textContent).toBe('Entrée introuvable dans les fiches');
    expect(rangee.querySelector('.chip.tone-warn')?.textContent).toBe('EDO-99#b1');
  });
});

describe('NarratifEditor — `couvre` d’un PNJ et onglet Écarts (#2290)', () => {
  it('le formulaire du PNJ porte la couverture dans SON onglet, compté ; il écrit `presetsPnj[].couvre`, et le narratif reste valide', () => {
    monter(<HarnaisNarratif initial={{ ...emptyNarratif(), presetsPnj: [{ id: 'le-borgne', base: creatures[0].id }] }} />);
    onglet('PNJ');
    const ongletCouverture = [...container.querySelectorAll<HTMLElement>('[aria-label="Rubriques du PNJ"] [role="tab"]')].find((t) => t.textContent?.startsWith('Couverture'));
    expect(ongletCouverture?.textContent).toBe('Couverture0');
    expect(container.querySelector('[aria-label="Ajouter une entrée de fiche couverte du PNJ"]'), 'la couverture s’affiche hors de son onglet').toBeNull();
    click(ongletCouverture!);
    choisir(parNom('Ajouter une entrée de fiche couverte du PNJ'), ID_BEAT);
    expect(narratif.presetsPnj[0].couvre).toEqual([ID_BEAT]);
    expect(ongletCouverture?.textContent).toBe('Couverture1');
    expect(narratifSchema.safeParse(narratif).success).toBe(true);
  });

  it('Écarts : vide dit vide ; écarter pose l’entrée, le motif manquant s’annonce ; le motif saisi rend le narratif valide ; ✕ retire le registre', () => {
    monter(<HarnaisNarratif initial={emptyNarratif()} />);
    onglet('Écarts');
    expect(container.querySelector('.empty')?.textContent).toBe('Aucune entrée de fiche écartée.');

    choisir(parNom('Écarter une entrée de fiche'), ID_BEAT);
    expect(narratif.ecartes).toEqual([{ entree: ID_BEAT, motif: '' }]);
    const alerte = container.querySelector('[role="alert"]');
    expect(alerte?.textContent).toBe('Motif requis.');
    expect(parNom('Motif de l\'écart 1').getAttribute('aria-describedby'), 'le motif désigne SON alerte').toBe(alerte?.id);
    expect(narratifSchema.safeParse(narratif).success).toBe(false);

    choisir(parNom('Motif de l\'écart 1'), 'Scène résumée en narration.');
    expect(narratif.ecartes).toEqual([{ entree: ID_BEAT, motif: 'Scène résumée en narration.' }]);
    expect(container.querySelector('[role="alert"]')).toBeNull();
    expect(narratifSchema.safeParse(narratif).success).toBe(true);

    click(parNom('Retirer l\'écart 1'));
    expect(narratif.ecartes).toBeUndefined();
  });

  it('Écarts : un `change` portant une entrée déjà écartée est ignoré, à l’ajout comme au remplacement', () => {
    const [premiere, seconde] = ENTREES_DE_DOSSIER;
    const initial = [{ entree: premiere.id, motif: 'm' }, { entree: seconde.id, motif: 'n' }];
    monter(<HarnaisNarratif initial={{ ...emptyNarratif(), ecartes: initial }} />);
    onglet('Écarts');
    choisir(parNom('Écarter une entrée de fiche'), premiere.id);
    expect(narratif.ecartes).toEqual(initial);
    choisir(parNom('Entrée écartée 2'), premiere.id);
    expect(narratif.ecartes).toEqual(initial);
    expect(narratifSchema.safeParse(narratif).success).toBe(true);
  });
});
