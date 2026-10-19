import type { KeyboardEvent } from 'react';
import { estChamp } from '../focus';

/**
 * rovingKeyDown — invariant UNIQUE du roving tabindex (pattern WAI-ARIA) : flèches + Home/End
 * déplacent le focus d'un item du groupe à l'autre (#519). Fonction PURE (aucun hook interne) : le
 * conteneur est un simple `{ current: E | null }` fourni par l'appelant.
 *
 * `suivi` :
 *  - `'selection'` (défaut) : la sélection suit le focus — l'item atteint est ACTIVÉ (`onActivate`),
 *    l'index courant est l'item actif de l'appelant (onglets, listbox de sélection, radiogroup) ;
 *  - `'focus'` : le focus seul se déplace, l'index courant est l'item focalisé — l'activation reste au
 *    clic, à Entrée ou à Espace (menu, liste déroulante qui se referme au choix).
 *
 * `orientation: 'horizontal'` (défaut) n'écoute que Gauche/Droite/Home/End ; `'grid'` ajoute Haut/Bas
 * aliasés sur le même axe (liste à plat, pas de vraie grille 2D).
 *
 * Une touche consommée ne se propage pas : le groupe possède ses flèches, le roving générique de
 * `useModalA11y` (`Modal.tsx`) ne les rejoue pas quand le groupe vit dans une modale ou un `ScreenShell`.
 *
 * Un CHAMP de formulaire (`estChamp`) posé dans le groupe sans en être un item (le `<select>` de spécialisation
 * d'une carte de talent) garde ses flèches : elles éditent sa valeur, le groupe ne les prend pas.
 */
export function rovingKeyDown<E extends Element>(options: {
  containerRef: { current: E | null };
  /** Sélecteur CSS des éléments focalisables (`[role="tab"]`, `[role="option"]`, `[role="radio"]`…). */
  selector: string;
  orientation?: 'horizontal' | 'grid';
} & (
  | { suivi?: 'selection'; count: number; activeIndex: number; onActivate: (index: number) => void }
  | { suivi: 'focus' }
)) {
  const { containerRef, selector, orientation = 'horizontal' } = options;
  return (e: KeyboardEvent<E>) => {
    const keys =
      orientation === 'grid'
        ? ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End']
        : ['ArrowLeft', 'ArrowRight', 'Home', 'End'];
    if (!keys.includes(e.key)) return;
    const cible = e.target as Element;
    if (estChamp(cible) && !cible.matches(selector)) return;
    const items = Array.from(containerRef.current?.querySelectorAll<HTMLElement>(selector) ?? []);
    const count = options.suivi === 'focus' ? items.length : options.count;
    if (!count) return;
    e.preventDefault();
    e.stopPropagation();
    const courant = options.suivi === 'focus' ? Math.max(0, items.indexOf(document.activeElement as HTMLElement)) : options.activeIndex;
    const delta = e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : 0;
    const next = e.key === 'Home' ? 0 : e.key === 'End' ? count - 1 : (courant + delta + count) % count;
    if (options.suivi !== 'focus') options.onActivate(next);
    items[next]?.focus();
  };
}
