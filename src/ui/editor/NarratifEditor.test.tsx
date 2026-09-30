// @vitest-environment jsdom
/**
 * Contrat POSITIF du chemin d'écriture de l'onglet PNJ (#671 lot B) : ajouter/éditer/supprimer un
 * preset produit un `NarratifBlock` neuf passé à `onChange`. Wrapper contrôlé (l'état vit chez le
 * parent, comme `Editor`) pour que les éditions successives s'enchaînent sur le narratif à jour.
 */
import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import { act, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { NarratifEditor } from './NarratifEditor';
import { emptyNarratif, type NarratifBlock } from '../../state/campaignNarratif';
import { narratifSchema } from '../../data/schemas/defs-scenes/narratif';
import { creatures } from '../../data';

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});

let container: HTMLDivElement;
let root: Root;
let last: NarratifBlock;

function Harness({ initial }: { initial?: NarratifBlock }) {
  const [n, setN] = useState<NarratifBlock>(initial ?? emptyNarratif());
  last = n;
  return <NarratifEditor narratif={n} onChange={setN} onClose={() => {}} />;
}

function mount(initial?: NarratifBlock) {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => { root.render(<Harness initial={initial} />); });
}

afterEach(() => {
  act(() => { root.unmount(); });
  container.remove();
});

/** Bouton par texte visible. */
function btn(text: string): HTMLButtonElement {
  const b = [...container.querySelectorAll('button')].find((e) => (e.textContent ?? '').includes(text));
  if (!b) throw new Error(`bouton « ${text} » introuvable`);
  return b as HTMLButtonElement;
}
/** Champ (input/select) d'une `.ed-field`/`label` dont le texte inclut `labelText`. */
function field(labelText: string): HTMLInputElement | HTMLSelectElement {
  const wrap = [...container.querySelectorAll('.ed-field, label')].find((e) => (e.textContent ?? '').includes(labelText));
  const el = wrap?.querySelector('input, select');
  if (!el) throw new Error(`champ « ${labelText} » introuvable`);
  return el as HTMLInputElement | HTMLSelectElement;
}
function click(el: HTMLElement) {
  act(() => { el.dispatchEvent(new MouseEvent('click', { bubbles: true })); });
}
function setValue(el: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement, value: string) {
  const proto = el instanceof HTMLSelectElement ? HTMLSelectElement.prototype
    : el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(proto, 'value')!.set!;
  act(() => {
    setter.call(el, value);
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  });
}

describe('NarratifEditor — onglet PNJ éditable (#671 lot B)', () => {
  it('ajoute un preset via onChange (base valide par défaut)', () => {
    mount();
    click(btn('PNJ'));            // onglet
    click(btn('Ajouter un PNJ'));
    expect(last.presetsPnj).toHaveLength(1);
    expect(last.presetsPnj[0].base).toBeTruthy();
  });

  it('édite la base et le nom du preset', () => {
    mount();
    click(btn('PNJ'));
    click(btn('Ajouter un PNJ'));
    const otherBase = creatures.find((c) => c.id !== last.presetsPnj[0].base)!.id;
    setValue(field('Créature de base'), otherBase);
    expect(last.presetsPnj[0].base).toBe(otherBase);
    setValue(field('Nom du PNJ'), 'Josef Quartjin');
    expect(last.presetsPnj[0].profil?.label).toBe('Josef Quartjin');
  });

  it('supprime le preset sélectionné', () => {
    mount();
    click(btn('PNJ'));
    click(btn('Ajouter un PNJ'));
    expect(last.presetsPnj).toHaveLength(1);
    click(btn('Supprimer ce PNJ'));
    expect(last.presetsPnj).toHaveLength(0);
  });
});

/** Champ d'une réf de source (`SourceRefField`), par son nom accessible — le livre est un `<select>`. */
function champDeSource<E extends HTMLInputElement | HTMLSelectElement>(champ: 'Livre' | 'Page' | 'Note', sujet: string): E {
  const trouves = container.querySelectorAll(`[aria-label="${champ} de la source ${sujet}"]`);
  if (trouves.length !== 1) throw new Error(`${champ} de la source ${sujet} : ${trouves.length} champ(s) portent ce nom`);
  return trouves[0] as E;
}
const page = (sujet: string) => champDeSource<HTMLInputElement>('Page', sujet);
/** Page tapée PUIS validée (perte de focus) — la seule qu'une source émet. */
function poserPage(sujet: string, valeur: string) {
  const champ = page(sujet);
  setValue(champ, valeur);
  act(() => { champ.dispatchEvent(new FocusEvent('focusout', { bubbles: true })); });
}
const livre = (sujet: string) => champDeSource<HTMLSelectElement>('Livre', sujet);
const note = (sujet: string) => champDeSource<HTMLInputElement>('Note', sujet);

