// @vitest-environment jsdom
/**
 * Saisie libre à suggestions (`SaisieSuggeree`, `RefField.tsx`) : le champ propose chacune de ses
 * suggestions dans SA `<datalist>`, émet la saisie brute, et sans suggestions reste un `<input>` nu.
 * `SaisieEnBrouillon` la tient en brouillon, relu une seule fois à la fin de la saisie.
 * Les listes de Traits de l'atelier (`TraitListField`, `OptionalsListField`) la composent : la chaîne
 * saisie s'écrit par `parseTraitInstance` (LDB 85, « Arme (Épée) +7 »), et la notation composée d'un
 * optionnel reste en lecture seule ; chaque libellé n'est proposé qu'une fois, les rangées d'un champ
 * partagent UNE datalist, et une écriture au catalogue (`setDataset`) rafraîchit les suggestions.
 */
import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import { act, useState, type JSX } from 'react';
import { createRoot } from 'react-dom/client';
import { SaisieSuggeree } from './RefField';
import { SaisieEnBrouillon } from './SaisieEnBrouillon';
import { GameOpEditor, newOp } from '../../editor/GameOpEditor';
import type { GameOp } from '../../../engine/ops';
import { TraitListField, OptionalsListField } from '../../editor/codex/StructFields';
import { resetData, setDataset } from '../../../data/overrides';
import { parseTraitInstance, relireTrait, relireTraits } from '../../editor/refFormatLivre';
import type { OptionalEntry } from '../../../engine/statEntry';
import type { TraitPose } from '../../../data/schemas/grammaire/reference';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

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
type Champ = HTMLInputElement | HTMLTextAreaElement;
const saisir = (champ: Champ, texte: string) => act(() => {
  Object.getOwnPropertyDescriptor(Object.getPrototypeOf(champ), 'value')!.set!.call(champ, texte);
  champ.dispatchEvent(new Event('input', { bubbles: true }));
});
/** Frappe par frappe à partir du texte AFFICHÉ, comme un auteur : efface jusqu'au préfixe commun, puis
 *  tape le reste, chaque frappe relisant `champ.value`. Un champ qui réécrirait la saisie sous les doigts
 *  ne converge pas : la frappe s'arrête et le dit. */
