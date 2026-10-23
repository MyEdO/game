/** Icône UI SVG maison (à la place des emojis d'affordance). Charte : voir defs/action.ts. */
export interface IconDef {
  /** `famille/nom` en kebab-case (ex. `action/attack`, `ui/wait`). */
  id: string;
  /** Libellé FR (tooltip par défaut, galerie QC). */
  label: string;
  /** Contenu INTERNE d'un viewBox 0 0 24 24 — consomme `currentColor`, jamais de couleur en dur
   *  (accent `var(--gold)` toléré avec parcimonie). */
  svg: string;
}

/** Un fichier defs/ = une famille (plusieurs icônes du même domaine). */
export type IconFamily = IconDef[];

import type { IconIdGenerated } from '../../data/icones.generated';

/** Id d'icône AUTHORÉ (tables TS, champs typés) : union GÉNÉRÉE depuis les defs
 *  (`npm run gen`) — un id inventé ne compile pas. */
export type IconId = IconIdGenerated;

/** Id d'icône côté RENDU (`Icon`/`IconG`/`iconSvg`) : accepte AUSSI un id porté par la DONNÉE
 *  (`string` JSON — activities.icon, calendarPhases.icon, vehicles.icon…), validé au runtime par
 *  le throw DEV du rendu — pas de cast côté data, autocomplete conservée côté code. */
export type IconIdInput = IconId | (string & {});
