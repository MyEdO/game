// @vitest-environment jsdom
/**
 * `AjoutRangee` : le clic porte le focus au PREMIER champ saisissable de la rangée NEUVE. Ordre de
 * PRODUCTION, aucun `act` : `IS_REACT_ACT_ENVIRONMENT = false`, `createRoot`, clic par `dispatchEvent`,
 * lecture après une tâche.
 */
import { describe, it, expect, afterEach, beforeAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Fragment, useState, type ReactElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { create } from 'zustand';
import { AjoutRangee } from './AjoutRangee';
import { SpecsField, TraitListField, OptionalsListField } from './compendium/StructFields';
import { RefField } from './compendium/RefField';
import { CodexEdit } from './compendium/CodexEdit';
import type { TraitInstance, OptionalEntry } from '../engine/statEntry';
import { listerArbre } from '../../scripts/guards/lib/lister.mjs';
import { scanAjoutRangee } from '../../scripts/guards/lib/ajoutRangee.mjs';

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = false;
});

let container: HTMLDivElement;
let root: Root;
const tache = () => new Promise((r) => setTimeout(r, 20));

afterEach(async () => {
  root.unmount();
  container.remove();
  await tache();
});

async function monte(el: ReactElement) {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  root.render(el);
  await tache();
}

/** Éditeur CONTRÔLÉ : chaque `onChange` re-rend l'hôte avec la valeur neuve. */
function Controle<T>({ initial, rendu }: { initial: T; rendu: (value: T, onChange: (v: T) => void) => ReactElement }) {
  const [value, setValue] = useState(initial);
  return rendu(value, setValue);
}

const SAISISSABLE = 'input:not([type="hidden"]), select, textarea';

/** Clique le bouton `libelle` (focalisé d'abord, comme un clic souris) et rend l'élément actif après une tâche. */
async function clique(portee: Element, libelle: string): Promise<Element | null> {
  const bouton = [...portee.querySelectorAll('button')].find((b) => b.textContent?.trim() === libelle) as HTMLButtonElement;
  expect(bouton, libelle).toBeDefined();
  bouton.focus();
  bouton.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  await tache();
  return document.activeElement;
}

describe('les formes d’hôte que les sites présentent', () => {
  it('1. hôte à état local, rangée dans le même conteneur', async () => {
    function App() {
      const [l, set] = useState(['a']);
      return <div>{l.map((x, i) => <input key={i} data-k={`r${i}`} defaultValue={x} />)}<AjoutRangee libelle="Ajouter" onAjout={() => set([...l, ''])} /></div>;
    }
    await monte(<App />);
    expect((await clique(container, 'Ajouter'))?.getAttribute('data-k')).toBe('r1');
  });

  it('2. store Zustand, hôte abonné', async () => {
    const useS = create<{ l: string[]; add: () => void }>((set) => ({ l: ['a'], add: () => set((s) => ({ l: [...s.l, ''] })) }));
    function App() {
      const l = useS((s) => s.l); const add = useS((s) => s.add);
      return <div>{l.map((x, i) => <input key={i} data-k={`r${i}`} defaultValue={x} />)}<AjoutRangee libelle="Ajouter" onAjout={add} /></div>;
    }
    await monte(<App />);
    expect((await clique(container, 'Ajouter'))?.getAttribute('data-k')).toBe('r1');
  });

  it('3. store Zustand, seul un enfant abonné : l’hôte du bouton ne re-rend pas', async () => {
    const useT = create<{ l: string[]; add: () => void }>((set) => ({ l: ['a'], add: () => set((s) => ({ l: [...s.l, ''] })) }));
    function Rangees() { const l = useT((s) => s.l); return <Fragment>{l.map((x, i) => <input key={i} data-k={`r${i}`} defaultValue={x} />)}</Fragment>; }
    function App() { const add = useT((s) => s.add); return <div><Rangees /><AjoutRangee libelle="Ajouter" onAjout={add} /></div>; }
    await monte(<App />);
    expect((await clique(container, 'Ajouter'))?.getAttribute('data-k')).toBe('r1');
  });

  it('4. rangée rendue hors du conteneur du bouton (détail d’un master-detail)', async () => {
    function App() {
      const [l, set] = useState(['a']);
      return <div><div>{l.map((x, i) => <input key={i} data-k={`r${i}`} defaultValue={x} />)}</div><div><AjoutRangee libelle="Ajouter" onAjout={() => set([...l, ''])} /></div></div>;
    }
    await monte(<App />);
    expect((await clique(container, 'Ajouter'))?.getAttribute('data-k')).toBe('r1');
  });

  it('5. angle mort déclaré : rangées toutes re-montées (clé dérivée de la longueur), le focus va au premier champ né', async () => {
    function App() {
      const [l, set] = useState(['a', 'b']);
      return <div>{l.map((x, i) => <input key={`${l.length}-${i}`} data-k={`r${i}`} defaultValue={x} />)}<AjoutRangee libelle="Ajouter" onAjout={() => set([...l, ''])} /></div>;
    }
    await monte(<App />);
    expect((await clique(container, 'Ajouter'))?.getAttribute('data-k')).toBe('r0');
  });

  it('un clic qui ne rend rien laisse le focus au bouton, et un rendu d’une tâche ULTÉRIEURE ne le vole pas', async () => {
    function App({ tardif }: { tardif: boolean }) {
      return <div>{tardif && <input aria-label="tardif" />}<AjoutRangee libelle="Ajouter" onAjout={() => {}} /></div>;
    }
    await monte(<App tardif={false} />);
    const actif = await clique(container, 'Ajouter');
    expect(actif?.tagName).toBe('BUTTON');
    root.render(<App tardif />);
    await tache();
    expect(document.activeElement).toBe(actif);
  });
});