const taper = (champ: Champ, cible: string) => {
  act(() => { champ.focus(); });
  for (let frappes = 0; champ.value !== cible; frappes++) {
    if (frappes > 4 * (cible.length + 20)) throw new Error(`saisie réécrite sous les doigts : « ${champ.value} » au lieu de « ${cible} »`);
    saisir(champ, cible.startsWith(champ.value) ? cible.slice(0, champ.value.length + 1) : champ.value.slice(0, -1));
  }
};
/** Fin de la saisie : le champ perd le focus. */
const valider = (champ: Champ) => act(() => { champ.blur(); });
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
    const ecrits: TraitPose[][] = [];
    const host = monter(<TraitListField chemin="banc/traits" label="Traits" value={[{ id: '' }]} onChange={(v) => ecrits.push(v)} />);
    const champ = host.querySelector<HTMLInputElement>('.trait-row input')!;
    expect(suggestionsDe(champ)).toEqual(libellesDeTraits);
    taper(champ, 'Arme (Épée) +7');
    expect(ecrits, 'aucune frappe ne s’émet').toEqual([]);
    valider(champ);
    expect(ecrits).toEqual([[parseTraitInstance('Arme (Épée) +7')]]);
  });

  it('TraitListField : les rangées désignent UNE datalist partagée', () => {
    const host = monter(<TraitListField chemin="banc/traits" label="Traits" value={[{ id: '' }, { id: '' }]} onChange={() => {}} />);
    const [a, b] = [...host.querySelectorAll<HTMLInputElement>('.trait-row input')];
    expect(b.getAttribute('list')).toBe(a.getAttribute('list'));
    expect(suggestionsDe(b)).toEqual(libellesDeTraits);
    expect(host.querySelectorAll('datalist')).toHaveLength(1);
  });

  it('TraitListField : des suggestions fournies remplacent celles du catalogue', () => {
    const host = monter(<TraitListField chemin="banc/traits" label="Atouts" value={[{ id: '' }]} suggestions={['Résistant']} onChange={() => {}} />);
    expect(suggestionsDe(host.querySelector<HTMLInputElement>('.trait-row input')!)).toEqual(['Résistant']);
  });

  it.each([
    ['TraitListField', <TraitListField key="t" chemin="banc/traits" label="Traits" value={[{ id: '' }]} onChange={() => {}} />],
    ['OptionalsListField', <OptionalsListField key="o" chemin="banc/optionals" label="Optionnels" value={[{ id: '' }]} onChange={() => {}} />],
  ])('%s : un Trait écrit au catalogue après le montage s’ajoute aux suggestions', (_, element) => {
    const host = monter(element);
    act(() => setDataset('traits', [traitDeBanc('peur', 'Peur'), traitDeBanc('arme', 'Arme'), traitDeBanc('venin', 'Venin')]));
    expect(suggestionsDe(host.querySelector<HTMLInputElement>('.trait-row input')!)).toEqual(['Peur', 'Arme', 'Venin']);
  });

  it('OptionalsListField : la note composée reste en lecture seule, le Trait ordinaire s’écrit par parseTraitInstance', () => {
    const note: OptionalEntry = { note: 'all-traits', label: 'Tous les traits' };
    const ecrits: OptionalEntry[][] = [];
    const host = monter(<OptionalsListField chemin="banc/optionals" label="Optionnels" value={[note, { id: '' }]} onChange={(v) => ecrits.push(v)} />);
    const champs = host.querySelectorAll<HTMLInputElement>('.trait-row input');
    expect(champs).toHaveLength(1);
    expect(suggestionsDe(champs[0])).toEqual(libellesDeTraits);
    taper(champs[0], 'Peur 3');
    valider(champs[0]);
    expect(ecrits).toEqual([[note, parseTraitInstance('Peur 3')]]);
  });

  /** La chaîne ne rend que l'id, l'Indice, l'Aspect, le compte et la portée (`formatTrait`) : réécrite
   *  sans en changer la valeur, la pose garde ses drapeaux et sa provenance ; une VALEUR nouvelle garde
   *  les drapeaux du Trait et perd la provenance, qui attestait l'ancienne (`relireTrait`). */
  it.each([
    ['TraitListField', (onChange: (v: OptionalEntry[]) => void, value: TraitPose[]) => <TraitListField chemin="banc/traits" label="Traits" value={value} onChange={onChange} />],
    ['OptionalsListField', (onChange: (v: OptionalEntry[]) => void, value: TraitPose[]) => <OptionalsListField chemin="banc/optionals" label="Optionnels" value={value} onChange={onChange} />],
  ])('%s : la provenance survit à la même valeur, tombe à une valeur nouvelle ; les drapeaux restent', (_, element) => {
    const pose: TraitPose = {
      id: 'arme', value: 2, natural: true, hidden: true,
      source: { book: 'livre-de-base', page: 1 },
      alsoIn: [{ book: 'livre-de-base', page: 2, quote: 'une preuve' }],
      maison: 'Raison de banc.',
    };
    const ecrits: OptionalEntry[][] = [];
    const host = monter(element((v) => ecrits.push(v), [pose]));
    const champ = host.querySelector<HTMLInputElement>('.trait-row input')!;
    taper(champ, 'Arme +2 ');
    valider(champ);
    expect(ecrits[ecrits.length - 1]).toEqual([pose]);
    taper(champ, 'Arme +3');
    valider(champ);
    expect(ecrits[ecrits.length - 1]).toEqual([{ id: 'arme', value: 3, natural: true, hidden: true }]);
  });

  /** Ce que la chaîne ne dit pas s'ÉCRIT au clic (garde #841, `scene-field-editability-guard`) : les
   *  drapeaux de la pose sont des cases, sa provenance les champs de `ProvenanceDeValeur`/`AlsoInField`. */
  it('TraitListField : les drapeaux de la pose s’écrivent au clic, sous le repli de la rangée', () => {
    const ecrits: TraitPose[][] = [];
    const host = monter(<TraitListField chemin="banc/traits" label="Traits" value={[{ id: 'arme' }]} onChange={(v) => ecrits.push(v)} />);
    const cases = [...host.querySelectorAll<HTMLInputElement>('.fold-body input[type="checkbox"]')];
    expect(cases).toHaveLength(2);
    act(() => { cases[0].click(); });
    expect(ecrits[ecrits.length - 1]).toEqual([{ id: 'arme', natural: true }]);
    act(() => { cases[1].click(); });
    expect(ecrits[ecrits.length - 1]).toEqual([{ id: 'arme', hidden: true }]);
  });
});

