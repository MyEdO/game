// @vitest-environment jsdom
/**
 * Composants d'incantation sur la fiche (onglet Magie & Foi), règle courante : la section se rend sans option,
 * lie un composant à lier et en achète un lié. LDB 46 l.107-113 ; arbitrage #4132 du 2026-11-16
 */
import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { CharacterSheet } from './CharacterSheet';
import { useGame } from '../state/store';
import { createHero } from '../engine/character';
import { idsDeTest } from '../engine/idsDeTest.testkit';
import { objetDeTest } from '../engine/objetsDeTest.testkit';
import { withBourseMoney } from '../engine/bourse';
import { toMoney } from '../engine/money';
import { itemCapability } from '../engine/capabilities';
import type { Combatant } from '../engine/types';

const SPELL = 'mur-de-feu';

const sorcier = (): Combatant => {
  const h = withBourseMoney(createHero({ idNeuf: idsDeTest, speciesId: 'humains-reiklander', careerId: 'sorcier', label: 'Mage', seed: 3 }), toMoney({ gold: 100 }), idsDeTest);
  return { ...h, spells: [SPELL], items: [...(h.items ?? []), objetDeTest('composant-d-incantation', { uid: 'libre' })] };
};

const composants = () => (useGame.getState().party[0].items ?? []).filter((it) => itemCapability(it, 'isSpellComponent'));

describe('fiche — composants d’incantation (LDB 46 l.107-113)', () => {
  beforeAll(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  });
  let container: HTMLDivElement | undefined;
  let root: Root | undefined;
  function mount(): HTMLDivElement {
    const h = sorcier();
    useGame.setState({ party: [h], battle: null, sheetId: h.id, sheetTab: 'magie' });
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    act(() => { root!.render(<CharacterSheet heroId={h.id} onClose={() => {}} />); });
    return container;
  }
  afterEach(() => {
    if (root) act(() => { root!.unmount(); });
    container?.remove();
    root = undefined;
    container = undefined;
  });
  const bouton = (label: string): HTMLButtonElement => {
    const b = container!.querySelector<HTMLButtonElement>(`[aria-label="${label}"]`);
    expect(b, `bouton « ${label} »`).toBeTruthy();
    return b!;
  };

  it('la section se rend, avec le composant à lier', () => {
    const c = mount();
    expect(c.querySelector('.spell-components')?.textContent).toContain('1 à lier');
  });

  it('« Lier » lie le composant à lier au Sort de sa rangée', () => {
    mount();
    act(() => { bouton('Lier un composant à Mur de feu').click(); });
    expect(composants().map((it) => [it.uid, it.sortLie])).toEqual([['libre', SPELL]]);
  });

  it('l’achat ajoute un composant lié au Sort', () => {
    mount();
    act(() => { bouton('Acheter un composant pour Mur de feu').click(); });
    expect(composants().map((it) => it.sortLie)).toEqual([undefined, SPELL]);
  });
});