const avecIndice = (stades: NarratifBlock['indices'][number]['stades']): NarratifBlock => ({
  ...emptyNarratif(),
  affaires: [{ id: 'affaire-a', titre: 'Le Marché noir' }],
  indices: [{ id: 'indice-1', affaireId: 'affaire-a', kind: 'indice', titre: 'Un indice', stades }],
});

describe('NarratifEditor — sources : ouverture, stades, PNJ (une primitive, seule une réf complète est émise)', () => {
  it('ouverture sourcée : le livre choisi seul n’émet rien ; la page validée complète `ouverture.source`, qui parse ; « aucun » la retire', () => {
    mount();
    click(btn('Cadre'));
    click(btn('Ajouter une ouverture'));
    setValue(field('Titre'), 'Ch. 1');
    setValue(container.querySelector('textarea')!, 'Pitch maison.');
    expect(last.ouverture?.source).toBeUndefined();
    setValue(livre("de l'ouverture"), 'ennemi-dans-l-ombre');
    expect(last.ouverture?.source).toBeUndefined();
    poserPage("de l'ouverture", '12');
    expect(last.ouverture?.source).toEqual({ book: 'ennemi-dans-l-ombre', page: 12 });
    expect(narratifSchema.safeParse(last).success).toBe(true);
    setValue(livre("de l'ouverture"), '');
    expect(last.ouverture?.source).toBeUndefined();
    expect(narratifSchema.safeParse(last).success).toBe(true);
  });

  it('le libellé du pitch ne dit pas « verbatim » : sans source, le pitch est maison', () => {
    mount();
    click(btn('Cadre'));
    click(btn('Ajouter une ouverture'));
    const pitch = container.querySelector('textarea')!.closest('label')!;
    expect(pitch.textContent).toBe('Pitch (Markdown)');
  });

  it('stade sourcé : le livre choisi pose `stades[].source` et garde sa `note` à sa place', () => {
    mount(avecIndice([{ id: 'stade-1', prose: 'p', source: { book: 'aux-armes', page: 3, note: 'ch. 1 l.5' } }]));
    click(btn('Indices'));
    click(btn('Un indice'));
    setValue(livre('du stade 1'), 'ennemi-dans-l-ombre');
    expect(last.indices[0].stades[0].source).toEqual({ book: 'ennemi-dans-l-ombre', page: 3, note: 'ch. 1 l.5' });
    expect(Object.keys(last.indices[0].stades[0].source!)).toEqual(['book', 'page', 'note']);
  });

  it('deux stades : chaque champ de source porte un nom accessible distinct', () => {
    mount(avecIndice([{ id: 'stade-1', prose: 'p' }, { id: 'stade-2', prose: 'q' }]));
    click(btn('Indices'));
    click(btn('Un indice'));
    setValue(livre('du stade 2'), 'ennemi-dans-l-ombre');
    poserPage('du stade 2', '7');
    expect(last.indices[0].stades[0].source).toBeUndefined();
    expect(last.indices[0].stades[1].source).toEqual({ book: 'ennemi-dans-l-ombre', page: 7 });
  });

  it('« aucun » au livre retire la source en UN geste : page et note se vident ; une note seule ensuite n’émet rien', () => {
    mount(avecIndice([{ id: 'stade-1', prose: 'p', source: { book: 'aux-armes', page: 4, note: 'ch. 1 l.5' } }]));
    click(btn('Indices'));
    click(btn('Un indice'));
    setValue(livre('du stade 1'), '');
    expect(last.indices[0].stades[0].source).toBeUndefined();
    expect(narratifSchema.safeParse(last).success).toBe(true);
    expect(page('du stade 1').value).toBe('');
    expect(note('du stade 1').value).toBe('');
    setValue(note('du stade 1'), 'ch. 1 l.9');
    expect(last.indices[0].stades[0].source, 'une note seule a été émise').toBeUndefined();
    expect(note('du stade 1').value).toBe('ch. 1 l.9');
    setValue(livre('du stade 1'), 'aux-armes');
    poserPage('du stade 1', '4');
    expect(last.indices[0].stades[0].source).toEqual({ book: 'aux-armes', page: 4, note: 'ch. 1 l.9' });
  });

  it('PNJ : une note seule n’émet aucune source ; le livre et la page la posent', () => {
    mount();
    click(btn('PNJ'));
    click(btn('Ajouter un PNJ'));
    setValue(note('du PNJ'), 'ch. 2');
    expect(last.presetsPnj[0].source).toBeUndefined();
    setValue(livre('du PNJ'), 'ennemi-dans-l-ombre');
    poserPage('du PNJ', '30');
    expect(last.presetsPnj[0].source).toEqual({ book: 'ennemi-dans-l-ombre', page: 30, note: 'ch. 2' });
    expect(narratifSchema.safeParse(last).success).toBe(true);
  });

  it('deux PNJ sans source : le brouillon de l’un ne s’affiche ni ne s’écrit sur l’autre', () => {
    const base = creatures[0].id;
    mount({ ...emptyNarratif(), presetsPnj: [{ id: 'pnj-a', base, profil: { label: 'Alpha' } }, { id: 'pnj-b', base, profil: { label: 'Bravo' } }] });
    click(btn('PNJ'));
    click(btn('Alpha'));
    setValue(livre('du PNJ'), 'ennemi-dans-l-ombre');
    click(btn('Bravo'));
    expect(livre('du PNJ').value, 'le livre choisi sur Alpha s’affiche sur Bravo').toBe('');
    poserPage('du PNJ', '12');
    expect(last.presetsPnj[1].source, 'la page tapée sur Bravo a posé le livre d’Alpha').toBeUndefined();
    expect(last.presetsPnj[0].source).toBeUndefined();
  });

  it('deux indices sans source (même id de stade) : le brouillon d’un stade ne passe pas à l’autre indice', () => {
    mount({
      ...emptyNarratif(),
      affaires: [{ id: 'affaire-a', titre: 'Le Marché noir' }],
      indices: [
        { id: 'indice-1', affaireId: 'affaire-a', kind: 'indice', titre: 'Indice Un', stades: [{ id: 'stade-1', prose: 'p' }] },
        { id: 'indice-2', affaireId: 'affaire-a', kind: 'indice', titre: 'Indice Deux', stades: [{ id: 'stade-1', prose: 'q' }] },
      ],
    });
    click(btn('Indices'));
    click(btn('Indice Un'));
    setValue(livre('du stade 1'), 'ennemi-dans-l-ombre');
    click(btn('Indice Deux'));
    expect(livre('du stade 1').value, 'le livre choisi sur Indice Un s’affiche sur Indice Deux').toBe('');
    poserPage('du stade 1', '5');
    expect(last.indices[1].stades[0].source, 'la page tapée sur Indice Deux a posé le livre d’Indice Un').toBeUndefined();
    expect(last.indices[0].stades[0].source).toBeUndefined();
  });

  /** Renommer n'est pas changer d'entité : le brouillon survit, puis se complète sur le même porteur. */
  const brouillonSurvitAuRenommage = (sujet: string, renommer: () => void) => {
    setValue(livre(sujet), 'aux-armes');
    setValue(note(sujet), 'ch. 3 l.4');
    renommer();
    expect(livre(sujet).value, 'le renommage a effacé le livre en saisie').toBe('aux-armes');
    expect(note(sujet).value, 'le renommage a effacé la note en saisie').toBe('ch. 3 l.4');
    poserPage(sujet, '9');
  };

  it('renommer l’indice garde le brouillon de source de son stade', () => {
    mount(avecIndice([{ id: 'stade-1', prose: 'p' }]));
    click(btn('Indices'));
    click(btn('Un indice'));
    brouillonSurvitAuRenommage('du stade 1', () => setValue(field('Identifiant (id stable)'), 'indice-1b'));
    expect(last.indices[0].id).toBe('indice-1b');
    expect(last.indices[0].stades[0].source).toEqual({ book: 'aux-armes', page: 9, note: 'ch. 3 l.4' });
  });

  it('renommer le stade garde son brouillon de source', () => {
    mount(avecIndice([{ id: 'stade-1', prose: 'p' }]));
    click(btn('Indices'));
    click(btn('Un indice'));
    brouillonSurvitAuRenommage('du stade 1', () => setValue(field('Id du stade'), 'stade-1b'));
    expect(last.indices[0].stades[0]).toMatchObject({ id: 'stade-1b', source: { book: 'aux-armes', page: 9, note: 'ch. 3 l.4' } });
  });

  it('renommer le PNJ garde son brouillon de source', () => {
    mount({ ...emptyNarratif(), presetsPnj: [{ id: 'pnj-a', base: creatures[0].id, profil: { label: 'Alpha' } }] });
    click(btn('PNJ'));
    click(btn('Alpha'));
    brouillonSurvitAuRenommage('du PNJ', () => setValue(field('Identifiant (id stable)'), 'pnj-z'));
    expect(last.presetsPnj[0]).toMatchObject({ id: 'pnj-z', source: { book: 'aux-armes', page: 9, note: 'ch. 3 l.4' } });
  });
});