/** Le catalogue RÉEL des Traits : l'argument d'un Trait à registre fait l'aller-retour libellé ⇄ id (LDB 85 l.85, l.423). */
describe('listes de Traits de l’atelier — argument de registre', () => {
  it.each([
    ['TraitListField', (onChange: (v: OptionalEntry[]) => void, value: TraitPose[]) => <TraitListField chemin="banc/traits" label="Traits" value={value} onChange={onChange} />],
    ['OptionalsListField', (onChange: (v: OptionalEntry[]) => void, value: TraitPose[]) => <OptionalsListField chemin="banc/optionals" label="Optionnels" value={value} onChange={onChange} />],
  ])('%s : une rangée de Trait à registre s’affiche au libellé et se réécrit à l’id (Corruption, Venin, Souffle)', (_, element) => {
    const value: TraitPose[] = [{ id: 'corruption', arg: 'moderee' }, { id: 'venin', arg: 'difficile' }, { id: 'souffle', value: 12, arg: 'feu' }];
    const ecrits: OptionalEntry[][] = [];
    const host = monter(element((v) => ecrits.push(v), value));
    const champs = [...host.querySelectorAll<HTMLInputElement>('.trait-row input')];
    expect(champs.map((c) => c.value)).toEqual(['Corruption (Modérée)', 'Venin (Difficile)', 'Souffle +12 (Feu)']);
    taper(champs[0], 'Corruption (Majeure)');
    valider(champs[0]);
    expect(ecrits[ecrits.length - 1]?.[0]).toEqual({ id: 'corruption', arg: 'majeure' });
  });
});

/** Ce que la chaîne ne dit pas ne passe JAMAIS d'un Trait à un autre (catalogue RÉEL) : les drapeaux
 *  suivent l'id, la provenance suit la valeur, et une liste se relit par id, jamais par rang. */
