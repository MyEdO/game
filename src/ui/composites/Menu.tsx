import { useRef, type ReactNode } from 'react';
import { rovingKeyDown } from './rovingFocus';

export type EntreeDeMenu =
  | { cle: string; label: ReactNode; onSelect: () => void }
  | { cle: string; separateur: true };

/** Entrées d'un `Menu` atteignables au clavier. */
export const ENTREE_DE_MENU = '[role="menuitem"]';

/**
 * Menu — liste `role="menu"` d'entrées `role="menuitem"` (WAI-ARIA Menu) : flèches et Home/End
 * déplacent le focus seul (`rovingKeyDown`, `suivi: 'focus'`), l'entrée s'active au clic, à Entrée ou
 * à Espace. Le déclencheur, l'ouverture et la fermeture : `useBoutonAPopup`, posé par l'appelant
 * (`EditorToolbar`).
 */
export function Menu({ entrees, label, className }: { entrees: EntreeDeMenu[]; label?: string; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const onKeyDown = rovingKeyDown<HTMLDivElement>({ containerRef: ref, selector: ENTREE_DE_MENU, orientation: 'grid', suivi: 'focus' });
  const premier = entrees.find((e) => !('separateur' in e))?.cle;
  return (
    <div ref={ref} role="menu" aria-label={label} className={className ? `menu-list ${className}` : 'menu-list'} onKeyDown={onKeyDown}>
      {entrees.map((e) =>
        'separateur' in e ? (
          <hr key={e.cle} />
        ) : (
          <button key={e.cle} type="button" role="menuitem" className="menu-item" tabIndex={e.cle === premier ? 0 : -1} onClick={e.onSelect}>
            {e.label}
          </button>
        ),
      )}
    </div>
  );
}
