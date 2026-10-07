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
import { revealClue, type ClueState } from '../state/clues';
import { t } from '../i18n';

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

  it('un stade ADAPTÉ (`adapteDe`, #2001) rend sa prose sans badge de citation : ce n’est pas une copie du livre', async () => {
    const abbr = bookAbr('ennemi-dans-l-ombre');
    expect(abbr).not.toBe('ennemi-dans-l-ombre');
    const narratifAdapté: NarratifBlock = {
      ...emptyNarratif(),
      affaires: [{ id: 'affaire-1', titre: 'La route d’Altdorf' }],
      indices: [
        {
          id: 'ind-adapte',
          affaireId: 'affaire-1',
          kind: 'indice',
          titre: 'Le cocher bavard',
          stades: [{ id: 's1', prose: 'Le cocher se souvient d’un cavalier pressé.', adapteDe: { book: 'ennemi-dans-l-ombre', page: 14 } }],
        },
      ],
    };
    useGame.setState({
      campaignNarratif: narratifAdapté,
      clues: { 'ind-adapte': { stadeCourant: 's1', statut: 'révélé', historique: [{ stade: 's1', at: 0 }] } },
    });
    await mount();
    const txt = container.textContent ?? '';
    expect(txt).toContain('Le cocher se souvient d’un cavalier pressé.');
    expect(txt).not.toContain(abbr);
  });
});

describe('CarnetScreen — le document qu’un stade croise (#679)', () => {
  const narratifDocumenté = (stades: NarratifBlock['indices'][number]['stades']): NarratifBlock => ({
    ...emptyNarratif(),
    affaires: [{ id: 'affaire-1', titre: 'La route d’Altdorf' }],
    indices: [{ id: 'ind-doc', affaireId: 'affaire-1', kind: 'indice', titre: 'L’affiche', stades }],
    documents: [
      { id: 'doc-affiche', titre: 'Affiche de la diligence', prose: '**VOYAGEURS** pour Altdorf', source: { book: 'livre-de-base', page: 7 } },
      { id: 'doc-lettre', titre: 'Lettre de Kastor', prose: 'Mon cher cousin' },
    ],
  });
  const révélé = (stadeCourant: string, historique: string[]): Record<string, ClueState> => ({
    'ind-doc': { stadeCourant, statut: 'révélé', historique: historique.map((stade) => ({ stade, at: 0 })) },
  });
  /** Les cartes-parchemin rendues : titre et texte de chacune. */
  const parchemins = () => [...container.querySelectorAll('.parchment-card')].map((c) => ({
    titre: c.querySelector('.parchment-card-title')?.textContent,
    texte: c.textContent ?? '',
  }));

  it('un stade à prose ET document rend la prose, puis le document sur parchemin, titré, en Markdown et sourcé', async () => {
    useGame.setState({ campaignNarratif: narratifDocumenté([{ id: 's1', prose: 'Une affiche est clouée au relais.', documentId: 'doc-affiche' }]), clues: révélé('s1', ['s1']) });
    await mount();
    expect(container.textContent).toContain('Une affiche est clouée au relais.');
    const [carte, ...autres] = parchemins();
    expect(autres).toEqual([]);
    expect(carte.titre).toBe('Affiche de la diligence');
    expect(carte.texte).toContain('VOYAGEURS pour Altdorf');
    expect(carte.texte).toContain(bookAbr('livre-de-base'));
    expect(container.querySelector('.parchment-card strong')?.textContent).toBe('VOYAGEURS');
  });

  it('un stade SANS prose rend son seul document ; une lecture précédente garde le sien', async () => {
    useGame.setState({
      campaignNarratif: narratifDocumenté([{ id: 's1', documentId: 'doc-lettre' }, { id: 's2', documentId: 'doc-affiche' }]),
      clues: révélé('s2', ['s1', 's2']),
    });
    await mount();
    expect(parchemins().map((p) => p.titre)).toEqual(['Affiche de la diligence', 'Lettre de Kastor']);
    const précédente = container.querySelector('.clue-history .parchment-card');
    expect(précédente?.textContent).toContain('Mon cher cousin');
  });
});

