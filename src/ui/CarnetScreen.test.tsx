// @vitest-environment jsdom
/** Carnet d'enquête (#670) — contrats POSITIFS : un indice absent de `clues` reste caché, une fausse
 *  piste (`statut: 'réfuté'`) reste lisible avec son marqueur, l'épingle route vers `toggleCluePin`,
 *  et l'état vide s'affiche sans indice découvert. */
import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { CarnetScreen } from './CarnetScreen';
import { useGame } from '../state/store';
import { bookAbr } from '../data';
import { emptyNarratif, type NarratifBlock } from '../state/campaignNarratif';
import type { ClueState } from '../state/clues';

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});

const narratif: NarratifBlock = {
  ...emptyNarratif(),
  affaires: [
    { id: 'affaire-1', titre: 'La disparition du meunier' },
    { id: 'affaire-2', titre: 'Le sceau maudit' },
  ],
  indices: [
    {
      id: 'ind-1',
      affaireId: 'affaire-1',
      kind: 'indice',
      titre: 'Traces de boue fraîche',
      stades: [{ id: 's1', prose: 'Des traces de boue mènent au moulin abandonné.' }],
    },
    {
      id: 'ind-2',
      affaireId: 'affaire-1',
      kind: 'indice',
      titre: 'Second indice caché',
      stades: [{ id: 's1', prose: 'Ce texte ne doit jamais apparaître.' }],
    },
    {
      id: 'ind-3',
      affaireId: 'affaire-2',
      kind: 'rumeur',
      titre: 'La rumeur du forgeron',
      stades: [{ id: 's1', prose: 'Le forgeron aurait vu une ombre dans le sceau.' }],
    },
  ],
  presetsPnj: [],
  objets: [],
};

const cluesUnSeulRévélé: Record<string, ClueState> = {
  'ind-1': { stadeCourant: 's1', statut: 'révélé', historique: [{ stade: 's1', at: 0 }] },
};

const cluesAvecRéfuté: Record<string, ClueState> = {
  'ind-1': { stadeCourant: 's1', statut: 'révélé', historique: [{ stade: 's1', at: 0 }] },
  'ind-3': { stadeCourant: 's1', statut: 'réfuté', historique: [{ stade: 's1', at: 0 }] },
};

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  useGame.setState({ campaignNarratif: null, clues: {} });
});

async function mount() {
  await act(async () => {
    root.render(<CarnetScreen onClose={() => {}} />);
  });
}

describe('CarnetScreen — rendu (#670)', () => {
  it('seul l’indice révélé (présent dans `clues`) apparaît — celui absent reste caché', async () => {
    useGame.setState({ campaignNarratif: narratif, clues: cluesUnSeulRévélé });
    await mount();
    const txt = container.textContent ?? '';
    expect(txt).toContain('Traces de boue fraîche');
    expect(txt).toContain('Des traces de boue mènent au moulin abandonné.');
    expect(txt).not.toContain('Second indice caché');
    expect(txt).not.toContain('Ce texte ne doit jamais apparaître.');
  });

  it('un indice réfuté (fausse piste) reste présent et lisible, avec son marqueur', async () => {
    useGame.setState({ campaignNarratif: narratif, clues: cluesAvecRéfuté });
    await mount();
    // Sélectionne l'affaire du sceau maudit (l'indice réfuté n'y est pas la sélection par défaut).
    const rows = Array.from(container.querySelectorAll('button.listrow'));
    const row = rows.find((el) => el.textContent?.includes('Le sceau maudit')) as HTMLButtonElement;
    expect(row).toBeTruthy();
    await act(async () => row.click());

    const txt = container.textContent ?? '';
    expect(txt).toContain('La rumeur du forgeron');
    expect(txt).toContain('Le forgeron aurait vu une ombre dans le sceau.');
    expect(txt).toContain('Fausse piste');
  });

  it('le bouton d’épingle appelle `toggleCluePin` avec l’id de l’indice', async () => {
    const toggleCluePin = vi.fn();
    useGame.setState({ campaignNarratif: narratif, clues: cluesUnSeulRévélé, toggleCluePin });
    await mount();
    const pin = Array.from(container.querySelectorAll('button.chip')).find((el) =>
      el.textContent?.includes('Épingler'),
    ) as HTMLButtonElement;
    expect(pin).toBeTruthy();
    await act(async () => pin.click());
    expect(toggleCluePin).toHaveBeenCalledWith('ind-1');
  });

  it('état vide : aucun indice découvert affiche le message dédié', async () => {
    useGame.setState({ campaignNarratif: narratif, clues: {} });
    await mount();
    expect(container.textContent ?? '').toContain('Aucun indice découvert');
  });

  it('la source d’un stade s’affiche en abréviation RÉSOLUE, jamais l’id de livre brut', async () => {
    const abbr = bookAbr('livre-de-base');
    expect(abbr).not.toBe('livre-de-base'); // sanity : le livre est connu, l'abréviation diffère de l'id
    const narratifSourcé: NarratifBlock = {
      ...emptyNarratif(),
      affaires: [{ id: 'affaire-1', titre: 'La lettre codée' }],
      indices: [
        {
          id: 'ind-src',
          affaireId: 'affaire-1',
          kind: 'indice',
          titre: 'La lettre au chiffre',
          stades: [{ id: 's1', prose: 'Une lettre au chiffre inconnu.', source: { book: 'livre-de-base', page: 13 } }],
        },
      ],
      presetsPnj: [],
      objets: [],
    };
    useGame.setState({
      campaignNarratif: narratifSourcé,
      clues: { 'ind-src': { stadeCourant: 's1', statut: 'révélé', historique: [{ stade: 's1', at: 0 }] } },
    });
    await mount();
    const txt = container.textContent ?? '';
    expect(txt).toContain(abbr); // abréviation résolue (ex. « LDB »)
    expect(txt).not.toContain('livre-de-base'); // jamais l'id interne au joueur
  });
});
