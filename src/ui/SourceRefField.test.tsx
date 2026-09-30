// @vitest-environment jsdom
/**
 * `SourceRefField` — l'UNIQUE éditeur d'une réf de source `{book, page, note?}` (#1993) : atelier du
 * Codex (champ `source`, emplacements secondaires, variantes) et éditeur narratif (ouverture, stade,
 * PNJ). Contrat : seule une réf COMPLÈTE (livre du registre, page ≥ 1) est émise ; une saisie
 * incomplète n'est jamais perdue — facultative, elle émet `undefined` ; exigée, elle n'émet rien et le
 * champ se dit incomplet. Les clés du porteur (`quote` d'un `SecondaryRef`) gardent leur place.
 */
import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import { act, useState, type ReactElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { SourceRefField } from './SourceRefField';
import { CodexEdit } from './compendium/CodexEdit';
import { datasetArray, setDataset } from '../data/overrides';
import { psychologies } from '../data';
import type { SecondaryRef, SourceRef } from '../data/schemas/grammaire/valeurs';

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
});
function monter(el: ReactElement) {
  container = document.createElement('div');
  document.body.appendChild(container);
  const r = createRoot(container);
  root = r;
  act(() => { r.render(el); });
}
function saisir(el: HTMLInputElement | HTMLSelectElement, valeur: string) {
  const proto = el instanceof HTMLSelectElement ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(proto, 'value')!.set!;
  act(() => {
    setter.call(el, valeur);
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  });
}
/** Geste TERMINAL sur un champ (perte de focus) : la page d'une source ne part qu'à ce geste. */
function valider(el: HTMLInputElement) {
  act(() => { el.dispatchEvent(new FocusEvent('focusout', { bubbles: true })); });
}
/** Page tapée PUIS validée — la seule qu'une source émet. */
function poserPage(el: HTMLInputElement, valeur: string) {
  saisir(el, valeur);
  valider(el);
}
function champ<E extends HTMLInputElement | HTMLSelectElement = HTMLInputElement>(nom: string): E {
  const el = container!.querySelector<E>(`[aria-label="${nom}"]`);
  if (!el) throw new Error(`champ « ${nom} » introuvable`);
  return el;
}
const livre = (nom: string) => champ<HTMLSelectElement>(nom);
const incomplet = () => container!.querySelector('[role="status"]')?.textContent ?? null;

let facultative: SourceRef | undefined;
let emissions = 0;
function Facultative({ initiale }: { initiale?: SourceRef }) {
  const [v, setV] = useState<SourceRef | undefined>(initiale);
  facultative = v;
  return <SourceRefField identite="témoin" label="Source" facultative sujet="du témoin" value={v} onChange={(s) => { emissions++; setV(s); }} />;
}
let porteurs: Record<string, SourceRef | undefined> = {};
function Porteurs({ cle }: { cle: string }) {
  const [vals, setVals] = useState<Record<string, SourceRef | undefined>>({});
  porteurs = vals;
  return <SourceRefField identite={cle} label="Source" facultative sujet="du témoin" value={vals[cle]} onChange={(s) => setVals((v) => ({ ...v, [cle]: s }))} />;
}
let secondaire: SecondaryRef;
function Secondaire({ initiale }: { initiale: SecondaryRef }) {
  const [v, setV] = useState<SecondaryRef>(initiale);
  secondaire = v;
  return <SourceRefField identite="témoin" label="Emplacement 1" sujet="du témoin" value={v} onChange={(s) => { emissions++; setV(s); }} />;
}

