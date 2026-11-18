import { libelleDuStatut, type Status } from '../engine/money';

/**
 * MetalStatus — chip statut métallisé (Bronze/Argent/Or + échelon), charte « Atelier du scribe »
 * (#412, ratifiée ticket #412). La couleur suit l'Échelon du `Status` (SOURCE UNIQUE — jamais un
 * `switch` de couleur recopié à la main). `size='chip'` pour une pastille en ligne (rangée de
 * carrière) ; `size='plaque'` pour la plaque scellée d'élu.
 */
export function MetalStatus({ status, size = 'chip' }: { status: Status; size?: 'chip' | 'plaque' }) {
  return <span className={`metal-status metal-status-${size} st-${status.tier}`}>{libelleDuStatut(status)}</span>;
}