/** Le groupe nommé `nom` (`ListeRangees`) : son bouton d'ajout porte le focus à sa dernière rangée. */
async function attendFocusSurRangeeNeuve(nom: string, libelle: string, rangee: string) {
  const liste = container.querySelector(`[role="group"][aria-label="${nom}"]`);
  expect(liste, `groupe « ${nom} »`).not.toBeNull();
  const anciens = [...liste!.querySelectorAll(SAISISSABLE)];
  const focus = await clique(liste!, libelle);
  const rangees = liste!.querySelectorAll(`:scope > ${rangee}`);
  const attendu = rangees[rangees.length - 1]?.querySelector(SAISISSABLE);
  expect(attendu, 'la rangée neuve porte un champ saisissable').toBeTruthy();
  expect(anciens).not.toContain(attendu);
  expect(focus).toBe(attendu);
}

describe('éditeurs du Codex montés', () => {
  it('spécialisations (`SpecsField`)', async () => {
    await monte(<Controle initial={[{ id: 'foret', label: 'Forêt' }]} rendu={(v, onChange) => <SpecsField value={v} onChange={onChange} />} />);
    await attendFocusSurRangeeNeuve('spécialisations', 'Ajouter', '.de-reflrow');
  });

  it('Traits (`TraitListField`)', async () => {
    await monte(<Controle<TraitInstance[]> initial={[{ id: 'peur', value: 1 }]} rendu={(v, onChange) => <TraitListField label="Traits" value={v} onChange={onChange} />} />);
    await attendFocusSurRangeeNeuve('Traits', 'Ajouter un trait', '.trait-row');
  });

  it('Traits optionnels (`OptionalsListField`)', async () => {
    await monte(<Controle<OptionalEntry[]> initial={[{ id: 'peur', value: 1 }]} rendu={(v, onChange) => <OptionalsListField label="Optionnels" value={v} onChange={onChange} />} />);
    await attendFocusSurRangeeNeuve('Optionnels', 'Ajouter un trait optionnel', '.trait-row');
  });

  it('liste de références (`RefField`, liste)', async () => {
    await monte(<Controle<unknown> initial={[{ id: '' }]} rendu={(v, onChange) => <RefField cfg={{ ds: 'spells' }} label="Sorts" value={v} onChange={onChange} />} />);
    await attendFocusSurRangeeNeuve('Sorts', 'Ajouter', '.de-reflrow');
  });

  it('liste de chaînes du Codex (`Field`, `stringList`)', async () => {
    await monte(<CodexEdit categoryKey="names" label="Humain" id="humain" onClose={() => {}} />);
    const nom = container.querySelector('[role="group"]')?.getAttribute('aria-label') ?? '';
    await attendFocusSurRangeeNeuve(nom, 'Ajouter', '.de-reflrow');
  });

  it('tableau d’objets du Codex (`GenericArrayField`)', async () => {
    await monte(<CodexEdit categoryKey="characteristics" label="Résilience" id="resilience" onClose={() => {}} />);
    const nom = [...container.querySelectorAll('[role="group"]')].find((g) => g.querySelector(':scope > .ed-subfield'))?.getAttribute('aria-label') ?? '';
    await attendFocusSurRangeeNeuve(nom, 'Ajouter', '.ed-subfield');
  });
});

/** Boutons dont le contenu s'ouvre par `ui/add` sans ajouter de rangée : fichier → raison, un site chacun. */
const HORS_GESTE: Record<string, string> = {
  'AssignRow.tsx': 'ouvre le panneau de choix d’un paramètre (`aria-expanded`)',
  'ChanceButtons.tsx': 'dépense un Point de Chance pour +1 DR',
  'MerchantPanel.tsx': 'range un objet déjà possédé au panier de vente',
};

describe('ajouter une rangée : une seule couture', () => {
  it('aucun bouton de `src/ui` ne s’ouvre par le glyphe « + » ou l’icône `ui/add` hors de `AjoutRangee`', () => {
    const racine = join(process.cwd(), 'src', 'ui');
    const sites = (listerArbre(racine) as string[])
      .filter((f) => f.endsWith('.tsx') && !f.endsWith('.test.tsx') && f !== 'AjoutRangee.tsx')
      .flatMap((f) => scanAjoutRangee(f, readFileSync(join(racine, f), 'utf8')).map((x) => ({ f, l: `${f}:${x.line} ${x.detail}` })));
    const nus = sites.filter(({ f }) => !(f in HORS_GESTE)).map(({ l }) => l);
    expect(nus, `bouton d'ajout de rangée hors de AjoutRangee :\n${nus.join('\n')}`).toEqual([]);
    const horsGeste = Object.fromEntries(Object.keys(HORS_GESTE).map((f) => [f, sites.filter((s) => s.f === f).length]));
    expect(horsGeste).toEqual(Object.fromEntries(Object.keys(HORS_GESTE).map((f) => [f, 1])));
  });
});
