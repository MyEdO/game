/**
 * BOÎTE ANCRÉE — une surface en `position: fixed`, rendue en portail, placée contre le rectangle de
 * son ANCRAGE (l'élément qui l'a fait naître). Une seule mesure et un seul placement pour la couche
 * d'infobulle (`Infobulle.tsx`), le panneau-paramètre (`PanneauParametre.tsx`) et le menu d'ajout de
 * l'atelier (`editor/AddMenu.tsx`).
 *
 * `placerAncre` pose la boîte du côté (dessous/dessus) qui a le plus de place, ancrée par le HAUT
 * (dessous) ou par le BAS (dessus, sans deviner sa hauteur) ; `maxHeight` est borné à cette place et
 * à 60 % du viewport, la largeur au viewport. Horizontalement, la boîte s'aligne sur le bord GAUCHE de
 * l'ancrage ; si elle déborde ainsi, sur son bord DROIT ; si elle déborde des deux façons, sur la
 * marge de la fenêtre la plus proche.
 *
 * `usePlacementAncre` calcule le placement PENDANT LE RENDU qui reçoit un ancrage neuf : le commit
 * d'ouverture porte déjà la boîte placée, et un effet de ce même commit (le focus d'entrée) la trouve.
 * Après ce commit, une mesure de contrôle (le commit d'ouverture a pu déplacer l'ancrage), puis tant
 * que l'ancrage est posé, chaque défilement (écouté à la capture : tout conteneur) ou
 * redimensionnement recalcule le placement ; un placement égal champ à champ ne rend rien. Un ancrage
 * détaché du document n'a aucun placement, donc aucune boîte.
 *
 * Le style n'est QUE des variables `--ancre-*`, lues par `.boite-ancree` (`styles/boite-ancree.css`).
 * `CHAMPS` liste les champs du placement, sa complétude est prouvée par le type ; l'égalité en dérive.
 * Le littéral de `style=` est la seule écriture des noms de variables (objet littéral : la seule forme
 * admise, `ui-ratchets.test.ts` (xxii)) ; sa complétude n'est pas prouvée par le type, (xxii)
 * l'interdit ; `BoiteAncree.test.tsx` vérifie les cinq variables qu'il nomme.
 */
import { forwardRef, useEffect, useState, type CSSProperties, type HTMLAttributes } from 'react';
import { createPortal } from 'react-dom';

export interface PlacementAncre {
  left: number;
  /** Ancrée par le HAUT (dessous l'ancrage) : `bottom` absent. */
  top?: number;
  /** Ancrée par le BAS (dessus l'ancrage) : `top` absent. */
  bottom?: number;
  maxHeight: number;
  width: number;
}

const NOMMES = ['left', 'top', 'bottom', 'maxHeight', 'width'] as const satisfies readonly (keyof PlacementAncre)[];
const CHAMPS: Exclude<keyof PlacementAncre, (typeof NOMMES)[number]> extends never ? typeof NOMMES : never = NOMMES;

const ECART = 6;
const MARGE = 8;

export function placerAncre(
  rect: { left: number; right: number; top: number; bottom: number },
  vw: number,
  vh: number,
  largeur: number,
): PlacementAncre {
  const width = Math.min(largeur, vw - 2 * MARGE);
  const tient = (x: number) => x >= MARGE && x + width <= vw - MARGE;
  const parDroite = rect.right - width;
  const left = tient(rect.left) ? rect.left
    : tient(parDroite) ? parDroite
      : Math.max(MARGE, Math.min(rect.left, vw - width - MARGE));
  const dessous = vh - rect.bottom - ECART - MARGE;
  const dessus = rect.top - ECART - MARGE;
  const plafond = Math.floor(vh * 0.6);
  return dessous >= dessus
    ? { left, top: rect.bottom + ECART, maxHeight: Math.max(0, Math.min(dessous, plafond)), width }
    : { left, bottom: vh - rect.top + ECART, maxHeight: Math.max(0, Math.min(dessus, plafond)), width };
}

const placementsEgaux = (a: PlacementAncre | null, b: PlacementAncre | null): boolean =>
  a === b || (!!a && !!b && CHAMPS.every((k) => a[k] === b[k]));

const mesurer = (ancre: Element | null, largeur: number): PlacementAncre | null =>
  ancre?.isConnected ? placerAncre(ancre.getBoundingClientRect(), window.innerWidth, window.innerHeight, largeur) : null;

export function usePlacementAncre(ancre: Element | null, largeur: number): PlacementAncre | null {
  const [vu, setVu] = useState(() => ({ ancre, largeur, placement: mesurer(ancre, largeur) }));
  let courant = vu;
  if (vu.ancre !== ancre || vu.largeur !== largeur) {
    courant = { ancre, largeur, placement: mesurer(ancre, largeur) };
    setVu(courant);
  }
  useEffect(() => {
    if (!ancre) return;
    const replacer = () => setVu((prec) => {
      const placement = mesurer(ancre, largeur);
      return placementsEgaux(prec.placement, placement) ? prec : { ancre, largeur, placement };
    });
    replacer();
    window.addEventListener('scroll', replacer, true);
    window.addEventListener('resize', replacer);
    return () => {
      window.removeEventListener('scroll', replacer, true);
      window.removeEventListener('resize', replacer);
    };
  }, [ancre, largeur]);
  return courant.placement;
}

/** Valeur CSS d'un champ du placement : `auto` pour le bord qui n'ancre pas. */
const px = (p: PlacementAncre, k: keyof PlacementAncre): string => (p[k] == null ? 'auto' : `${p[k]}px`);

type BoiteAncreeProps = Omit<HTMLAttributes<HTMLDivElement>, 'style'> & { placement: PlacementAncre };

export const BoiteAncree = forwardRef<HTMLDivElement, BoiteAncreeProps>(function BoiteAncree(
  { placement, className, ...rest },
  ref,
) {
  return createPortal(
    <div
      ref={ref}
      className={`boite-ancree${className ? ` ${className}` : ''}`}
      style={{
        '--ancre-left': px(placement, 'left'),
        '--ancre-top': px(placement, 'top'),
        '--ancre-bottom': px(placement, 'bottom'),
        '--ancre-h': px(placement, 'maxHeight'),
        '--ancre-w': px(placement, 'width'),
      } as CSSProperties}
      {...rest}
    />,
    document.body,
  );
});