describe('CarnetScreen — nouveautés (#2415)', () => {
  /** Le siège local est le 0 (`net.mySeat`) : `lu` l'a affiché, `neuf` n'a été affiché par personne. */
  const neuf: ClueState = { stadeCourant: 's1', statut: 'révélé', historique: [{ stade: 's1', at: 0 }] };
  const lu: ClueState = { ...neuf, vuParSiège: { 0: true } };
  /** Pastilles « Nouveau » des bandes d'indice (hors rangées de liste). */
  const pastillesDeBande = () => [...container.querySelectorAll('.chip.tone-warn')]
    .filter((c) => !c.closest('.listrow'))
    .map((c) => c.textContent);
  const rangée = (titre: string) => [...container.querySelectorAll('button.listrow')].find((el) => el.textContent?.includes(titre))!;

  it('un indice nouveau pour CE siège porte la pastille « Nouveau » sur sa bande ; l’indice lu voisin, non', async () => {
    useGame.setState({ campaignNarratif: narratif, clues: { 'ind-1': neuf, 'ind-2': lu } });
    await mount();
    expect(container.querySelectorAll('.creator-band')).toHaveLength(2);
    expect(pastillesDeBande()).toEqual([t('carnet.nouveau')]);
    const bandeNeuve = [...container.querySelectorAll('.creator-band')].find((b) => b.textContent?.includes('Traces de boue fraîche'))!;
    expect(bandeNeuve.querySelector('.chip.tone-warn')?.textContent).toBe(t('carnet.nouveau'));
  });

  it('la rangée d’affaire compte ses nouveautés dans un `.count` ; une affaire sans nouveauté n’en porte pas', async () => {
    useGame.setState({ campaignNarratif: narratif, clues: { 'ind-1': lu, 'ind-3': neuf } });
    await mount();
    expect(rangée('Le sceau maudit').querySelector('.chip.tone-warn .count')?.textContent).toBe('1');
    expect(rangée('La disparition du meunier').querySelector('.chip.tone-warn')).toBeNull();
  });

  it('la rangée « Épinglés » compte les nouveautés de ses indices', async () => {
    useGame.setState({ campaignNarratif: narratif, clues: { 'ind-1': neuf, 'ind-3': { ...neuf, épinglé: true } } });
    await mount();
    expect(rangée('Épinglés').querySelector('.chip.tone-warn .count')?.textContent).toBe('1');
  });

  it('AFFICHER une affaire marque ses indices vus par CE siège au store, et leur pastille reste lisible tant que le carnet est ouvert', async () => {
    useGame.setState({ campaignNarratif: narratif, clues: { 'ind-1': neuf, 'ind-3': neuf } });
    await mount();
    // L'affaire affichée par défaut (le meunier) passe vue ; celle du sceau, jamais affichée, reste nouvelle.
    expect(useGame.getState().clues['ind-1'].vuParSiège).toEqual({ 0: true });
    expect(useGame.getState().clues['ind-3'].vuParSiège).toBeUndefined();
    expect(pastillesDeBande()).toEqual([t('carnet.nouveau')]);
    await act(async () => (rangée('Le sceau maudit') as HTMLButtonElement).click());
    expect(useGame.getState().clues['ind-3'].vuParSiège).toEqual({ 0: true });
    expect(pastillesDeBande()).toEqual([t('carnet.nouveau')]);
  });

  it('un indice vu par le siège 0 reste NOUVEAU au Carnet du siège 1, qui le marque pour lui seul', async () => {
    const net = useGame.getState().net;
    useGame.setState({ campaignNarratif: narratif, clues: { 'ind-1': lu }, net: { ...net, mySeat: 1 } });
    try {
      await mount();
      expect(pastillesDeBande()).toEqual([t('carnet.nouveau')]);
      expect(useGame.getState().clues['ind-1'].vuParSiège).toEqual({ 0: true, 1: true });
    } finally {
      useGame.setState({ net });
    }
  });

  it('FERMER puis rouvrir le carnet : plus aucune pastille — la mémoire du montage repart à zéro', async () => {
    useGame.setState({ campaignNarratif: narratif, clues: { 'ind-1': neuf } });
    await mount();
    expect(pastillesDeBande(), 'témoin : la nouveauté levée reste lisible au premier montage').toEqual([t('carnet.nouveau')]);
    await act(async () => root.unmount());
    root = createRoot(container);
    await mount();
    expect(container.textContent).toContain('Traces de boue fraîche');
    expect(pastillesDeBande()).toEqual([]);
  });

  it('un indice révélé PENDANT que son affaire est affichée : marqué vu aussitôt, pastille gardée dans ce montage', async () => {
    useGame.setState({ campaignNarratif: narratif, clues: { 'ind-1': lu } });
    await mount();
    expect(pastillesDeBande(), 'témoin : rien de nouveau avant la révélation').toEqual([]);
    await act(async () => useGame.setState((s) => ({ clues: revealClue(s.clues, narratif.indices[1], 0) })));
    expect(useGame.getState().clues['ind-2']).toBeDefined();
    expect(useGame.getState().clues['ind-2'].vuParSiège).toEqual({ 0: true });
    const bande = [...container.querySelectorAll('.creator-band')].find((b) => b.textContent?.includes('Second indice caché'))!;
    expect(bande.querySelector('.chip.tone-warn')?.textContent).toBe(t('carnet.nouveau'));
  });
});
