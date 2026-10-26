// @vitest-environment jsdom
/**
 * Saisie libre à suggestions (`SaisieSuggeree`, `RefField.tsx`) : le champ propose chacune de ses
 * suggestions dans SA `<datalist>`, émet la saisie brute, et sans suggestions reste un `<input>` nu.
 * Les listes de Traits de l'atelier (`TraitListField`, `OptionalsListField`) la composent : la chaîne
 * saisie s'écrit par `parseTraitInstance` (LDB 85, « Arme (Épée) +7 »), et la notation composée d'un
 * optionnel reste en lecture seule ; chaque libellé n'est proposé qu'une fois, les rangées d'un champ
 * partagent UNE datalist, et une écriture au catalogue (`setDataset`) rafraîchit les suggestions.
 */
import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import { act, useState, type JSX } from 'react';
import { createRoot } from 'react-dom/client';
import { SaisieSuggeree } from './RefField';
import { TraitListField, OptionalsListField } from '../../editor/codex/StructFields';
import { resetData, setDataset } from '../../../data/overrides';
import { parseTraitInstance } from '../../editor/refFormatLivre';
import type { OptionalEntry, TraitInstance } from '../../../engine/statEntry';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const poserValeur = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
const montes: (() => void)[] = [];
afterEach(() => { montes.splice(0).forEach((demonter) => demonter()); resetData(); });

function monter(element: JSX.Element) {
  const host = document.createElement('div');
  document.body.appendChild(host);
  const root = createRoot(host);
  act(() => { root.render(element); });
  montes.push(() => { act(() => { root.unmount(); }); host.remove(); });
  return host;
}
const saisir = (champ: HTMLInputElement, texte: string) => act(() => {
  poserValeur.call(champ, texte);
  champ.dispatchEvent(new Event('input', { bubbles: true }));
});
/** Les valeurs de la datalist que le DOCUMENT résout pour ce champ. */
const suggestionsDe = (champ: HTMLInputElement): string[] =>
  [...(document.getElementById(champ.getAttribute('list') ?? '')?.querySelectorAll('option') ?? [])].map((o) => (o as HTMLOptionElement).value);

describe('SaisieSuggeree', () => {
  it('propose une option par suggestion et émet la saisie brute, espaces compris', () => {
    const emises: string[] = [];
    function Hote() {
      const [v, setV] = useState('');
      return <SaisieSuggeree ariaLabel="Nom" suggestions={['Peur', 'Arme', 'Peur']} value={v} onChange={(n) => { emises.push(n); setV(n); }} />;
    }
    const host = monter(<Hote />);
    const champ = host.querySelector<HTMLInputElement>('input[aria-label="Nom"]')!;
    expect(suggestionsDe(champ)).toEqual(['Peur', 'Arme', 'Peur']);
    saisir(champ, 'Arme (Épée) +7 ');
    expect(emises).toEqual(['Arme (Épée) +7 ']);
    expect(champ.value).toBe('Arme (Épée) +7 ');
  });

  it('deux instances résolvent chacune SA datalist', () => {
    const host = monter(<>
      <SaisieSuggeree ariaLabel="A" suggestions={['a']} value="" onChange={() => {}} />
      <SaisieSuggeree ariaLabel="B" suggestions={['b']} value="" onChange={() => {}} />
    </>);
    const [a, b] = [...host.querySelectorAll<HTMLInputElement>('input')];
    expect([suggestionsDe(a), suggestionsDe(b)]).toEqual([['a'], ['b']]);
  });

  it('sans suggestions, un champ nu : ni liste ni datalist', () => {
    const host = monter(<SaisieSuggeree ariaLabel="Nu" value="x" onChange={() => {}} />);
    expect(host.querySelector('input')!.hasAttribute('list')).toBe(false);
    expect(host.querySelector('datalist')).toBeNull();
  });
});

/** Traits NOMMÉS du banc, écrits à la main, dont deux homonymes : seuls `id` et `label` portent le contrat. */
const traitDeBanc = (id: string, label: string) => ({ id, type: 'traits' as const, label, desc: 'Description de banc.', source: { book: 'livre-de-base', page: 1 } });
const libellesDeTraits = ['Peur', 'Arme'];

