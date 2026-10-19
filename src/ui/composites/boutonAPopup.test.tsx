// @vitest-environment jsdom
/**
 * Bouton à popup (`useBoutonAPopup`, WAI-ARIA APG Menu Button / liste déroulante) sur ses deux poses
 * réelles : le menu Fichier de l'éditeur (`Menu`) et `MediaSelect` (`Listbox`), dont l'emplacement
 * d'arme de la fiche héros. Le clavier entre dans le popup, la fermeture rend le focus au déclencheur,
 * Échap ne ferme que le popup.
 */
import { describe, it, expect, beforeAll, afterEach, vi } from 'vitest';
import { act } from 'react';
import { monterRacine, demonterRacines } from '../../monterRacine.testkit';
import { EditorToolbar } from '../editor/EditorToolbar';
import { MediaSelect } from '../MediaSelect';
import { CharacterSheet } from '../CharacterSheet';
import { useGameKeyboard } from '../clavier/useGameKeyboard';
import { resetDismissLayers } from '../useDismissLayer';
import { useGame } from '../../state/store';
import { emptyScene } from '../../state/scene';
import { itemFromTrappingById, recomputeLoadout } from '../../engine/items';
import { resetData, setDataset } from '../../data/overrides';
import type { Combatant } from '../../engine/types';
import type { TrappingData } from '../../data';