describe('NarratifEditor — l\'éditeur ne produit jamais un bloc invalide (#670)', () => {
  const withOneAffaire = (): NarratifBlock => ({
    ...emptyNarratif(),
    affaires: [{ id: 'affaire-a', titre: 'Le Marché noir' }],
  });

  it('0 affaire : « Ajouter un indice » est désactivé (défaut 1)', () => {
    mount();
    click(btn('Indices'));
    expect(btn('Ajouter un indice').disabled).toBe(true);
  });

  it('1 affaire : « Ajouter un indice » émet un bloc qui PARSE contre narratifSchema', () => {
    mount(withOneAffaire());
    click(btn('Indices'));
    const addIndice = btn('Ajouter un indice');
    expect(addIndice.disabled).toBe(false);
    click(addIndice);

    expect(last.indices).toHaveLength(1);
    expect(last.indices[0].affaireId).toBe('affaire-a');
    expect(narratifSchema.safeParse(last).success).toBe(true);
  });

  it('renommer une affaire propage aux indices rattachés et reste valide', () => {
    mount({
      ...withOneAffaire(),
      indices: [{ id: 'indice-1', affaireId: 'affaire-a', kind: 'indice', titre: 'Un indice', stades: [{ id: 'stade-1', prose: '' }] }],
    });
    click(btn('Affaires'));
    click(btn('Le Marché noir'));
    setValue(field('Identifiant'), 'affaire-b');

    expect(last.affaires[0].id).toBe('affaire-b');
    expect(last.indices[0].affaireId).toBe('affaire-b');
    expect(narratifSchema.safeParse(last).success).toBe(true);
  });

  it('renommer une affaire vers l\'id d\'un indice existant est REFUSÉ (défaut 2)', () => {
    mount({
      ...withOneAffaire(),
      indices: [{ id: 'indice-1', affaireId: 'affaire-a', kind: 'indice', titre: 'Un indice', stades: [{ id: 'stade-1', prose: '' }] }],
    });
    click(btn('Affaires'));
    click(btn('Le Marché noir'));
    setValue(field('Identifiant'), 'indice-1');

    expect(last.affaires[0].id).toBe('affaire-a');
    // Refus VISIBLE : la saisie reste, marquée et expliquée (même règle que les clés de record du Codex).
    expect(field('Identifiant').value).toBe('indice-1');
    expect(message(field('Identifiant'))).toBe('Identifiant « indice-1 » déjà porté par l\'indice « Un indice » : non retenu. L\'identifiant retenu reste « affaire-a ».');
    setValue(field('Identifiant'), 'indice-1b');
    expect(last.affaires[0].id).toBe('indice-1b');
    expect(field('Identifiant').getAttribute('aria-invalid')).toBeNull();
  });

  it('identifiant vide : non retenu, marqué et expliqué', () => {
    mount(withOneAffaire());
    click(btn('Affaires'));
    click(btn('Le Marché noir'));
    setValue(field('Identifiant'), '  ');
    expect(last.affaires[0].id).toBe('affaire-a');
    expect(message(field('Identifiant'))).toBe('Identifiant vide : non retenu. L\'identifiant retenu reste « affaire-a ».');
  });

  it('stade : un id déjà porté par un AUTRE stade est refusé, puis retenu dès que l’autre le libère', () => {
    mount(avecIndice([{ id: 'stade-1', prose: 'p' }, { id: 'stade-2', prose: 'q' }]));
    click(btn('Indices'));
    click(btn('Un indice'));
    const idDuStade = (n: number) => [...container.querySelectorAll('label')].find((l) => l.firstChild?.textContent === `Id du stade ${n}`)!.querySelector('input')!;
    setValue(idDuStade(1), 'stade-2');
    expect(last.indices[0].stades.map((s) => s.id)).toEqual(['stade-1', 'stade-2']);
    expect(message(idDuStade(1))).toBe('Identifiant « stade-2 » déjà porté par le stade 2 : non retenu. L\'identifiant retenu reste « stade-1 ».');
    setValue(idDuStade(2), 'stade-3');
    expect(last.indices[0].stades.map((s) => s.id)).toEqual(['stade-2', 'stade-3']);
    expect(idDuStade(1).getAttribute('aria-invalid')).toBeNull();
    expect(narratifSchema.safeParse(last).success).toBe(true);
  });
});

/** Le message lié à un champ refusé (`aria-invalid` + `aria-describedby`), ou `null`. */
function message(champ: HTMLInputElement | HTMLSelectElement): string | null {
  if (champ.getAttribute('aria-invalid') !== 'true') return null;
  return document.getElementById(champ.getAttribute('aria-describedby') ?? '')?.textContent ?? null;
}