describe('SourceRefField — seule une réf complète est émise, la saisie ne se perd jamais', () => {
  it('le livre se CHOISIT dans le registre `books.json` (RefField), jamais une frappe d’id', () => {
    monter(<Facultative />);
    const options = [...livre('Livre de la source du témoin').options].map((o) => o.value);
    expect(options).toContain('livre-de-base');
    expect(options).toContain('');
  });

  it('facultative : le livre seul n’émet rien de complet ; la page VALIDÉE le complète ; « aucun » retire la source', () => {
    monter(<Facultative />);
    saisir(livre('Livre de la source du témoin'), 'livre-de-base');
    expect(facultative).toBeUndefined();
    expect(incomplet()).toContain('incomplète');
    saisir(champ('Page de la source du témoin'), '12');
    expect(facultative, 'une page tapée, non validée, a été émise').toBeUndefined();
    valider(champ('Page de la source du témoin'));
    expect(facultative).toEqual({ book: 'livre-de-base', page: 12 });
    expect(incomplet()).toBeNull();
    saisir(livre('Livre de la source du témoin'), '');
    expect(facultative).toBeUndefined();
    expect(incomplet(), 'un champ facultatif vide n’est pas incomplet').toBeNull();
  });

  it('facultative : une note seule émet `undefined` et reste à l’écran ; le livre et la page la posent', () => {
    monter(<Facultative />);
    saisir(champ('Note de la source du témoin'), 'ch. 4 l.12');
    expect(facultative).toBeUndefined();
    expect(champ('Note de la source du témoin').value).toBe('ch. 4 l.12');
    saisir(livre('Livre de la source du témoin'), 'livre-de-base');
    poserPage(champ('Page de la source du témoin'), '3');
    expect(facultative).toEqual({ book: 'livre-de-base', page: 3, note: 'ch. 4 l.12' });
  });

  it('une page 0 n’est pas un folio : rien de complet n’est émis', () => {
    monter(<Facultative />);
    saisir(livre('Livre de la source du témoin'), 'livre-de-base');
    poserPage(champ('Page de la source du témoin'), '0');
    expect(facultative).toBeUndefined();
    expect(incomplet()).toContain('incomplète');
  });

  it('facultative : « aucun » au livre retire la source en UN geste — livre, page et note se vident, rien n’est incomplet', () => {
    monter(<Facultative initiale={{ book: 'livre-de-base', page: 4, note: 'ch. 4 l.12' }} />);
    saisir(livre('Livre de la source du témoin'), '');
    expect(facultative).toBeUndefined();
    expect(champ('Page de la source du témoin').value).toBe('');
    expect(champ('Note de la source du témoin').value).toBe('');
    expect(incomplet()).toBeNull();
  });

  it('incomplète : `aria-invalid` sur le SEUL champ manquant, décrit par le message', () => {
    monter(<Facultative />);
    saisir(livre('Livre de la source du témoin'), 'livre-de-base');
    const message = container!.querySelector('[role="status"]')!;
    expect(champ('Page de la source du témoin').getAttribute('aria-invalid')).toBe('true');
    expect(champ('Page de la source du témoin').getAttribute('aria-describedby')).toBe(message.id);
    expect(livre('Livre de la source du témoin').getAttribute('aria-invalid')).toBeNull();
    poserPage(champ('Page de la source du témoin'), '12');
    expect(champ('Page de la source du témoin').getAttribute('aria-invalid')).toBeNull();
    expect(livre('Livre de la source du témoin').getAttribute('aria-invalid')).toBeNull();
  });

  it('incomplète par le livre : `aria-invalid` sur le Livre seul', () => {
    monter(<Facultative />);
    poserPage(champ('Page de la source du témoin'), '12');
    expect(livre('Livre de la source du témoin').getAttribute('aria-invalid')).toBe('true');
    expect(champ('Page de la source du témoin').getAttribute('aria-invalid')).toBeNull();
  });

  it('exigée : un brouillon incomplet n’émet RIEN et se dit incomplet ; les clés du porteur gardent leur place', () => {
    emissions = 0;
    monter(<Secondaire initiale={{ book: 'aux-armes', page: 91, note: 'ch. 3', quote: 'Cimeterre' }} />);
    poserPage(champ('Page de la source du témoin'), '90');
    expect(Object.keys(secondaire)).toEqual(['book', 'page', 'note', 'quote']);
    expect(secondaire).toEqual({ book: 'aux-armes', page: 90, note: 'ch. 3', quote: 'Cimeterre' });
    const avant = emissions;
    poserPage(champ('Page de la source du témoin'), '0');
    expect(emissions, 'un brouillon exigé incomplet a été émis').toBe(avant);
    expect(secondaire.page).toBe(90);
    expect(incomplet()).toContain('incomplète');
    poserPage(champ('Page de la source du témoin'), '88');
    saisir(champ('Note de la source du témoin'), '');
    expect(secondaire).toEqual({ book: 'aux-armes', page: 88, quote: 'Cimeterre' });
    expect('note' in secondaire).toBe(false);
  });

  it('sans `sujet`, les noms accessibles dérivent du libellé : deux instances ne se confondent pas', () => {
    monter(
      <>
        <SourceRefField identite="a" label="Source A" value={{ book: 'aux-armes', page: 1 }} onChange={() => {}} />
        <SourceRefField identite="b" label="Source B" value={{ book: 'aux-armes', page: 2 }} onChange={() => {}} />
      </>,
    );
    expect(champ('Page — Source A').value).toBe('1');
    expect(champ('Page — Source B').value).toBe('2');
  });

  it('un AUTRE porteur (`identite`) repart de sa valeur : le brouillon du premier ne s’affiche ni ne s’émet sur le second', () => {
    monter(<Porteurs cle="a" />);
    saisir(livre('Livre de la source du témoin'), 'livre-de-base');
    act(() => { root!.render(<Porteurs cle="b" />); });
    expect(livre('Livre de la source du témoin').value, 'le livre de A s’affiche sur B').toBe('');
    poserPage(champ('Page de la source du témoin'), '12');
    expect(porteurs.b, 'la page tapée sur B a posé le livre de A').toBeUndefined();
    expect(porteurs.a).toBeUndefined();
  });

  it('le message nomme la source RETENUE, jamais une valeur « enregistrée »', () => {
    monter(<Secondaire initiale={{ book: 'aux-armes', page: 91, quote: 'Cimeterre' }} />);
    poserPage(champ('Page de la source du témoin'), '0');
    expect(incomplet()).toContain('Cette saisie n\'est pas retenue ; la source retenue reste « ');
    expect(incomplet()).toContain(' p. 91 »');
    expect(incomplet()).not.toContain('enregistr');
  });

  it('page effacée chiffre par chiffre : aucune valeur intermédiaire n’est émise, seule la page validée part', () => {
    emissions = 0;
    monter(<Secondaire initiale={{ book: 'aux-armes', page: 79, quote: 'Cimeterre' }} />);
    const page = champ('Page de la source du témoin');
    saisir(page, '7');
    saisir(page, '');
    saisir(page, '8');
    expect(emissions, 'une valeur intermédiaire de frappe a été émise').toBe(0);
    expect(secondaire.page).toBe(79);
    expect(incomplet(), 'une frappe en cours se dit déjà « non retenue » avant tout geste').toBeNull();
    valider(page);
    expect(emissions).toBe(1);
    expect(secondaire).toEqual({ book: 'aux-armes', page: 8, quote: 'Cimeterre' });
  });

  it('page vidée puis validée : la page retenue revient à l’écran, rien n’est émis', () => {
    emissions = 0;
    monter(<Secondaire initiale={{ book: 'aux-armes', page: 79, quote: 'Cimeterre' }} />);
    poserPage(champ('Page de la source du témoin'), '');
    expect(emissions).toBe(0);
    expect(champ('Page de la source du témoin').value).toBe('79');
    expect(incomplet()).toBeNull();
  });
});

