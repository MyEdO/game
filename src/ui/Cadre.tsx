import type { ReactNode } from 'react';
import { Row } from './Layout';

/**
 * Gestes d'un CADRE, partagés par les trois cadres (`Modal`, `EmbeddedShell`, `ScreenShell`), qui les
 * composent : le pied (`CadrePied`) et la croix (`CadreFermer`). Feuille : `styles/cadre.css`.
 */

/** Le PIED d'un cadre, comme sélecteur. */
export const PIED_DU_CADRE = '.cadre-pied';

/** Le bouton PRIMAIRE actif du pied : la cible du focus et le repli d'Entrée d'un dialogue. */
export const PRIMAIRE_DU_PIED = `${PIED_DU_CADRE} .btn-primary:not([disabled])`;

/** La croix d'un cadre : jamais sa cible de focus (`focusTarget`, `Modal.tsx`), Entrée fermerait. */
export const CROIX_DU_CADRE = '.cadre-fermer';

/** PIED d'un cadre : ses gestes de sortie, hors du défileur, sous un filet (patron `MenuCard`
 *  `footer`), à la largeur du corps. Un seul JSX pour les trois cadres. */
export function CadrePied({ children }: { children?: ReactNode }) {
  if (children == null || children === false) return null;
  return <Row justify="end" className="cadre-pied">{children}</Row>;
}

/** CROIX de fermeture d'un cadre (`Modal` `croix`, `ScreenShell`) : un geste du CADRE, rendu en
 *  tête, jamais recopié par un contenu. Sans libellé, la croix nue porte le nom « Fermer ». */
export function CadreFermer({ onClose, children }: { onClose: () => void; children?: ReactNode }) {
  return (
    <button type="button" className="btn small cadre-fermer" onClick={onClose} aria-label={children == null ? 'Fermer' : undefined}>
      {children ?? '✕'}
    </button>
  );
}
