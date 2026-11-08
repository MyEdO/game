/**
 * BÂTIMENTS DU MONDE (#1715) — vue TS de `buildings.json`, catalogue UNIQUE des types de bâtiment.
 *
 * Une entrée porte la couverture de référence du type et les ornements d'identité que le rendu émet
 * en billboard. Le bâtiment réel est fait de murs d'arête (`WallSeg`) sur un sol de terrain, sa nappe
 * de toit venant du pivot `noyau/monde/volume/toits.ts`.
 *
 * Le fichier porte UNE forme d'entrée (schéma `schemas/defs/buildings.ts`) : le handle de la
 * fabrique scelle ses nœuds (`z.infer` vaut `unknown`), aucun type n'est dérivé du schéma — la vue
 * TS est déclarée ici, comme `terrains.types.ts`.
 */

/** Un ornement d'identité : un décor de `props.json` accroché à un ancrage du bâtiment. */
export interface BuildingFeature {
  /** Id de l'entrée de `props.json` posée en billboard (clocheton, cheminee, enseigne, etal-marche). */
  id: string;
  /** Où sur le bâtiment : `ridge` = faîte (surélevé au toit) ; `facade` = au-dessus de la porte (mur,
   *  orienté vers l'extérieur) ; `front` = au sol juste DEVANT la porte (orienté vers l'extérieur). */
  anchor: 'ridge' | 'facade' | 'front';
}

/** L'ENTRÉE de `buildings.json` : l'enveloppe du document, la méta de pose, les ornements. */
export interface BuildingDef {
  id: string;
  type: 'buildings';
  label: string;
  /** Provenance MAISON en clair — aucun folio n'imprime de catalogue de bâtiments (`grammaire/document.ts`). */
  maison: string;
  /** Couverture de référence du type (id de `materials.json`, domaine `roof`). */
  roofMaterial: string;
  /** Ornements d'identité que le rendu pose en billboard. Absent = bâtiment sobre. */
  features?: BuildingFeature[];
}