describe('listes de Traits de l’atelier', () => {
  beforeEach(() => setDataset('traits', [traitDeBanc('peur', 'Peur'), traitDeBanc('peur-bis', 'Peur'), traitDeBanc('arme', 'Arme')]));

  it('TraitListField : chaque rangée propose les libellés des Traits, la chaîne saisie s’écrit par parseTraitInstance', () => {
    const ecrits: TraitInstance[][] = [];
    const host = monter(<TraitListField label="Traits" value={[{ id: '' }]} onChange={(v) => ecrits.push(v)} />);
    const champ = host.querySelector<HTMLInputElement>('.trait-row input')!;
    expect(suggestionsDe(champ)).toEqual(libellesDeTraits);
    saisir(champ, 'Arme (Épée) +7');
    expect(ecrits).toEqual([[parseTraitInstance('Arme (Épée) +7')]]);
  });

  it('TraitListField : les rangées désignent UNE datalist partagée', () => {
    const host = monter(<TraitListField label="Traits" value={[{ id: '' }, { id: '' }]} onChange={() => {}} />);
    const [a, b] = [...host.querySelectorAll<HTMLInputElement>('.trait-row input')];
    expect(b.getAttribute('list')).toBe(a.getAttribute('list'));
    expect(suggestionsDe(b)).toEqual(libellesDeTraits);
    expect(host.querySelectorAll('datalist')).toHaveLength(1);
  });

  it('TraitListField : des suggestions fournies remplacent celles du catalogue', () => {
    const host = monter(<TraitListField label="Atouts" value={[{ id: '' }]} suggestions={['Résistant']} onChange={() => {}} />);
    expect(suggestionsDe(host.querySelector<HTMLInputElement>('.trait-row input')!)).toEqual(['Résistant']);
  });

  it.each([
    ['TraitListField', <TraitListField key="t" label="Traits" value={[{ id: '' }]} onChange={() => {}} />],
    ['OptionalsListField', <OptionalsListField key="o" label="Optionnels" value={[{ id: '' }]} onChange={() => {}} />],
  ])('%s : un Trait écrit au catalogue après le montage s’ajoute aux suggestions', (_, element) => {
    const host = monter(element);
    act(() => setDataset('traits', [traitDeBanc('peur', 'Peur'), traitDeBanc('arme', 'Arme'), traitDeBanc('venin', 'Venin')]));
    expect(suggestionsDe(host.querySelector<HTMLInputElement>('.trait-row input')!)).toEqual(['Peur', 'Arme', 'Venin']);
  });

  it('OptionalsListField : la note composée reste en lecture seule, le Trait ordinaire s’écrit par parseTraitInstance', () => {
    const note: OptionalEntry = { note: 'all-traits', label: 'Tous les traits' };
    const ecrits: OptionalEntry[][] = [];
    const host = monter(<OptionalsListField label="Optionnels" value={[note, { id: '' }]} onChange={(v) => ecrits.push(v)} />);
    const champs = host.querySelectorAll<HTMLInputElement>('.trait-row input');
    expect(champs).toHaveLength(1);
    expect(suggestionsDe(champs[0])).toEqual(libellesDeTraits);
    saisir(champs[0], 'Peur 3');
    expect(ecrits).toEqual([[note, parseTraitInstance('Peur 3')]]);
  });
});

/** Le catalogue RÉEL des Traits : l'argument d'un Trait à registre fait l'aller-retour libellé ⇄ id (LDB 85 l.85, l.423). */
describe('listes de Traits de l’atelier — argument de registre', () => {
  it.each([
    ['TraitListField', (onChange: (v: OptionalEntry[]) => void, value: TraitInstance[]) => <TraitListField label="Traits" value={value} onChange={onChange} />],
    ['OptionalsListField', (onChange: (v: OptionalEntry[]) => void, value: TraitInstance[]) => <OptionalsListField label="Optionnels" value={value} onChange={onChange} />],
  ])('%s : une rangée de Trait à registre s’affiche au libellé et se réécrit à l’id (Corruption, Venin, Souffle)', (_, element) => {
    const value: TraitInstance[] = [{ id: 'corruption', arg: 'moderee' }, { id: 'venin', arg: 'difficile' }, { id: 'souffle', value: 12, arg: 'feu' }];
    const ecrits: OptionalEntry[][] = [];
    const host = monter(element((v) => ecrits.push(v), value));
    const champs = [...host.querySelectorAll<HTMLInputElement>('.trait-row input')];
    expect(champs.map((c) => c.value)).toEqual(['Corruption (Modérée)', 'Venin (Difficile)', 'Souffle +12 (Feu)']);
    saisir(champs[0], 'Corruption (Majeure)');
    expect(ecrits[ecrits.length - 1]?.[0]).toEqual({ id: 'corruption', arg: 'majeure' });
  });
});
