/**
 * LES ÉLÉMENTS DU VOLUME DU MONDE (#3476) : ce que les builders purs dérivent d'une scène, en espace MONDE (unités de
 * grille continues + mètres), sans caméra ni projection — la géométrie que tout hôte dessine.
 *
 * SENS DES FACES : toute `Face` déclare son régime (`oriented`, requis) — une face de coquille close
 * porte son dehors dans son sens de parcours ; une surface ouverte (sol, mur nu, toit, montant) déclare
 * `false` et reçoit alors le régime de la cuisson : normale vers le HAUT si elle est horizontale, vers
 * l'EXTÉRIEUR de la carte si elle est verticale (`worldTris.ts:orienterPoly`).
 */
import type { CellSide, FacadeFeature } from '../scene';
import type { MaterialRef } from '../../../data/materials.types';

/** Point MONDE : (x,y) en unités de GRILLE continues (coins de case à ±0.5), `h` en MÈTRES.
 *  Jamais de rotation ni d'écran ici — backend affine : `tileCenter(x, y, dims, metricToLift(h))` ;
 *  backend perspective : `{ x·mpt, y·mpt, h }`. */
export interface GP {
  x: number;
  y: number;
  h: number;
}

export interface Face {
  poly: GP[];
  material: MaterialRef;
  architectureFeatureId?: string;
  architectureFeatureKind?: FacadeFeature['kind'];
  /** Arête de la case qui porte la face (relief/wedge/mur) — les backends en dérivent l'orientation
   *  (arête écran en affine, normale en perspective) sans re-scanner la scène. */
  side?: CellSide;
  /** REQUIS — chaque producteur DÉCLARE le régime de sa face, le compilateur refuse l'oubli.
   *  `true` : le SENS DE PARCOURS du polygone porte déjà le DEHORS du volume que la face ferme
   *  (`noyau/monde/volume/propVolumes.ts` : chaque primitive sort tournée vers son dehors) ; un consommateur qui
   *  a besoin d'une normale la prend TELLE QUELLE (`backends/webgl/worldTris.ts:faceQuadsOriented`).
   *  `false` : surface OUVERTE, sans convention de sens (sol, mur nu, toit, montant) — le consommateur
   *  l'oriente lui-même, et le régime déclaré de ces faces est l'heuristique de la LOI D'ORIENTATION
   *  (vers le HAUT si horizontale, vers l'EXTÉRIEUR de la carte si verticale,
   *  `backends/webgl/worldTris.ts:orienterPoly`). */
  oriented: boolean;
  /** Id de l'ENTITÉ de scène dont la face vient (décor volumique, `noyau/monde/volume/propVolumes.ts`) — ce que
   *  le picking résout une fois la face fondue dans la géométrie commune du monde. */
  entId?: string;
}

/** VÉRITÉS DE SCÈNE d'un élément (camera-free) — calculées par les builders, consommées par TOUS les
 *  backends. La vérité de VUE (estompe d'occlusion, reveal au-dessus d'un acteur, assombrissement de
 *  l'étage inférieur) reste une DÉCORATION du stage/backend au dessin (opacité/filtre). */
export interface ElStates {
  /** Représente une chose actuellement VISIBLE → dessinée AU-DESSUS du voile de brouillard (fog
   *  sandwich). Sol ordinaire : false (le voile le grise) ; surplomb PLEIN : true (comme un mur). */
  visible: boolean;
  /** SURPLOMB : la case a une surface marchable sur une couche inférieure (tablier de pont / loge). */
  overhang?: boolean;
  /** Émis AU-DESSUS de l'étage actif → silhouette (l'appelant l'affiche translucide, sauf surplomb PLEIN). */
  ghost?: boolean;
  /** Surplomb PLEIN : fantôme dont la surface du dessous n'est PAS visible → rien à protéger, dessiné
   *  opaque comme la structure perçue (rempart en bord de carte) et au-dessus du voile. */
  solidOverhang?: boolean;
  /** Porte ouverte (arête franchissable). */
  open?: boolean;
  /** Structure abattue (brèche de siège). */
  down?: boolean;
  /** Toit dont l'empreinte est occupée par un allié (cutaway). */
  roofOccupied?: boolean;
}

export interface ElBase {
  /** Clé STABLE d'identité MONDE (`floor:x,y,z`…) — clé React/DOM, survit aux frames et rotations. */
  key: string;
  /** Case d'ancrage. `z` = INDEX DE COUCHE (tri de profondeur), découplé de la hauteur métrique. */
  cell: { x: number; y: number; z: number };
  states: ElStates;
}

/** Élément à FACES (géométrie monde) : sol (relief/wedges compris), mur d'arête, toit. */
export interface FloorEl extends ElBase {
  kind: 'floor';
  faces: Face[];
}