describe('relireTrait / relireTraits — ce que la chaîne ne dit pas reste à son Trait', () => {
  const venin: TraitPose = { id: 'venin', arg: 'accessible', hidden: true, source: { book: 'livre-de-base', page: 1 }, maison: 'Raison de banc.' };

  it('une rangée dont l’id change repose une pose NEUVE : ni drapeau ni provenance du Trait remplacé', () => {
    expect(relireTrait('Morsure +3', venin)).toEqual({ id: 'morsure', value: 3 });
  });

  it('une rangée dont la valeur change garde les drapeaux du Trait et perd la provenance de l’ancienne valeur', () => {
    expect(relireTrait('Venin (Difficile)', venin)).toEqual({ id: 'venin', arg: 'difficile', hidden: true });
  });

  it('retirer le 1er Trait d’une liste ne fait pas passer ses drapeaux ni sa provenance au suivant', () => {
    const avant: TraitPose[] = [{ id: 'frenesie', hidden: true, maison: 'Raison propre à Frénésie.' }, { id: 'magique' }];
    expect(relireTraits(['Magique'], avant)).toEqual([{ id: 'magique' }]);
    expect(relireTraits(['Magique', 'Frénésie'], avant)).toEqual([{ id: 'magique' }, avant[0]]);
  });

  it.each([
    ['Arme +3 / Arme +5', ['Arme +3', 'Arme +5'], [{ id: 'arme', value: 3, natural: true, maison: 'm3' }, { id: 'arme', value: 5, maison: 'm5' }]],
    ['Peur 2 / Peur 3', ['Peur 2', 'Peur 3'], [{ id: 'peur', value: 2, source: { book: 'livre-de-base', page: 1 } }, { id: 'peur', value: 3, hidden: true, source: { book: 'livre-de-base', page: 2 } }]],
  ] as [string, string[], TraitPose[]][])('doublons de même id (%s) : chaque pose suit SA valeur — suppression, inversion', (_, textes, avant) => {
    expect(relireTraits([textes[1]], avant), 'suppression du 1er').toEqual([avant[1]]);
    expect(relireTraits([textes[0]], avant), 'suppression du 2e').toEqual([avant[0]]);
    expect(relireTraits([textes[1], textes[0]], avant), 'inversion').toEqual([avant[1], avant[0]]);
  });

  it('doublons de même id : une valeur changée garde les drapeaux de SA pose, jamais ceux de la voisine', () => {
    const avant: TraitPose[] = [{ id: 'arme', value: 3, natural: true, maison: 'm3' }, { id: 'arme', value: 5, maison: 'm5' }];
    expect(relireTraits(['Arme +5', 'Arme +4'], avant)).toEqual([avant[1], { id: 'arme', value: 4, natural: true }]);
  });

  /** La frappe vit en BROUILLON (`SaisieEnBrouillon`) : rien ne la réécrit sous les doigts (« Venin
   *  (Accessible » resterait sinon `venin-accessible`), rien ne s'émet avant la fin de la saisie, et la
   *  saisie revenue à l'identique rend la pose entière, drapeaux et provenance compris. */
  it('TraitListField : effacer puis retaper la parenthèse, frappe par frappe, rend la pose d’origine', () => {
    const venin: TraitPose = { id: 'venin', arg: 'accessible', hidden: true, source: { book: 'core-rulebook-5e', page: 326, note: 'CRB 105 l.161' } };
    const ecrits: TraitPose[][] = [];
    function Hote() {
      const [traits, setTraits] = useState<TraitPose[]>([venin]);
      return <TraitListField chemin="banc/traits" label="Traits" value={traits} onChange={(v) => { ecrits.push(v); setTraits(v); }} />;
    }
    const host = monter(<Hote />);
    const champ = host.querySelector<HTMLInputElement>('.trait-row input')!;
    expect(champ.value).toBe('Venin (Accessible)');
    taper(champ, 'Venin (Accessible');
    expect(champ.value, 'le texte frappé reste à l’écran').toBe('Venin (Accessible');
    taper(champ, 'Venin (Accessible)');
    expect(ecrits, 'aucun état intermédiaire émis').toEqual([]);
    valider(champ);
    expect(ecrits).toEqual([[venin]]);
  });

  it('TraitListField : un Aspect tapé frappe par frappe (« Arme (Ép… ») n’est jamais réécrit avant la fin de la saisie', () => {
    const ecrits: TraitPose[][] = [];
    const host = monter(<TraitListField chemin="banc/traits" label="Traits" value={[{ id: 'arme', value: 7, natural: true }]} onChange={(v) => ecrits.push(v)} />);
    const champ = host.querySelector<HTMLInputElement>('.trait-row input')!;
    taper(champ, 'Arme (Ép');
    expect(champ.value).toBe('Arme (Ép');
    taper(champ, 'Arme (Épée) +7');
    valider(champ);
    expect(ecrits).toEqual([[{ id: 'arme', value: 7, arg: parseTraitInstance('Arme (Épée) +7').arg, natural: true }]]);
  });
});

