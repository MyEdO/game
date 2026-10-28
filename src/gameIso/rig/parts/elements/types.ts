import type { RaceFeature } from '../../races/types';

/** Famille d'un élément d'apparence (pour les pickers de l'éditeur + la sémantique de slot). */
export type ElementCategory = 'oeil' | 'tete' | 'bras' | 'jambes' | 'trait' | 'morpho' | 'mutation';

/** Calque d'un élément : superset RaceFeature (scale, traits de corps) + RigOverlay (replace/behind,
 *  membres remplacés / mutations). UN seul type pour tout le catalogue. */
export type ElementOverlay = RaceFeature & { replace?: boolean; behind?: boolean };

/**
 * Un ÉLÉMENT d'apparence réutilisable — vocabulaire UNIQUE (comme `GameOp` côté mécanique). Effets
 * cumulables : calques (`overlays`), remplacement d'œil (`eye`), morpho (`build`/`legs`), visage retourné (`faceFlip`). 1 élément = 1 fichier `defs/<key>.ts` (registre auto-chargé :
 * en ajouter un = déposer un fichier).
 */
export interface AppearanceElement {
  /** Clé stable (référencée par appearance.features / RaceDef / éditeur). */
  key: string;
  label: string;                 // FR — pour les pickers de l'éditeur
  category: ElementCategory;
  overlays?: ElementOverlay[];
  eye?: { G?: string; D?: string };
  build?: number; legs?: number;
  faceFlip?: boolean;
}
