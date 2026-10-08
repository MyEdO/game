// @vitest-environment jsdom
/**
 * Contrat POSITIF du chemin d'écriture de l'onglet PNJ (#671 lot B) : ajouter/éditer/supprimer un
 * preset produit un `NarratifBlock` neuf passé à `onChange`. Wrapper contrôlé (l'état vit chez le
 * parent, comme `Editor`) pour que les éditions successives s'enchaînent sur le narratif à jour.
 */
import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import { act, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { NarratifEditor, type ProjetEdite } from './NarratifEditor';
import { emptyScene, type Scene } from '../../state/scene';
import { emptyNarratif, type NarratifBlock } from '../../state/campaignNarratif';
import { narratifSchema } from '../../data/schemas/defs-scenes/narratif';
import { charAbr, creatures } from '../../data';
import { CHAR_KEYS } from '../../engine/types';

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});

let container: HTMLDivElement;
let root: Root;
let last: NarratifBlock;
let lastProjet: ProjetEdite;

/** Projet CONTRÔLÉ : l'état vit chez le parent, comme chez `Editor` (`poserProjet`). */
function Harness({ initial, scenes = [] }: { initial?: NarratifBlock; scenes?: Scene[] }) {
  const [p, setP] = useState<ProjetEdite>({ scenes, worldMap: null, narratif: initial ?? emptyNarratif() });
  last = p.narratif;
  lastProjet = p;
  return <NarratifEditor projet={p} onChange={setP} onClose={() => {}} />;
}

function mount(initial?: NarratifBlock, scenes?: Scene[]) {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => { root.render(<Harness initial={initial} scenes={scenes} />); });
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
/** Choisit la provenance d'un texte (`ProvenanceDuTexte`) : un texte sans référence est « Maison », sans champ de source. */
function provenance(mode: 'Copie' | 'Adapté' | 'Maison', sujet: string) {
  const b = container.querySelector<HTMLButtonElement>(`[aria-label="${mode} — provenance ${sujet}"]`);
  if (!b) throw new Error(`provenance « ${mode} » ${sujet} introuvable`);
  click(b);
}

const avecIndice = (stades: NarratifBlock['indices'][number]['stades']): NarratifBlock => ({
  ...emptyNarratif(),
  affaires: [{ id: 'affaire-a', titre: 'Le Marché noir' }],
  indices: [{ id: 'indice-1', affaireId: 'affaire-a', kind: 'indice', titre: 'Un indice', stades }],
});

describe('NarratifEditor — provenance propre aux deux sous-titres', () => {
  it.each([
    ["Sous-titre de l'ouverture", "du sous-titre de l'ouverture", 'ouverture'],
    ['Sous-titre de la clôture', 'du sous-titre de la clôture', 'cloture'],
  ] as const)('%s : le sous-titre adapté garde son texte et ne modifie pas le pitch', (label, sujet, cle) => {
    mount({ ...emptyNarratif(), ouverture: { titre: 'Titre', pitch: 'Pitch.', source: { book: 'ennemi-dans-l-ombre', page: 12 } }, cloture: { titre: 'Fin', when: { kind: 'flag', expr: 'fini' } } });
    click(btn('Cadre'));
    const zone = [...container.querySelectorAll('label.ed-field')].find(e => e.firstElementChild?.textContent === label)!.querySelector('textarea')!;
    setValue(zone, 'Sous-titre maison.');
    provenance('Adapté', sujet);
    setValue(livre(sujet), 'aux-armes');
    poserPage(sujet, '3');
    expect(last[cle]?.sousTitre).toEqual({ texte: 'Sous-titre maison.', source: undefined, adapteDe: { book: 'aux-armes', page: 3 } });
    expect(last.ouverture?.source).toEqual({ book: 'ennemi-dans-l-ombre', page: 12 });
    expect(last.ouverture?.pitch).toBe('Pitch.');
    expect(narratifSchema.safeParse(last).error?.issues).toBeUndefined();
  });
});