describe('atelier du Codex — le champ `source` et les variantes composent la primitive', () => {
  const TERREUR = psychologies.find((p) => p.id === 'terreur')!;

  it('champ `source` exigé : la note s’édite ; une page sans folio n’est pas émise et reste à l’écran incomplète', () => {
    expect(TERREUR.source?.book, 'l’entrée n’a pas de source — la sonde mesurerait un cas absent').toBeTruthy();
    monter(<CodexEdit categoryKey="psychologies" id={TERREUR.id} onClose={() => {}} />);
    const nom = (c: string) => [...container!.querySelectorAll('[aria-label]')].map((e) => e.getAttribute('aria-label')!).find((n) => n.startsWith(`${c} — `))!;
    expect(livre(nom('Livre')).value).toBe(TERREUR.source!.book);
    saisir(champ(nom('Note')), 'ch. 14 l.3');
    poserPage(champ(nom('Page')), '0');
    expect(champ(nom('Page')).value).toBe('0');
    expect(champ(nom('Note')).value).toBe('ch. 14 l.3');
    expect(livre(nom('Livre')).value).toBe(TERREUR.source!.book);
    expect(incomplet()).toContain('incomplète');
  });

  it('emplacements secondaires : chaque rangée porte des noms accessibles distincts (livre, citation, retrait)', () => {
    type Talent = { id: string; label: string; alsoIn?: SecondaryRef[] };
    const cible = (datasetArray('talents') as Talent[]).find((t) => t.id === 'empreint-d-ulgu')!;
    expect(cible.alsoIn?.length, 'l’entrée mesurée n’a pas d’emplacement secondaire').toBe(1);
    monter(<CodexEdit categoryKey="talents" id={cible.id} onClose={() => {}} />);
    const ajouter = [...container!.querySelectorAll('button')].find((b) => b.textContent?.includes('Emplacement secondaire'))!;
    act(() => { ajouter.click(); });
    for (const n of [1, 2]) {
      expect(container!.querySelectorAll(`[aria-label="Livre de la source de l'emplacement ${n}"]`)).toHaveLength(1);
      expect(container!.querySelectorAll(`[aria-label="Citation de l'emplacement ${n}"]`)).toHaveLength(1);
      expect(container!.querySelectorAll(`[aria-label="Retirer l'emplacement ${n}"]`)).toHaveLength(1);
    }
    expect(champ('Citation de l\'emplacement 1').value).toBe(cible.alsoIn![0].quote ?? '');
  });

  it('emplacements secondaires : une rangée ajoutée est un BROUILLON qui n’émet rien ; complétée, elle est émise avec la citation déjà saisie', async () => {
    type Talent = { id: string; label: string; alsoIn?: SecondaryRef[] };
    const avant = (datasetArray('talents') as Talent[]).slice();
    const cible = avant.find((t) => t.id === 'empreint-d-ulgu')!;
    expect(cible.alsoIn?.length, 'l’entrée mesurée n’a pas d’emplacement secondaire').toBe(1);
    try {
      monter(<CodexEdit categoryKey="talents" id={cible.id} onClose={() => {}} />);
      const enregistrer = () => container!.querySelector<HTMLButtonElement>('.codex-edit-bar button.btn-primary')!;
      const ajouter = [...container!.querySelectorAll('button')].find((b) => b.textContent?.includes('Emplacement secondaire'))!;
      act(() => { ajouter.click(); });
      saisir(champ('Citation de l\'emplacement 2'), 'citation neuve');
      expect(enregistrer().disabled, 'une rangée incomplète a été émise dans l’entrée').toBe(true);
      expect(champ('Citation de l\'emplacement 2').value, 'la citation du brouillon s’est perdue').toBe('citation neuve');
      saisir(livre('Livre de la source de l\'emplacement 2'), 'livre-de-base');
      expect(enregistrer().disabled, 'un livre sans page a été émis').toBe(true);
      poserPage(champ('Page de la source de l\'emplacement 2'), '12');
      expect(enregistrer().disabled, 'la rangée complète n’a pas été émise').toBe(false);
      await act(async () => { enregistrer().click(); });
      const posee = (datasetArray('talents') as Talent[]).find((t) => t.id === 'empreint-d-ulgu')!;
      expect(JSON.parse(JSON.stringify(posee.alsoIn))).toEqual([
        JSON.parse(JSON.stringify(cible.alsoIn![0])),
        { book: 'livre-de-base', page: 12, quote: 'citation neuve' },
      ]);
    } finally {
      setDataset('talents', avant as never);
    }
  });

  it('variante : « aucun » au livre retire la source en UN geste — Enregistrer actif, la variante enregistrée n’en porte pas ; une note seule, elle, bloque', async () => {
    type Talent = { id: string; label: string; variants?: { source?: SourceRef }[] };
    const avant = (datasetArray('talents') as Talent[]).slice();
    const cible = avant.find((t) => t.id === 'artilleur')!;
    expect(cible.variants?.[0]?.source, 'la variante mesurée n’a pas de source — le geste ne retirerait rien').toBeTruthy();
    try {
      monter(<CodexEdit categoryKey="talents" id={cible.id} onClose={() => {}} />);
      const enregistrer = () => container!.querySelector<HTMLButtonElement>('.codex-edit-bar button.btn-primary')!;
      saisir(livre('Livre de la source de la variante 1'), '');
      expect(champ('Page de la source de la variante 1').value).toBe('');
      expect(champ('Note de la source de la variante 1').value).toBe('');
      expect(incomplet()).toBeNull();
      expect(enregistrer().disabled, 'le retrait demande encore un geste').toBe(false);
      saisir(champ('Note de la source de la variante 1'), 'ch. 5');
      expect(incomplet()).toContain('la source retenue reste sans source');
      expect(enregistrer().disabled, 'Enregistrer perdrait la note tapée').toBe(true);
      saisir(champ('Note de la source de la variante 1'), '');
      expect(enregistrer().disabled, 'Enregistrer est resté inerte — le save n’a pas été joué').toBe(false);
      await act(async () => { enregistrer().click(); });
      const posee = (datasetArray('talents') as Talent[]).find((t) => t.id === 'artilleur')!;
      expect(posee, 'le save n’a rien posé en mémoire').not.toBe(cible);
      expect(JSON.parse(JSON.stringify(posee.variants![0])).source).toBeUndefined();
    } finally {
      setDataset('talents', avant as never);
    }
  });

  it('emplacements secondaires : une rangée incomplète bloque Enregistrer, même quand une autre édition rend l’entrée modifiée', () => {
    type Talent = { id: string; label: string; alsoIn?: SecondaryRef[] };
    const cible = (datasetArray('talents') as Talent[]).find((t) => t.id === 'empreint-d-ulgu')!;
    expect(cible.alsoIn?.length, 'l’entrée mesurée n’a pas d’emplacement secondaire').toBe(1);
    monter(<CodexEdit categoryKey="talents" id={cible.id} onClose={() => {}} />);
    const enregistrer = () => container!.querySelector<HTMLButtonElement>('.codex-edit-bar button.btn-primary')!;
    const ajouter = [...container!.querySelectorAll('button')].find((b) => b.textContent?.includes('Emplacement secondaire'))!;
    act(() => { ajouter.click(); });
    saisir(livre('Livre de la source de l\'emplacement 2'), 'livre-de-base');
    saisir(champ('Citation de l\'emplacement 1'), 'autre citation');
    expect(enregistrer().disabled, 'la rangée incomplète serait perdue à l’enregistrement').toBe(true);
    expect(container!.querySelector('.codex-edit-errors')?.textContent).toContain('Une saisie en cours n\'est pas retenue');
  });

  it('emplacements secondaires : une page sans folio d’une rangée complète reste un brouillon, que la citation éditée à côté n’efface pas', () => {
    type Talent = { id: string; label: string; alsoIn?: SecondaryRef[] };
    const cible = (datasetArray('talents') as Talent[]).find((t) => t.id === 'empreint-d-ulgu')!;
    const pose = cible.alsoIn![0];
    monter(<CodexEdit categoryKey="talents" id={cible.id} onClose={() => {}} />);
    const enregistrer = () => container!.querySelector<HTMLButtonElement>('.codex-edit-bar button.btn-primary')!;
    poserPage(champ('Page de la source de l\'emplacement 1'), '0');
    expect(incomplet()).toContain(`la source retenue reste « `);
    expect(incomplet()).toContain(` p. ${pose.page}`);
    saisir(champ('Citation de l\'emplacement 1'), 'citation modifiée');
    expect(champ('Page de la source de l\'emplacement 1').value, 'la page du brouillon est revenue en silence').toBe('0');
    expect(enregistrer().disabled, 'Enregistrer poserait l’ancienne page sous la page vidée').toBe(true);
  });

  it('dataset à source FACULTATIVE : une entrée sans source ne se dit pas incomplète', () => {
    type Regle = { id: string; label: string; source?: SourceRef };
    const sans = (datasetArray('reglesOptionnelles') as unknown as Regle[]).find((r) => !r.source)!;
    expect(sans, 'aucune règle optionnelle sans source — la sonde mesurerait un cas absent').toBeTruthy();
    monter(<CodexEdit categoryKey="reglesOptionnelles" id={sans.id} onClose={() => {}} />);
    const nom = (c: string) => [...container!.querySelectorAll('[aria-label]')].map((e) => e.getAttribute('aria-label')!).find((n) => n.startsWith(`${c} — `))!;
    expect(livre(nom('Livre')).value).toBe('');
    expect(incomplet(), 'une source facultative absente est dite incomplète').toBeNull();
  });

  it('dataset à source FACULTATIVE : « aucun » retire la source posée en un geste, sans saisie en cours', () => {
    type Regle = { id: string; label: string; source?: SourceRef };
    const avec = (datasetArray('reglesOptionnelles') as unknown as Regle[]).find((r) => r.source)!;
    monter(<CodexEdit categoryKey="reglesOptionnelles" id={avec.id} onClose={() => {}} />);
    const nom = (c: string) => [...container!.querySelectorAll('[aria-label]')].map((e) => e.getAttribute('aria-label')!).find((n) => n.startsWith(`${c} — `))!;
    const choix = livre(nom('Livre'));
    expect([...choix.options].find((o) => o.value === '')?.textContent).toContain('aucun');
    saisir(choix, '');
    expect(champ(nom('Page')).value).toBe('');
    expect(incomplet()).toBeNull();
    expect(container!.querySelector('.codex-edit-bar button.btn-primary')!.hasAttribute('disabled')).toBe(false);
  });

  it('deux entrées sans source : le brouillon de l’une ne passe pas à l’autre', () => {
    type Regle = { id: string; label: string; source?: SourceRef };
    const [a, b] = (datasetArray('reglesOptionnelles') as unknown as Regle[]).filter((r) => !r.source);
    expect(b, 'moins de deux règles optionnelles sans source').toBeTruthy();
    monter(<CodexEdit categoryKey="reglesOptionnelles" id={a.id} onClose={() => {}} />);
    const nom = (c: string) => [...container!.querySelectorAll('[aria-label]')].map((e) => e.getAttribute('aria-label')!).find((n) => n.startsWith(`${c} — `))!;
    saisir(livre(nom('Livre')), 'livre-de-base');
    act(() => { root!.render(<CodexEdit categoryKey="reglesOptionnelles" id={b.id} onClose={() => {}} />); });
    expect(livre(nom('Livre')).value, 'le livre choisi sur A s’affiche sur B').toBe('');
    expect(incomplet()).toBeNull();
  });
});
