import { VIEWS, type View } from '../facing';
import { foldView } from '../viewArt';
import { tableTotale } from '../../../lib/tableTotale';

/** Fragment SVG dessiné dans le repère LOCAL de l'os porteur (origine au pivot). */
export interface Part { svg: string; }

/** Art TOTAL d'un slot de CORPS : les trois vues sont GARANTIES, une vue manquante est une erreur de
 *  compile. Produit à l'ingestion par `toViewSet` (`derive.ts`) à partir de l'art `PartArt` des
 *  registres (tenue/armure/générique/override) ; l'accès à une vue est `art[view]`. */
export type ViewSet = Record<View, string>;

/** Art d'une part : soit un seul SVG (la face, valable pour toutes les vues), soit un art orienté qui
 *  déclare sa face et, s'il les dessine, son dos et son profil. Format des registres à repli DÉCLARÉ
 *  (armes/boucliers/appendices/têtes/monstre), où une vue absente retombe sur la face (`viewOrFront`).
 *  Les slots de CORPS (tete/torse/jambes/bras) résolvent en `ViewSet` TOTAL (`toViewSet`). */
export type PartArt = string | (Pick<ViewSet, 'front'> & Partial<ViewSet>);

/** Ordre de repli d'un `PartArt` : la vue demandée, puis la face. */
const FRONT_FALLBACK = tableTotale(VIEWS, (view): readonly View[] => [view, 'front']);

/** SVG de la vue `view` d'un `PartArt`, repli sur la face (une chaîne vaut pour toute vue ; `null` et
 *  `undefined` rendent `''`). Sert les registres à repli DÉCLARÉ, jamais les slots de corps (#2000). */
export function viewOrFront(art: PartArt | undefined | null, view: View): string {
  return foldView(art, view, FRONT_FALLBACK) ?? '';
}

/** Base COMMUNE d'un def « équipement TENU » (silhouette sur un os de main) : armes ET boucliers.
 *  1 fichier = 1 def (registre auto-chargé `defs/`) ; les deux sont routés par SLUG (`shape`), jamais par libellé. */
export interface RigHeldDef {
  /** Clé de forme stable — ce par quoi l'art est routé (`shape`). */
  slug: string;
  /** Libellé d'affichage (= label du trapping ; sert aussi à la jointure label→slug à l'AUTHORING). PAS au routage runtime. */
  label: string;
  /** Cible silhouette-first (FR) — sert les workflows d'art. */
  target: string;
  /** Art dans le repère local de l'os porteur (arme : manche en (0,0), lame vers -y ; bouclier : centré ~cy6).
   *  String = même art toutes vues ; objet `{front,back?,profile?}` pour un art ORIENTÉ (ex. l'épée). */
  art: PartArt;
}
