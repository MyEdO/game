/**
 * TERRAINS DU MONDE (#1690) — vue TS de `terrains.json`, dataset UNIQUE des sols de la grille.
 *
 * UNE entrée porte la RÈGLE (franchissabilité, précédence de raccord, opacité, surface bâtie) ET le
 * RENDU (teinte d'aperçu, rampe de dégradé, recette de détail de surface, décor billboard, bloc
 * plein) dans la MÊME entrée : le terrain reste hors du dataset des matières (#1686) et porte le
 * sien.
 *
 * Le fichier porte UNE forme d'entrée (schéma `schemas/defs/terrains.ts`) : le handle de la fabrique
 * scelle ses nœuds (`z.infer` vaut `unknown`), aucun type n'est dérivé du schéma — la vue TS est
 * déclarée ici, comme `materials.types.ts`.
 */
import type { DetailRecipe } from './materials.types';

/** Un ARRÊT de la rampe de dégradé : offset en pourcentage (`0%`, `45%`, `100%`) → couleur `#rrggbb`.
 *  Record et non liste de paires : un offset ne se répète pas sur une rampe, et l'atelier édite un
 *  Record de texte là où une liste d'objets retombait sur l'éditeur JSON brut. */
export type TerrainStops = Record<string, string>;

/** MÉTA sémantique d'un terrain — ce que la walkability, le raccord d'arêtes et la Ligne de Vue
 *  lisent. Sous-ensemble PUR de l'entrée : aucune valeur de présentation. */
export interface TerrainMeta {
  id: string;
  label: string;
  /** Le terrain se traverse à pied (`terrainWalkable`). */
  walkable: boolean;
  /** Précédence de raccord d'arêtes : un terrain de priorité plus haute « déborde » sur ses voisins
   *  de priorité plus basse (façon crossers NWN). */
  priority: number;
  /** Bloque la Ligne de Vue (mur de pierre, porte) — lu par `lineOfSightCover` (couvert total,
   *  brouillard). Absent = transparent. */
  opaque?: boolean;
  /** Surface BÂTIE : construction qui PORTE l'étage posé dessus (plancher, dallage, pavage, bloc de
   *  maçonnerie). Absent = sol NU (naturel comme `herbe`/`terre`, ou `vide`) : un terrain déposé
   *  demain dans le dataset est donc du sol nu par défaut, et un étage posé dessus se signale
   *  (`map:check`, audit « étage sans appui ») au lieu de passer en silence. */
  built?: boolean;
  /** RÔLE — ce terrain EST l'absence de tuile : ce qu'une couche porte là où rien n'est bâti (couches
   *  z>0, cases hors bâti, couche absente). Le seam l'ADRESSE (`terrainAbsent`, `estAbsent`, #1789) ;
   *  le schéma exige qu'EXACTEMENT une entrée le porte. */
  absence?: boolean;
  /** RÔLE — ce terrain EST ce que la grille rend au-delà de ses bornes (`tileAt` hors grille,
   *  `terrainHorsGrille`, #1789) : ses propriétés (opacité, bâti, bloc plein) FONT la Ligne de Vue et
   *  le raccord d'arêtes au bord. Le schéma exige qu'EXACTEMENT une entrée le porte. */
  bordDuMonde?: boolean;
  /** GLYPHE d'authoring : le caractère qui pose ce terrain dans une carte ASCII (`noyau/monde/asciiMap.ts`,
   *  légende de base d'un plan ; `sceneToAscii` le réserve à l'export, #1789). Un seul char, UNIQUE dans
   *  le dataset et hors de la grammaire du plan (`schemas/grammaire/carte-ascii.ts`) : le schéma le
   *  refine. Absent = le terrain n'a pas de glyphe d'écriture, une scène le déclare dans sa `legend`. */
  ascii?: string;
}

/** L'ENTRÉE de `terrains.json` : la méta ci-dessus, l'enveloppe du document, et la présentation. */
export interface TerrainDef extends TerrainMeta {
  type: 'terrains';
  /** Provenance MAISON en clair — aucun folio n'imprime de catalogue de sols (`grammaire/document.ts`). */
  maison: string;
  /** Couleur d'aperçu (palette de l'éditeur, faces du monde volumique). */
  swatch: string;
  /** Arrêts du dégradé peint par le chemin AFFINE (SVG) — le volumique, lui, ne lit que `swatch`. */
  stops: TerrainStops;
  /** Recette de détail de surface (dallage/mouchetis/touffes), consommée par les deux backends. */
  detail?: DetailRecipe;
  /** DÉCOR posé en BILLBOARD sur chaque tuile du terrain (id de `props.json`) — rendu par le chemin
   *  billboard PARTAGÉ (`propSvg`) dans les DEUX backends : iso/éditeur ET POV. Ex. `bois → 'arbre'`.
   *  PRÉSENTATION pure : la physique combat du terrain (walkable/opaque/cover) ne change pas. */
  overlayProp?: string;
  /** Le terrain est un BLOC PLEIN de cette hauteur (mètres). Sa hauteur d'AFFICHAGE (`buildFloors`)
   *  vaut `heightAt + solidHeightM` → faces verticales + dessus dérivés du relief EXISTANT, dans les
   *  2 backends. N'entre QUE dans le rendu — `heightAt` (vérité combat) reste inchangé. Le bloc
   *  s'AJOUTE à la hauteur propre de la tuile (opéra : mur à un étage). */
  solidHeightM?: number;
  /** MATIÈRE des faces verticales du bloc plein (id de `materials.json` domaine `relief`, #1691) — le
   *  builder de sols la LIT au lieu de choisir. EXIGÉE dès que `solidHeightM` est posée, INTERDITE
   *  sinon (un terrain sans bloc n'a pas de flanc à peindre) : le schéma le refine, nommément. */
  matiere?: string;
}