describe('NarratifEditor — sources : ouverture, stades, PNJ (une primitive, seule une réf complète est émise)', () => {
  it('ouverture sourcée : le livre choisi seul n’émet rien ; la page validée complète `ouverture.source`, qui parse ; « aucun » la retire', () => {
    mount();
    click(btn('Cadre'));
    click(btn('Ajouter une ouverture'));
    setValue(field('Titre'), 'Ch. 1');
    setValue([...container.querySelectorAll('label.ed-field')].find(e => e.firstElementChild?.textContent === 'Pitch (Markdown)')!.querySelector('textarea')!, 'Pitch maison.');
    expect(last.ouverture?.source).toBeUndefined();
    provenance('Copie', "de l'ouverture");
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
    const pitch = [...container.querySelectorAll('label.ed-field')].find(e => e.firstElementChild?.textContent === 'Pitch (Markdown)')!;
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
    provenance('Copie', 'du stade 2');
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
    provenance('Copie', 'du PNJ');
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
    provenance('Copie', 'du PNJ');
    setValue(livre('du PNJ'), 'ennemi-dans-l-ombre');
    click(btn('Bravo'));
    expect(container.querySelector('[aria-label="Livre de la source du PNJ"]'), 'le mode choisi sur Alpha s’affiche sur Bravo').toBeNull();
    provenance('Copie', 'du PNJ');
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
    provenance('Copie', 'du stade 1');
    setValue(livre('du stade 1'), 'ennemi-dans-l-ombre');
    click(btn('Indice Deux'));
    provenance('Copie', 'du stade 1');
    expect(livre('du stade 1').value, 'le livre choisi sur Indice Un s’affiche sur Indice Deux').toBe('');
    poserPage('du stade 1', '5');
    expect(last.indices[1].stades[0].source, 'la page tapée sur Indice Deux a posé le livre d’Indice Un').toBeUndefined();
    expect(last.indices[0].stades[0].source).toBeUndefined();
  });

  /** Renommer n'est pas changer d'entité : le brouillon survit, puis se complète sur le même porteur. */
  const brouillonSurvitAuRenommage = (sujet: string, renommer: () => void) => {
    provenance('Copie', sujet);
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

describe('NarratifEditor — provenance du texte : ouverture, stade, PNJ montent `ProvenanceDuTexte` (#2001)', () => {
  const REF = { book: 'ennemi-dans-l-ombre', page: 12 };

  it('ouverture : « Adapté » reporte `source` sur `adapteDe`, qui parse ; « Maison » la retire', () => {
    mount({ ...emptyNarratif(), ouverture: { titre: 'Ch. 1', pitch: 'Pitch.', source: REF } });
    click(btn('Cadre'));
    provenance('Adapté', "de l'ouverture");
    expect(last.ouverture).toMatchObject({ source: undefined, adapteDe: REF });
    expect(narratifSchema.safeParse(last).success).toBe(true);
    provenance('Maison', "de l'ouverture");
    expect(last.ouverture).toMatchObject({ source: undefined, adapteDe: undefined });
  });

  it('stade : « Adapté » écrit `adapteDe` dans CE stade, le voisin intact', () => {
    mount(avecIndice([{ id: 'stade-1', prose: 'p' }, { id: 'stade-2', prose: 'q', source: REF }]));
    click(btn('Indices'));
    click(btn('Un indice'));
    provenance('Adapté', 'du stade 2');
    expect(last.indices[0].stades[1]).toMatchObject({ source: undefined, adapteDe: REF });
    expect(last.indices[0].stades[0]).toEqual({ id: 'stade-1', prose: 'p' });
    expect(narratifSchema.safeParse(last).success).toBe(true);
  });

  it('PNJ : « Copie » reporte `adapteDe` sur `source`', () => {
    mount({ ...emptyNarratif(), presetsPnj: [{ id: 'pnj-a', base: creatures[0].id, profil: { label: 'Alpha' }, adapteDe: REF }] });
    click(btn('PNJ'));
    click(btn('Alpha'));
    provenance('Copie', 'du PNJ');
    expect(last.presetsPnj[0]).toMatchObject({ source: REF, adapteDe: undefined });
    expect(narratifSchema.safeParse(last).success).toBe(true);
  });

  it('PNJ dont le profil ADRESSE sa description : « Adapté » refusé, sa raison dite ; sans adresse, offert', () => {
    const descRef = { book: 'ennemi-dans-l-ombre', ch: '01', parts: [{ kind: 'blocs', sec: 'le-proprietaire', secOcc: 2, b0: 0, b1: 0, sum: '38e48aee36c04e9f' }] };
    mount({ ...emptyNarratif(), presetsPnj: [
      { id: 'pnj-a', base: creatures[0].id, profil: { label: 'Alpha', desc: 'Un cocher.', descRef } as never, source: REF },
      { id: 'pnj-b', base: creatures[0].id, profil: { label: 'Bravo' }, source: REF },
    ] });
    click(btn('PNJ'));
    click(btn('Alpha'));
    const adapte = () => container.querySelector<HTMLButtonElement>('[aria-label="Adapté — provenance du PNJ"]')!;
    expect(adapte().getAttribute('aria-disabled')).toBe('true');
    expect(container.textContent).toContain('La description du profil est la copie adressée du livre.');
    click(adapte());
    expect(last.presetsPnj[0]).toMatchObject({ source: REF });
    expect(last.presetsPnj[0].adapteDe).toBeUndefined();
    click(btn('Bravo'));
    expect(adapte().getAttribute('aria-disabled')).toBeNull();
    click(adapte());
    expect(last.presetsPnj[1]).toMatchObject({ source: undefined, adapteDe: REF });
  });

  it('le document reste verbatim : sa source se saisit sans choix de provenance', () => {
    mount({ ...emptyNarratif(), documents: [{ id: 'doc', titre: 'Affiche', prose: 'VOYAGEURS' }] });
    click(btn('Documents'));
    click(btn('Affiche'));
    expect(container.querySelector('[aria-label="Livre de la source du document"]')).not.toBeNull();
    expect(container.querySelector('[aria-label$="— provenance du document"]')).toBeNull();
  });
});

describe('NarratifEditor — PNJ › surcharges : la caractéristique s’affiche par son abréviation', () => {
  it('chaque case porte `charAbr`, jamais l’id de caractéristique', () => {
    mount({ ...emptyNarratif(), presetsPnj: [{ id: 'pnj-a', base: creatures[0].id, profil: { label: 'Alpha' } }] });
    click(btn('PNJ'));
    click(btn('Alpha'));
    const cases = [...container.querySelectorAll('.statblock-grid .ed-subfield')].map((e) => e.textContent?.trim());
    expect(cases).toEqual(CHAR_KEYS.map((k) => charAbr(k)));
    expect(cases).not.toContain('capacite-de-combat');
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
    expect(btn('Ajouter un indice').getAttribute('aria-disabled')).toBe('true');
  });

  it('1 affaire : « Ajouter un indice » émet un bloc qui PARSE contre narratifSchema', () => {
    mount(withOneAffaire());
    click(btn('Indices'));
    const addIndice = btn('Ajouter un indice');
    expect(addIndice.getAttribute('aria-disabled')).toBeNull();
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

describe('NarratifEditor — onglet Documents et stade à document (#679)', () => {
  /** Le contrôle (`select`/`textarea`) de la plus PROCHE étiquette qui contient `libelle`. */
  function controle<T extends HTMLSelectElement | HTMLTextAreaElement>(tag: 'select' | 'textarea', libelle: string): T {
    const el = [...container.querySelectorAll(tag)].find((c) => c.closest('label')?.textContent?.includes(libelle));
    if (!el) throw new Error(`${tag} « ${libelle} » introuvable`);
    return el as T;
  }
  function saisir(el: HTMLSelectElement | HTMLTextAreaElement, value: string) {
    const proto = el instanceof HTMLSelectElement ? HTMLSelectElement.prototype : HTMLTextAreaElement.prototype;
    act(() => {
      Object.getOwnPropertyDescriptor(proto, 'value')!.set!.call(el, value);
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    });
  }
  const avecDocumentCroise = (): NarratifBlock => ({
    ...emptyNarratif(),
    affaires: [{ id: 'affaire-a', titre: 'La diligence' }],
    indices: [{ id: 'indice-a', affaireId: 'affaire-a', kind: 'indice', titre: 'L’affiche', stades: [{ id: 'vue', documentId: 'doc-affiche' }] }],
    documents: [{ id: 'doc-affiche', titre: 'L’affiche de la diligence', prose: 'VOYAGEURS' }],
  });

  it('ajoute, édite puis supprime un document ; le bloc rempli PARSE', () => {
    mount();
    click(btn('Documents'));
    click(btn('Ajouter un document'));
    expect(last.documents).toEqual([{ id: 'document-1', titre: 'Nouveau document', prose: '' }]);

    setValue(field('Titre'), 'L’affiche');
    saisir(controle('textarea', 'Texte'), '**Diligence** pour Altdorf');
    expect(last.documents[0]).toMatchObject({ id: 'document-1', titre: 'L’affiche', prose: '**Diligence** pour Altdorf' });
    expect(narratifSchema.safeParse(last).success).toBe(true);

    click(btn('Supprimer ce document'));
    expect(last.documents).toEqual([]);
  });

  it('la source d’un document : le livre se choisit dans les livres (SourceRefField), la page validée la complète, le bloc PARSE', () => {
    mount(avecDocumentCroise());
    click(btn('Documents'));
    saisir(livre('du document'), 'livre-de-base');
    expect(last.documents[0].source).toBeUndefined();
    poserPage('du document', '12');
    expect(last.documents[0].source).toEqual({ book: 'livre-de-base', page: 12 });
    expect(narratifSchema.safeParse(last).success).toBe(true);
  });

  it('un document qu’un stade croise ne se supprime pas', () => {
    mount(avecDocumentCroise());
    click(btn('Documents'));
    const supprimer = btn('Supprimer ce document');
    expect(supprimer.getAttribute('aria-disabled')).toBe('true');
    click(supprimer);
    expect(last.documents.map((d) => d.id)).toEqual(['doc-affiche']);
  });

  it('un stade croise un document par le sélecteur, sa prose devient facultative, et le bloc PARSE', () => {
    mount({ ...avecDocumentCroise(), indices: [{ ...avecDocumentCroise().indices[0], stades: [{ id: 'vue', prose: 'On lit l’affiche.' }] }] });
    click(btn('Indices'));
    const doc = controle<HTMLSelectElement>('select', 'Document croisé');
    expect([...doc.options].filter((o) => o.value !== '').map((o) => o.textContent)).toEqual(['L’affiche de la diligence']);
    saisir(doc, 'doc-affiche');
    expect(last.indices[0].stades[0]).toMatchObject({ documentId: 'doc-affiche', prose: 'On lit l’affiche.' });

    saisir(controle('textarea', 'Prose'), '');
    expect(last.indices[0].stades[0].prose).toBeUndefined();
    expect(narratifSchema.safeParse(last).success).toBe(true);
  });
});

describe('NarratifEditor — une entrée désignée par le projet : retrait refusé et nommé, renommage propagé (#679)', () => {
  const narratifDesigne = (): NarratifBlock => ({
    ...emptyNarratif(),
    affaires: [{ id: 'aff', titre: 'La route' }],
    indices: [{ id: 'ind-lettre', affaireId: 'aff', kind: 'indice', titre: 'La lettre', stades: [{ id: 'lue', prose: 'a' }, { id: 'dechiffree', prose: 'b' }] }],
    presetsPnj: [{ id: 'pnj-kastor', profil: { label: 'Kastor' } }],
    documents: [{ id: 'doc-affiche', titre: 'L’affiche', prose: 'VOYAGEURS' }],
  });
  /** Une scène qui désigne chaque registre : un déclencheur (document, indice + stade) et un PNJ à preset. */
  const salle = (): Scene => ({
    ...emptyScene(4, 4),
    id: 'salle',
    label: 'Le relais',
    entities: [{ id: 'kastor', kind: 'personnage', pos: { x: 1, y: 1 }, presetId: 'pnj-kastor' }],
    triggers: [{
      id: 't0', rect: { x: 0, y: 0, w: 1, h: 1 }, once: true,
      flow: { kind: 'seq', steps: [
        { kind: 'do', effect: { type: 'document', documentId: 'doc-affiche' } },
        { kind: 'do', effect: { type: 'revealClue', indiceId: 'ind-lettre', stade: 'dechiffree' } },
      ] },
    }],
  });
  const effets = () => {
    const flow = lastProjet.scenes[0].triggers[0].flow as { steps: { effect: Record<string, unknown> }[] };
    return flow.steps.map((s) => s.effect);
  };

  for (const [onglet, bouton] of [['Documents', 'Supprimer ce document'], ['Indices', 'Supprimer cet indice'], ['PNJ', 'Supprimer ce PNJ']] as const) {
    it(`${onglet} : le retrait est refusé, la raison nomme la scène qui désigne l’entrée`, () => {
      mount(narratifDesigne(), [salle()]);
      click(btn(onglet));
      const b = btn(bouton);
      expect(b.getAttribute('aria-disabled')).toBe('true');
      expect(container.textContent).toContain('Encore désigné par : scène « Le relais »');
      const avant = last;
      click(b);
      expect(last).toBe(avant);
    });
  }

  it('Documents : renommer l’id propage à l’Effect de la scène', () => {
    mount(narratifDesigne(), [salle()]);
    click(btn('Documents'));
    setValue(field('Identifiant'), 'doc-placard');
    expect(last.documents[0].id).toBe('doc-placard');
    expect(effets()[0]).toEqual({ type: 'document', documentId: 'doc-placard' });
  });

  it('Indices : renommer l’id, puis un stade, propage à l’Effect de la scène', () => {
    mount(narratifDesigne(), [salle()]);
    click(btn('Indices'));
    setValue(field('Identifiant'), 'ind-missive');
    expect(effets()[1]).toEqual({ type: 'revealClue', indiceId: 'ind-missive', stade: 'dechiffree' });
    const stade = [...container.querySelectorAll('label')].filter((l) => l.textContent?.includes('Id du stade'))[1].querySelector('input')!;
    setValue(stade, 'traduite');
    expect(last.indices[0].stades.map((s) => s.id)).toEqual(['lue', 'traduite']);
    expect(effets()[1]).toEqual({ type: 'revealClue', indiceId: 'ind-missive', stade: 'traduite' });
  });

  it('PNJ : renommer l’id propage au `presetId` de l’entité', () => {
    mount(narratifDesigne(), [salle()]);
    click(btn('PNJ'));
    setValue(field('Identifiant'), 'pnj-cousin');
    expect(lastProjet.scenes[0].entities[0].presetId).toBe('pnj-cousin');
  });
});

/** Le message lié à un champ refusé (`aria-invalid` + `aria-describedby`), ou `null`. */
function message(champ: HTMLInputElement | HTMLSelectElement): string | null {
  if (champ.getAttribute('aria-invalid') !== 'true') return null;
  return document.getElementById(champ.getAttribute('aria-describedby') ?? '')?.textContent ?? null;
}