describe('pli d’une rangée de Trait posé — fourchette et Indice par Localisation, borne à borne', () => {
  const champDe = (host: HTMLElement, nom: string) => host.querySelector<HTMLInputElement>(`input[aria-label="${nom}"]`)!;

  it('OptionalsListField : la borne haute d’une fourchette (ZI 13 l.31) se tape et garde la raison maison', () => {
    const armure: TraitPose = { id: 'armure', plage: { min: 1, max: 3 }, maison: 'raison fixture' };
    const ecrits: OptionalEntry[][] = [];
    function Hote() {
      const [opts, setOpts] = useState<OptionalEntry[]>([armure]);
      return <OptionalsListField chemin="banc/optionals" label="Optionnels" value={opts} onChange={(v) => { ecrits.push(v); setOpts(v); }} />;
    }
    const host = monter(<Hote />);
    expect(host.querySelector<HTMLInputElement>('.trait-row input')!.value).toBe('Armure 1-3');
    const haute = champDe(host, 'Fourchette — borne haute');
    taper(haute, '4');
    expect(ecrits, 'aucun état intermédiaire émis').toEqual([]);
    valider(haute);
    expect(ecrits).toEqual([[{ ...armure, plage: { min: 1, max: 4 } }]]);
    expect(host.querySelector<HTMLInputElement>('.trait-row input')!.value).toBe('Armure 1-4');
  });

  it('TraitListField : l’Indice d’une Localisation (AA 09 l.184) se tape, les cinq autres restent', () => {
    const parLocalisation = { tete: 3, brasG: 3, brasD: 3, corps: 3, jambeG: 1, jambeD: 1 };
    const ecrits: TraitPose[][] = [];
    function Hote() {
      const [traits, setTraits] = useState<TraitPose[]>([{ id: 'armure', parLocalisation }]);
      return <TraitListField chemin="banc/traits" label="Traits" value={traits} onChange={(v) => { ecrits.push(v); setTraits(v); }} />;
    }
    const host = monter(<Hote />);
    const tete = champDe(host, 'Indice — Tête');
    taper(tete, '2');
    valider(tete);
    expect(ecrits).toEqual([[{ id: 'armure', parLocalisation: { ...parLocalisation, tete: 2 } }]]);
    expect(host.querySelector<HTMLInputElement>('.trait-row input')!.value).toBe('Armure (Tête 2, Bras 3, Corps 3, Jambes 1)');
  });
});

describe('SaisieEnBrouillon — la frappe au brouillon, relue une fois à la fin de la saisie', () => {
  it('à `lignes`, un textarea : Entrée ouvre une ligne sans poser, le blur relit le texte une seule fois', () => {
    const ecrits: string[][] = [];
    const relus: string[] = [];
    function Hote() {
      const [v, setV] = useState<string[]>(['Esquive 48']);
      return (
        <SaisieEnBrouillon
          lignes={4} ariaLabel="Compétences" value={v} afficher={(l) => l.join('\n')}
          relire={(t) => { relus.push(t); return t.split('\n').filter(Boolean); }} onChange={(n) => { ecrits.push(n); setV(n); }} />
      );
    }
    const champ = monter(<Hote />).querySelector<HTMLTextAreaElement>('textarea')!;
    taper(champ, 'Esquive 48\nCalme 30');
    act(() => { champ.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })); });
    expect(ecrits, 'ni la frappe ni Entrée ne posent').toEqual([]);
    valider(champ);
    valider(champ);
    expect(relus).toEqual(['Esquive 48\nCalme 30']);
    expect(ecrits).toEqual([['Esquive 48', 'Calme 30']]);
    expect(champ.value).toBe('Esquive 48\nCalme 30');
  });

  it('GameOpEditor `summon.addTraits` : l’indication s’affiche, la chaîne se relit au blur et non à chaque frappe', () => {
    const vus: GameOp[][] = [];
    function Hote() {
      const [ops, setOps] = useState<GameOp[]>([newOp('summon')]);
      return <GameOpEditor ops={ops} onChange={(n) => { vus.push(n); setOps(n); }} />;
    }
    const host = monter(<Hote />);
    const champ = host.querySelector<HTMLInputElement>('input[placeholder="Traits ajoutés (ex. Frénésie, Magique)"]')!;
    expect(champ, 'indication du champ').not.toBeNull();
    taper(champ, 'Frénésie, Magique');
    expect(vus, 'aucun état intermédiaire émis').toEqual([]);
    valider(champ);
    expect(vus.map((ops) => (ops[0] as Extract<GameOp, { op: 'summon' }>).addTraits))
      .toEqual([[parseTraitInstance('Frénésie'), parseTraitInstance('Magique')]]);
  });
});