beforeAll(() => { (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true; });
afterEach(() => {
  demonterRacines();
  resetDismissLayers();
  resetData();
});

const touche = (cible: Element, key: string) =>
  act(() => { cible.dispatchEvent(new KeyboardEvent('keydown', { key, code: key, bubbles: true, cancelable: true })); });
const echap = () => touche(document.activeElement ?? document.body, 'Escape');
const texteFocalise = () => document.activeElement?.textContent?.trim();

function Clavier() {
  useGameKeyboard();
  return null;
}

function monterBarre(surcharges: Partial<Parameters<typeof EditorToolbar>[0]> = {}) {
  const scene = emptyScene();
  const props: Parameters<typeof EditorToolbar>[0] = {
    onBack: vi.fn(), projectName: 'Banc', onNew: vi.fn(), onOpen: vi.fn(), onSave: vi.fn(), onImport: vi.fn(),
    onExport: vi.fn(), onExportAscii: vi.fn(), onAdvanced: vi.fn(), undo: vi.fn(), redo: vi.fn(),
    canUndo: false, canRedo: false, scenes: [scene], activeId: scene.id, onSwitchScene: vi.fn(),
    onAddScene: vi.fn(), onDuplicateScene: vi.fn(), onDeleteScene: vi.fn(), worldCount: null, onWorld: vi.fn(),
    narratifCount: 0, onNarratif: vi.fn(), onTest: vi.fn(), ...surcharges,
  };
  const { container } = monterRacine(<><Clavier /><EditorToolbar {...props} /><button type="button">Après</button></>);
  const declencheur = container.querySelector<HTMLButtonElement>('[aria-haspopup="menu"]')!;
  act(() => declencheur.focus());
  return { container, declencheur, props };
}
const menu = () => document.querySelector('[role="menu"]');

describe('Menu Fichier de l’éditeur (menu button)', () => {
  it('ArrowDown, Home : ouvre et focalise la première entrée ; ArrowUp, End : la dernière', () => {
    for (const [key, attendu] of [['ArrowDown', 'Nouveau projet'], ['Home', 'Nouveau projet'], ['ArrowUp', 'Avancé — JSON (dialogues, triggers, rencontres)'], ['End', 'Avancé — JSON (dialogues, triggers, rencontres)']]) {
      const { declencheur } = monterBarre();
      touche(declencheur, key);
      expect(menu(), key).toBeTruthy();
      expect(texteFocalise(), key).toBe(attendu);
      demonterRacines();
    }
  });

  it('ouverture au clavier (Entrée) : le focus entre sur la première entrée, ArrowUp sur le déclencheur va à la dernière', () => {
    const { declencheur } = monterBarre();
    act(() => declencheur.click());
    expect(texteFocalise()).toBe('Nouveau projet');
    act(() => declencheur.focus());
    touche(declencheur, 'ArrowUp');
    expect(texteFocalise()).toBe('Avancé — JSON (dialogues, triggers, rencontres)');
  });

  it('activer « Exporter JSON » ferme le menu et rend le focus au déclencheur', () => {
    const { declencheur, props } = monterBarre();
    touche(declencheur, 'ArrowDown');
    const exporter = [...document.querySelectorAll<HTMLElement>('[role="menuitem"]')].find((b) => b.textContent?.trim() === 'Exporter JSON')!;
    act(() => exporter.click());
    expect(props.onExport).toHaveBeenCalledOnce();
    expect(menu()).toBeNull();
    expect(document.activeElement).toBe(declencheur);
  });

  it('Échap ferme le menu et rend le focus au déclencheur', () => {
    useGame.setState({ screen: 'editor' } as never);
    const { declencheur } = monterBarre();
    touche(declencheur, 'ArrowDown');
    echap();
    expect(menu()).toBeNull();
    expect(document.activeElement).toBe(declencheur);
  });

  it('Tab hors du menu ouvert le ferme sans reprendre le focus', () => {
    const { declencheur, container } = monterBarre();
    touche(declencheur, 'ArrowDown');
    const apres = [...container.querySelectorAll('button')].find((b) => b.textContent === 'Après')!;
    act(() => apres.focus());
    expect(menu()).toBeNull();
    expect(document.activeElement).toBe(apres);
  });
});

const OPTIONS = ['O0', 'O1', 'O2'].map((k) => ({ key: k, label: k }));
function monterListe(value?: string) {
  const choisir = vi.fn();
  const { container } = monterRacine(<MediaSelect options={OPTIONS} value={value} onSelect={choisir} placeholder="Choisir" />);
  const declencheur = container.querySelector<HTMLButtonElement>('[role="combobox"]')!;
  act(() => declencheur.focus());
  return { container, declencheur, choisir };
}

describe('MediaSelect (listbox popup)', () => {
  it('ArrowDown/Home entrent sur la première option, ArrowUp/End sur la dernière', () => {
    for (const [key, attendu] of [['ArrowDown', 'O0'], ['Home', 'O0'], ['ArrowUp', 'O2'], ['End', 'O2']]) {
      const { declencheur } = monterListe();
      touche(declencheur, key);
      expect(declencheur.getAttribute('aria-expanded'), key).toBe('true');
      expect(texteFocalise(), key).toBe(attendu);
      demonterRacines();
    }
  });

  it('une seule option dans l’ordre de tabulation : la sélectionnée, sinon la première', () => {
    const tabindex = (c: HTMLElement) => [...c.querySelectorAll('[role="option"]')].map((o) => o.getAttribute('tabindex'));
    expect(tabindex(monterListe().container)).toEqual(['0', '-1', '-1']);
    demonterRacines();
    expect(tabindex(monterListe('O1').container)).toEqual(['-1', '0', '-1']);
  });

  it('choisir une option ferme la liste et rend le focus au déclencheur', () => {
    const { declencheur, choisir } = monterListe();
    touche(declencheur, 'ArrowDown');
    touche(document.activeElement!, 'ArrowDown');
    touche(document.activeElement!, 'Enter');
    expect(choisir).toHaveBeenCalledWith('O1');
    expect(declencheur.getAttribute('aria-expanded')).toBe('false');
    expect(document.activeElement).toBe(declencheur);
  });
});

/** Arme de mêlée à une main NOMMÉE du banc, écrite à la main : seule sa catégorie porte le contrat. */
const armeDeBanc = (id: string, label: string): TrappingData => ({
  id, label, categorie: 'melee', subType: 'base', enc: 0, availability: 'Commune', reach: 'Moyenne',
  loc: null, pa: null, damage: { plusBF: true, flat: 1 }, qualities: [], price: { gold: 0, silver: 1, brass: 0 },
  source: { book: 'livre-de-base', page: 1 },
});

describe('Emplacement d’arme de la fiche héros (onglet Possessions)', () => {
  const heros = (): Combatant => {
    setDataset('trappings', [armeDeBanc('arme-de-banc-1', 'Arme de banc 1'), armeDeBanc('arme-de-banc-2', 'Arme de banc 2')]);
    const c = {
      id: 'h', label: 'H', kind: 'hero',
      characteristics: { 'capacite-de-combat': 30, 'capacite-de-tir': 30, force: 30, endurance: 30, initiative: 30, agilite: 30, dexterite: 30, intelligence: 30, 'force-mentale': 30, sociabilite: 30 },
      wounds: { current: 12, max: 12 }, advantage: 0, conditions: [], skills: [], talents: [], movement: 4, xp: 0,
      items: [
        { ...itemFromTrappingById('arme-de-banc-1')!, uid: 'main', equipped: true },
        { ...itemFromTrappingById('arme-de-banc-2')!, uid: 'seconde', equipped: false },
      ],
    } as unknown as Combatant;
    recomputeLoadout(c);
    return c;
  };
  function monterFiche() {
    const h = heros();
    useGame.setState({ party: [h], battle: null, sheetId: h.id, sheetTab: 'possessions' });
    const fermerFiche = vi.fn();
    const { container } = monterRacine(<CharacterSheet heroId={h.id} onClose={fermerFiche} />);
    const emplacement = container.querySelector<HTMLButtonElement>('.set-card button.eq-slot.empty')!;
    act(() => emplacement.focus());
    return { container, emplacement, fermerFiche };
  }

  it('Échap ferme le popup de l’emplacement, pas la fiche', () => {
    const { container, emplacement, fermerFiche } = monterFiche();
    touche(emplacement, 'ArrowDown');
    expect(emplacement.getAttribute('aria-expanded')).toBe('true');
    expect(document.activeElement?.getAttribute('role')).toBe('option');
    echap();
    expect(emplacement.getAttribute('aria-expanded')).toBe('false');
    expect(fermerFiche).not.toHaveBeenCalled();
    expect(container.querySelector('[role="dialog"]')).toBeTruthy();
    expect(document.activeElement).toBe(emplacement);
  });

  it('choisir une arme : le focus revient au déclencheur de l’emplacement, que la cellule remplie garde', () => {
    const { emplacement } = monterFiche();
    touche(emplacement, 'ArrowDown');
    touche(document.activeElement!, 'ArrowDown');
    expect(document.activeElement?.getAttribute('role'), 'la seconde option, la seule arme candidate').toBe('option');
    touche(document.activeElement!, 'Enter');
    expect(emplacement.isConnected, 'la cellule remplie garde le même déclencheur').toBe(true);
    expect(emplacement.classList.contains('filled')).toBe(true);
    expect(document.activeElement).toBe(emplacement);
  });
});
