// @vitest-environment jsdom
/**
 * « + Ajouter » d'un éditeur de liste : le focus va au PREMIER champ saisissable de la rangée NEUVE
 * (`useFocusRangeeNeuve`). Geste RÉEL sur les éditeurs montés (patron `specs-field-edition.test.tsx`) :
 * clic sur le bouton, puis lecture de `document.activeElement`.
 */
import { describe, it, expect, afterEach, beforeAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { act, type ReactElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { SpecsField, TraitListField, OptionalsListField } from './compendium/StructFields';
import { RefField } from './compendium/RefField';
import { CodexEdit } from './compendium/CodexEdit';
import { useFocusRangeeNeuve } from './useFocusRangeeNeuve';
import type { TraitInstance, OptionalEntry } from '../engine/statEntry';
import { listerArbre } from '../../scripts/guards/lib/lister.mjs';

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});

let container: HTMLDivElement;
let root: Root;

afterEach(() => {
  act(() => { root.unmount(); });
  container.remove();
});

/** Monte un éditeur CONTRÔLÉ : chaque `onChange` re-rend avec la valeur neuve, comme son hôte. */
function monteControle<T>(initial: T, rendu: (value: T, onChange: (v: T) => void) => ReactElement) {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  let value = initial;
  const onChange = (v: T) => {
    value = v;
    act(() => { root.render(rendu(value, onChange)); });
  };
  act(() => { root.render(rendu(value, onChange)); });
}

function monte(el: ReactElement) {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => { root.render(el); });
}

const SAISISSABLE = 'input:not([type="hidden"]), select, textarea';

/** Clique le bouton `libelle` du conteneur `liste` et rend le premier champ de sa DERNIÈRE rangée. */
function ajouteEtLitRangeeNeuve(liste: Element, libelle: string, rangee: string): { focus: Element | null; attendu: Element | undefined; anciens: Element[] } {
  const anciens = [...liste.querySelectorAll(SAISISSABLE)];
  const bouton = [...liste.querySelectorAll(':scope > button')].find((b) => b.textContent === libelle) as HTMLButtonElement;
  expect(bouton, libelle).toBeDefined();
  bouton.focus();
  act(() => { bouton.click(); });
  const rangees = liste.querySelectorAll(`:scope > ${rangee}`);
  return { focus: document.activeElement, attendu: rangees[rangees.length - 1]?.querySelector(SAISISSABLE) ?? undefined, anciens };
}

/** Le conteneur de liste qui porte un bouton `libelle` et au moins une rangée `rangee`. */
const listeAvec = (libelle: string, rangee: string): Element =>
  [...container.querySelectorAll('.ed-field')].find((f) =>
    [...f.querySelectorAll(':scope > button')].some((b) => b.textContent === libelle) && f.querySelector(`:scope > ${rangee}`))!;

function attendFocusSurRangeeNeuve(libelle: string, rangee: string) {
  const liste = listeAvec(libelle, rangee);
  expect(liste, `liste « ${libelle} »`).toBeDefined();
  const { focus, attendu, anciens } = ajouteEtLitRangeeNeuve(liste, libelle, rangee);
  expect(attendu, 'la rangée neuve porte un champ saisissable').toBeDefined();
  expect(anciens).not.toContain(attendu);
  expect(focus).toBe(attendu);
}

describe('« + Ajouter » porte le focus sur le premier champ de la rangée neuve', () => {
  it('spécialisations (`SpecsField`)', () => {
    monteControle([{ id: 'foret', label: 'Forêt' }], (v, onChange) => <SpecsField value={v} onChange={onChange} />);
    attendFocusSurRangeeNeuve('+ Ajouter', '.de-reflrow');
  });

  it('Traits (`TraitListField`)', () => {
    monteControle<TraitInstance[]>([{ id: 'peur', value: 1 }], (v, onChange) => <TraitListField label="Traits" value={v} onChange={onChange} />);
    attendFocusSurRangeeNeuve('+ Ajouter un trait', '.trait-row');
  });

  it('Traits optionnels (`OptionalsListField`)', () => {
    monteControle<OptionalEntry[]>([{ id: 'peur', value: 1 }], (v, onChange) => <OptionalsListField label="Optionnels" value={v} onChange={onChange} />);
    attendFocusSurRangeeNeuve('+ Ajouter un trait optionnel', '.trait-row');
  });

  it('liste de références (`RefField`, liste)', () => {
    monteControle<unknown>([{ id: '' }], (v, onChange) => <RefField cfg={{ ds: 'spells' }} label="Sorts" value={v} onChange={onChange} />);
    attendFocusSurRangeeNeuve('+ Ajouter', '.de-reflrow');
  });

  it('liste de chaînes du Codex (`Field`, `stringList`)', () => {
    monte(<CodexEdit categoryKey="names" label="Humain" id="humain" onClose={() => {}} />);
    attendFocusSurRangeeNeuve('+ Ajouter', '.de-reflrow');
  });

  it('tableau d’objets du Codex (`GenericArrayField`)', () => {
    monte(<CodexEdit categoryKey="characteristics" label="Résilience" id="resilience" onClose={() => {}} />);
    attendFocusSurRangeeNeuve('+ Ajouter', '.ed-subfield');
  });

  it('un clic qui ne rend rien laisse le focus au bouton, et un rendu d’une tâche ULTÉRIEURE ne le vole pas', async () => {
    function Liste({ tardif }: { tardif: boolean }) {
      const { refListe, ajouter } = useFocusRangeeNeuve();
      return (
        <div ref={refListe}>
          {tardif && <input aria-label="tardif" />}
          <button onClick={() => ajouter(() => {})}>+ Ajouter</button>
        </div>
      );
    }
    monte(<Liste tardif={false} />);
    const bouton = container.querySelector('button')!;
    bouton.focus();
    act(() => { bouton.click(); });
    expect(document.activeElement).toBe(bouton);
    await Promise.resolve();
    act(() => { root.render(<Liste tardif />); });
    expect(document.activeElement).toBe(bouton);
  });
});

describe('« + Ajouter » des éditeurs de liste : une seule couture', () => {
  it('tout bouton « + Ajouter » de `src/ui` passe par `ajouter` de `useFocusRangeeNeuve`', () => {
    const racine = join(process.cwd(), 'src', 'ui');
    const sites = (listerArbre(racine) as string[])
      .filter((f) => f.endsWith('.tsx') && !f.endsWith('.test.tsx'))
      .flatMap((f) => readFileSync(join(racine, f), 'utf8').split('\n').map((l, i) => ({ f, i: i + 1, l })))
      .filter(({ l }) => /<button\b.*>\+ Ajouter/.test(l));
    expect(sites.length).toBeGreaterThanOrEqual(7);
    const nus = sites.filter(({ l }) => !/onClick=\{\(\) => ajouter\(/.test(l)).map(({ f, i }) => `${f}:${i}`);
    expect(nus, `bouton « + Ajouter » hors de useFocusRangeeNeuve :\n${nus.join('\n')}`).toEqual([]);
  });
});
