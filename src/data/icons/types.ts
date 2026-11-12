/** Icône UI SVG maison (LOT 4 — remplace les emojis d'affordance). Charte : voir defs/action.ts. */
export interface IconDef {
  /** `famille/nom` en kebab-case (ex. `action/attaquer`, `interface/attendre`). */
  id: IconId;
  /** Libellé FR (tooltip par défaut, galerie QC). */
  label: string;
  /** Contenu INTERNE d'un viewBox 0 0 24 24 — consomme `currentColor`, jamais de couleur en dur
   *  (accent `var(--gold)` toléré avec parcimonie). */
  svg: string;
}

/** Un fichier defs/ = une famille (plusieurs icônes du même domaine). */
export type IconFamily = IconDef[];

import type { IconIdGenerated } from '../icones.generated';

/** Id d'icône : union GÉNÉRÉE depuis les defs (`npm run gen`) — un id inventé ne compile pas. */
export type IconId = IconIdGenerated;
