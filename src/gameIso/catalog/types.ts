import type { Dims } from '../../geometry/iso';
import type { Dir4, Dir8 } from '../../state/dir8';
import type { ViewArt } from '../rig/viewArt';

export type ParamField =
  | { key: string; label: string; type: 'number'; min?: number; max?: number; step?: number }
  | { key: string; label: string; type: 'select'; options: { value: string; label: string }[] }
  | { key: string; label: string; type: 'color' };

export interface RenderCtx {
  dims: Dims;
  /** Orientation du bâtiment (place la porte visible côté façade) — modèle 4 directions. */
  facing?: Dir4;
  /** Orientation MONDE d'une entité/prop (Dir8, même repère que le rig). La MACHINERIE (`propSvg`) la
   *  projette dans le repère caméra via `project(dir, dims.rot)` pour sélectionner la vue d'un prop
   *  DIRECTIONNEL (`PropViz.views`) → il PIVOTE avec la caméra ; une def ne projette JAMAIS elle-même. */
  dir?: Dir8;
  /** Scène nocturne → fenêtres éclairées. */
  night?: boolean;
}

/** Vues d'un prop DIRECTIONNEL — variante PARAMÉTRÉE (args `(params, ctx)`) du contrat d'art orienté
 *  PARTAGÉ `ViewArt` (le MÊME que les engins/navire/gabarit terrestre). Chaque vue dessine dans la boîte
 *  locale 120×150 (pieds en 60,150), le PROFIL tourné vers la DROITE ; le profil gauche s'obtient par
 *  MIROIR dans la machinerie (`propSvg`), jamais dans la def. Une vue peut être ABSENTE → la vue demandée
 *  REPLIE sur la plus proche déclarée (`pickView`) ; une def ne sélectionne JAMAIS sa vue elle-même. */
export type PropViews = ViewArt<[Record<string, unknown>, RenderCtx]>;

export interface PropViz {
  id: string;
  label: string;
  /** Décor « naturellement fouillable/ramassable » : l'éditeur pré-arme `interact` à la pose (SP2↔SP1). */
  searchable?: boolean;
  paramsSchema?: ParamField[];
  /** Prop NON directionnel (billboard symétrique — un tonneau n'a pas de dos) : un seul dessin. */
  render?(params: Record<string, unknown>, ctx: RenderCtx): string;
  /** Prop DIRECTIONNEL : déclare ses trois vues. La MACHINERIE (`propSvg`) sélectionne la vue + le
   *  miroir via `project(ctx.dir, ctx.dims.rot)`. Exclusif de `render`. */
  views?: PropViews;
}
