import type { QuadProps } from '../quadSkeleton';

/**
 * Un SET D'ÉQUIPEMENT de quadrupède (sellerie, bât, barde) = un fichier `harnais/defs/<id>.ts`
 * (patron des parts `heads/`, `tails/`, `manes/`), collecté par `npm run gen`.
 *
 *   - `id`      : id du set (kebab-case) ; l'union `QuadHarnaisId` en est DÉRIVÉE (registre généré).
 *   - `especes` : gabarits pour lesquels l'art de ce set est CUIT — un set s'authore par un dessin
 *                 `atelier/harnais/<id>@<espèce>-<vue>.dessin.mts` et ses coordonnées sortent du
 *                 squelette de CETTE espèce (`bodyLen`/`neckLen` cuits dans l'art de tronc et
 *                 d'encolure) : posé sur une autre carrure il glisse.
 *   - `deco`    : l'art par os, dans le vocabulaire EXISTANT du calque par-os de la bête
 *                 (`QuadProps.deco` — clé `QuadDecoKey`, construite par `quadDecoKey` et lue par
 *                 `readQuadDecoKey` : clé nue = toutes les vues, clé `os#vue` = cette vue seule ;
 *                 valeur = SVG nu ou fragments déclarant leur `plan`). Aucun type de données propre :
 *                 un set est de la déco, servie depuis un registre au lieu d'une def d'espèce.
 */
export interface QuadHarnaisDef {
  id: string;
  label: string;
  especes: readonly string[];
  deco: NonNullable<QuadProps['deco']>;
}
