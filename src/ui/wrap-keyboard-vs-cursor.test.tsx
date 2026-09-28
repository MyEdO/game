// @vitest-environment jsdom
/**
 * Recette B3a, capture 04 — la porte clavier de la fiche PERDAIT la course en combat : `↓` sur un
 * bouton de pool ouvrait l'infobulle ET déplaçait le curseur tactique (binding `cursor-down`), qui
 * volait le focus au passage.
 *
 * Deux niveaux, mesurés SÉPARÉMENT :
 *  (A) SOCLE — un CONTRÔLE focalisé possède ses flèches : les bindings `cursor-*` portent
 *      `notWhenControlFocused`, donc le registre ne les élit pas quand un bouton a le focus ;
 *  (B) GESTE — `CodexRef` en mode `wrap` CONSOMME la touche (`stopImmediatePropagation`), donc
 *      aucun listener global ne la voit, même un futur qui ne consulterait pas le registre.
 */
import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { useGame } from '../state/store';
import { elireBinding } from '../state/keybindings';
import { useGameKeyboard } from './useGameKeyboard';
import { ResilienceButton } from './ResilienceButton';

/** L'élection du clavier (`elireBinding`), la même que `useGameKeyboard.ts::onKey`. */
const dispatchBinding = (code: string, s: ReturnType<typeof useGame.getState>, controlFocused: boolean) =>
  elireBinding(code, s, { controlFocused });

/** État de combat où le curseur tactique EST piloté (`curOrPreempt` vrai) — même fabrique que
 *  `push-keyboard-commit.test.ts` : c'est le contexte où la course avait lieu. */
const combatState = () => ({
  ...useGame.getState(), mode: 'battle',
  battle: { over: null, action: null, order: ['chef'], turn: 0, combatants: [{ id: 'chef', kind: 'hero' }], movementUsed: 0 },
  combatCursor: null, net: { mode: 'local', mySeat: 0 }, dialogue: null,
}) as never;

describe('(A) SOCLE — un contrôle focalisé possède ses flèches (#1078)', () => {
  it('binding actif SANS focus de contrôle : ↓ pilote bien le curseur tactique', () => {
    expect(dispatchBinding('ArrowDown', combatState(), false)?.id).toBe('cursor-down');
  });

  it('MÊME contexte, un BOUTON focalisé : le registre n’élit PLUS le curseur', () => {
    expect(dispatchBinding('ArrowDown', combatState(), true)).toBeUndefined();
  });

  it('les QUATRE flèches sont couvertes (pas seulement celle de la recette)', () => {
    for (const code of ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']) {
      expect(dispatchBinding(code, combatState(), true), `${code} vole encore le focus`).toBeUndefined();
    }
  });
});

function Harness() {
  useGameKeyboard();
  return <ResilienceButton resilience={2} show onForce={() => {}} />;
}

describe('(B) GESTE — ↓ sur le bouton de pool ouvre la PORTE, le curseur ne bouge pas', () => {
  beforeAll(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  });
  let host: HTMLDivElement;
  let root: Root;
  beforeEach(() => {
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
    useGame.setState({ screen: 'campaign', codexOverlay: null, combatCursor: null });
  });
  afterEach(() => {
    act(() => root.unmount());
    host.remove();
  });

  it('la touche est CONSOMMÉE : aucun listener global ne la voit, le focus va sur « Ouvrir la fiche »', () => {
    act(() => root.render(<Harness />));
    // Témoin : tout listener global de jeu est monté sur `window` (`useGameKeyboard`). S'il voit la
    // touche, le curseur tactique court avec elle — c'était le bug.
    const globalSpy = vi.fn();
    window.addEventListener('keydown', globalSpy);
    try {
      const btn = host.querySelector<HTMLButtonElement>('button')!;
      act(() => { btn.focus(); btn.dispatchEvent(new FocusEvent('focusin', { bubbles: true })); });
      act(() => {
        btn.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', code: 'ArrowDown', bubbles: true, cancelable: true }));
      });
      const porte = document.querySelector<HTMLButtonElement>('.infobulle .codex-pop-open');
      expect(porte, 'la porte de la fiche doit s’être ouverte').toBeTruthy();
      expect(document.activeElement, 'le focus doit être SUR la porte, pas volé par le curseur').toBe(porte);
      expect(globalSpy, 'la touche a fui jusqu’au listener global → le curseur tactique court avec').not.toHaveBeenCalled();
      expect(useGame.getState().combatCursor, 'le curseur tactique n’a pas bougé').toBeNull();
    } finally {
      window.removeEventListener('keydown', globalSpy);
    }
  });

  it('la porte clavier s’ANNONCE (elle ne se devine pas) : aria-keyshortcuts + title', () => {
    act(() => root.render(<Harness />));
    const wrapper = host.querySelector('.codex-ref')!;
    expect(wrapper.getAttribute('aria-keyshortcuts')).toBe('ArrowDown');
    expect(wrapper.getAttribute('title')).toContain('↓ : fiche');
  });
});

/** Hôte du clavier d'application, avec un bouton posé DANS une surface (`role`) ou hors d'elle. */
function Surface({ role }: { role?: 'tooltip' | 'dialog' }) {
  useGameKeyboard();
  return <div role={role}><button type="button">Ouvrir la fiche</button></div>;
}

describe('(C) SURFACE — un bouton focalisé dans un dialogue ou une infobulle possède Entrée', () => {
  beforeAll(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  });
  let host: HTMLDivElement;
  let root: Root;
  let commis = 0;
  const etat = () => ({ ...(combatState() as object), combatCursor: { tile: { x: 1, y: 1 } }, commitCursor: () => { commis += 1; } }) as never;
  beforeEach(() => {
    commis = 0;
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
  });
  afterEach(() => {
    act(() => root.unmount());
    host.remove();
    useGame.setState({ screen: 'campaign', codexOverlay: null, combatCursor: null });
  });
  const entree = () => {
    const btn = host.querySelector<HTMLButtonElement>('button')!;
    act(() => { btn.focus(); });
    act(() => { btn.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', bubbles: true, cancelable: true })); });
  };

  for (const role of ['tooltip', 'dialog'] as const) {
    it(`role="${role}" : Entrée active le bouton, le curseur tactique ne commet rien`, () => {
      act(() => root.render(<Surface role={role} />));
      act(() => { useGame.setState(etat()); });
      entree();
      expect(commis, `Entrée sur un bouton d’une surface ${role} a commis le curseur derrière`).toBe(0);
    });
  }

  it('hors surface (focus résiduel du bouton « Pousser », #199) : Entrée commet le curseur', () => {
    act(() => root.render(<Surface />));
    act(() => { useGame.setState(etat()); });
    entree();
    expect(commis, 'hors surface, Entrée appartient au curseur').toBe(1);
  });
});
