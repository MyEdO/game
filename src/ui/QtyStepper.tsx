import type { ReactNode } from 'react';
import { GatedAction, raisonSi } from './GatedAction';

/**
 * Stepper de quantité CANONIQUE (#371 LOT 3) — moissonné de la table marchande étalon
 * (`MerchantPanel` panier/parcourir : `.btn-step`/`.cart-step`). Un triplet [décrémenter, centre,
 * incrémenter] — le centre n'est pas forcément un compteur numérique (ex. « Baisse des prix » :
 * disponibilité de l'acheteur au lieu d'un nombre) : `center` reste un `ReactNode` libre.
 *
 * DEUX formes de borne atteinte, selon ce que le site a à DIRE, combinables pas par pas :
 *  - `decDisabled`/`incDisabled` : borne MUETTE — rien à expliquer (« 0 », « tout le stock ») ;
 *  - `refus` : borne RAISONNÉE — le pas porte sa cause, rendue par `GatedAction` (`aria-disabled` +
 *    infobulle + copie hors écran liée en `aria-describedby`), jamais un `title` muet. Une raison
 *    l'emporte sur la borne muette du même pas. Un site qui a une raison la passe ICI plutôt que de
 *    dériver son propre stepper (#1806).
 *  `decTitle`/`incTitle` décrivent le pas OFFERT.
 */
export function QtyStepper({
  center,
  onDec,
  onInc,
  decDisabled,
  incDisabled,
  decLabel,
  incLabel,
  decTitle,
  incTitle,
  decContent = '−',
  incContent = '+',
  refus,
}: {
  center: ReactNode;
  onDec: () => void;
  onInc: () => void;
  decDisabled?: boolean;
  incDisabled?: boolean;
  decLabel: string;
  incLabel: string;
  decTitle?: string;
  incTitle?: string;
  decContent?: ReactNode;
  incContent?: ReactNode;
  /** Raisons de REFUS par pas : `id` préfixe les contrôles gatés. */
  refus?: { id: string; dec?: string; inc?: string };
}) {
  const pas = (sens: 'dec' | 'inc') => {
    const raison = sens === 'dec' ? refus?.dec : refus?.inc;
    const ferme = sens === 'dec' ? decDisabled : incDisabled;
    const contenu = sens === 'dec' ? decContent : incContent;
    const nom = sens === 'dec' ? decLabel : incLabel;
    const titre = sens === 'dec' ? decTitle : incTitle;
    const agir = sens === 'dec' ? onDec : onInc;
    // Sous `refus`, un pas ouvert reste le MÊME contrôle que refermé : le focus survit à la bascule.
    if (refus && (raison || !ferme)) {
      return <GatedAction id={`${refus.id}-${sens}`} label={contenu} ariaLabel={nom} onClick={agir} primary={false} btnClassName="btn-step" enabled={!raison} {...raisonSi(raison)} descOfferte={titre} />;
    }
    if (ferme) return <button type="button" className="btn-step" disabled aria-label={nom}>{contenu}</button>;
    return <button type="button" className="btn-step" title={titre} onClick={agir} aria-label={nom}>{contenu}</button>;
  };
  return (
    <span className="cart-step">
      {pas('dec')}
      <span className="cart-n">{center}</span>
      {pas('inc')}
    </span>
  );
}
