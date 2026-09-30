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
import { creatures } from '../../data';

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
function setValue(el: HTMLInputElement | HTMLSelectElement, value: string) {
  const proto = el instanceof HTMLSelectElement ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
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

  it('la source d’un document : le livre se choisit dans les livres (SourceRefField), le bloc PARSE', () => {
    mount(avecDocumentCroise());
    click(btn('Documents'));
    saisir(container.querySelector('select[aria-label="Source du document — livre"]') as HTMLSelectElement, 'livre-de-base');
    expect(last.documents[0].source).toEqual({ book: 'livre-de-base', page: 0 });
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
