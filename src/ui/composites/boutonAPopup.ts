import { useCallback, useEffect, useRef, useState, type FocusEvent, type KeyboardEvent, type MouseEvent } from 'react';
import { poserFocus } from '../focus';

type Entree = 'premier' | 'dernier';

const ENTREE_PAR_TOUCHE: Partial<Record<string, Entree>> = { ArrowDown: 'premier', Home: 'premier', ArrowUp: 'dernier', End: 'dernier' };

/**
 * Bouton à popup — ouverture, entrée et sortie du focus d'un déclencheur et de son popup, en UN seul
 * endroit (WAI-ARIA APG, Menu Button Pattern ; Combobox Pattern, liste déroulante) :
 *  - ArrowDown/Home sur le déclencheur ouvrent le popup et focalisent son premier item, ArrowUp/End
 *    son dernier ; une ouverture au clavier (`click` sans pointeur : Entrée, Espace, manette) entre
 *    sur le premier ;
 *  - `fermer()` (Échap, choix d'une entrée) rend le focus au déclencheur quand il était dans la racine
 *    ou perdu, jamais quand le joueur l'a posé ailleurs ;
 *  - le focus qui part sur un élément hors de la racine (Tab, Maj+Tab) ferme sans rien rendre, comme
 *    un `pointerdown` hors de la racine.
 * Les rôles du popup et de ses items restent à la primitive qui le peint (`Menu`, `Listbox`).
 * @param items sélecteur des items focalisables du popup, cherchés dans la racine.
 */
export function useBoutonAPopup<R extends HTMLElement>({ popup, items }: { popup: 'menu' | 'listbox'; items: string }) {
  const [ouvert, setOuvert] = useState(false);
  const racineRef = useRef<R>(null);
  const declencheurRef = useRef<HTMLButtonElement>(null);
  const aEntrer = useRef<Entree | null>(null);

  const focaliser = (entree: Entree) => {
    const liste = [...(racineRef.current?.querySelectorAll<HTMLElement>(items) ?? [])];
    liste[entree === 'premier' ? 0 : liste.length - 1]?.focus();
  };
  const entrer = (entree: Entree) => {
    if (ouvert) focaliser(entree);
    else {
      aEntrer.current = entree;
      setOuvert(true);
    }
  };

  useEffect(() => {
    if (!ouvert) return;
    const entree = aEntrer.current;
    aEntrer.current = null;
    if (entree) focaliser(entree);
    const onDown = (e: PointerEvent) => {
      if (!racineRef.current?.contains(e.target as Node)) setOuvert(false);
    };
    document.addEventListener('pointerdown', onDown);
    return () => document.removeEventListener('pointerdown', onDown);
  }, [ouvert]);

  const fermer = useCallback(() => {
    setOuvert(false);
    const d = declencheurRef.current;
    const ae = document.activeElement;
    if (d?.isConnected && (!ae || ae === document.body || racineRef.current?.contains(ae))) poserFocus(d);
  }, []);

  return {
    ouvert,
    fermer,
    racine: {
      ref: racineRef,
      onBlur: (e: FocusEvent<R>) => {
        const vers = e.relatedTarget;
        if (vers instanceof Node && !e.currentTarget.contains(vers)) setOuvert(false);
      },
    },
    declencheur: {
      ref: declencheurRef,
      'aria-haspopup': popup,
      'aria-expanded': ouvert,
      onClick: (e: MouseEvent<HTMLButtonElement>) => {
        if (ouvert) setOuvert(false);
        else if (e.detail === 0) entrer('premier');
        else setOuvert(true);
      },
      onKeyDown: (e: KeyboardEvent<HTMLButtonElement>) => {
        const entree = ENTREE_PAR_TOUCHE[e.key];
        if (!entree) return;
        e.preventDefault();
        e.stopPropagation();
        entrer(entree);
      },
    },
  };
}
