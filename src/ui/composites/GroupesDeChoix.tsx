import { useRef, type ReactNode } from 'react';
import { rovingKeyDown } from './rovingFocus';

/** Roving d'un groupe où la sélection suit le focus : l'appelant pose `tabIndex` 0 sur l'item
 *  `activeIndex`, -1 sur les autres, dans l'ordre du DOM. */
interface SelectionItinerante {
  suivi?: 'selection';
  /** Nombre d'items ACTIVABLES (ceux que vise le sélecteur du groupe). */
  count: number;
  activeIndex: number;
  onActivate: (index: number) => void;
  orientation?: 'horizontal' | 'grid';
}

interface Cadre {
  /** Nom accessible du groupe (`aria-label`). */
  label?: string;
  className?: string;
  children: ReactNode;
}

/** Options d'une `Listbox` atteignables au clavier. */
export const OPTION_ACTIVE = '[role="option"]:not([aria-disabled="true"])';

/**
 * Listbox — conteneur `role="listbox"` d'items `role="option"` (posés par l'appelant : `FigTile`,
 * bouton, `<li>`), clavier `rovingKeyDown`. `suivi: 'focus'` pour une liste qui se referme au choix
 * (`MediaSelect`) : les flèches ne déplacent que le focus.
 */
export function Listbox({ label, className, as = 'div', children, ...itinerance }: Cadre & { as?: 'div' | 'ul' } & (
  | SelectionItinerante
  | { suivi: 'focus'; orientation?: 'horizontal' | 'grid' }
)) {
  const ref = useRef<HTMLDivElement & HTMLUListElement>(null);
  const onKeyDown = rovingKeyDown<Element>({
    containerRef: ref,
    selector: OPTION_ACTIVE,
    orientation: 'grid',
    ...itinerance,
  });
  const attributs = { ref, role: 'listbox', 'aria-label': label, className, onKeyDown };
  return as === 'ul' ? <ul {...attributs}>{children}</ul> : <div {...attributs}>{children}</div>;
}

/**
 * RadioGroup — conteneur `role="radiogroup"` d'items `role="radio"` (posés par l'appelant), sélection
 * qui suit le focus ; un radio `disabled` sort du roving. `svg` : le groupe est un `<g>` d'un dessin
 * (`CelestialWheel`).
 */
export function RadioGroup({ label, className, svg, children, ...itinerance }: Cadre & SelectionItinerante & { svg?: boolean }) {
  const ref = useRef<HTMLDivElement & SVGGElement>(null);
  const onKeyDown = rovingKeyDown<Element>({
    containerRef: ref,
    selector: '[role="radio"]:not(:disabled)',
    orientation: 'grid',
    ...itinerance,
  });
  const attributs = { ref, role: 'radiogroup', 'aria-label': label, className, onKeyDown };
  return svg ? <g {...attributs}>{children}</g> : <div {...attributs}>{children}</div>;
}
