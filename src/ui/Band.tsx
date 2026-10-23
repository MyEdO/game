/**
 * Bande titrée pleine largeur (fond bois/laiton, étalon = la planche ratifiée du créateur) — pour
 * les rubriques d'un panneau à plusieurs blocs (« Le tirage », « Augmentations gratuites », « Destin
 * & Résilience ») du créateur, et pour les bandes de section du registre État de la fiche
 * (`EtatPanel.tsx`, #492 Lot 1c). Consacrée en primitive PARTAGÉE hors `creator/` (elle n'a jamais
 * dépendu du gabarit d'étape — seule sa matière `.creator-band*` vivait par erreur dans le module du
 * créateur). Styles : `styles/band.css`.
 */
import type { ReactNode } from 'react';
import { Icon } from './Icon';

export function Band({
  title,
  right,
  children,
  onTitleClick,
  titleAriaLabel,
}: {
  title: ReactNode;
  right?: ReactNode;
  children?: ReactNode;
  /** Titre cliquable — bande de section renvoyant vers SA catégorie du Compendium (`EtatPanel.tsx`).
   *  Sans cette prop : titre statique. */
  onTitleClick?: () => void;
  titleAriaLabel?: string;
}) {
  return (
    <div className="creator-band">
      <div className="creator-band-head">
        <h3>
          {onTitleClick ? (
            <button type="button" className="creator-band-title-link" onClick={onTitleClick} aria-label={titleAriaLabel}>
              {title}
              <Icon id="nav/compendium" size="sm" className="creator-band-title-affordance" />
            </button>
          ) : (
            title
          )}
        </h3>
        {right && <span className="creator-band-right">{right}</span>}
      </div>
      {children}
    </div>
  );
}
