/**
 * PIVOT du rendu — « une scène, une apparence, N projections ».
 * Les BUILDERS (`builders/`) dérivent la scène en ÉLÉMENTS SÉMANTIQUES en espace MONDE ; les BACKENDS
 * (écran-affine iso/edge-on/top, perspective POV) les projettent et les dessinent. Un builder n'importe
 * NI `Dims` NI caméra : sa sortie mémoïsée survit à toute rotation/projection (contrat de perf du stage),
 * et le POV n'hérite d'aucun concept d'écran.
 *
 * SENS DES FACES : toute `Face` déclare son régime (`oriented`, requis) — une face de coquille close
 * porte son dehors dans son sens de parcours ; une surface ouverte (sol, mur nu, toit, montant) déclare
 * `false` et reçoit alors le régime de la cuisson : normale vers le HAUT si elle est horizontale, vers
 * l'EXTÉRIEUR de la carte si elle est verticale.
 */

import type { CellSide, FacadeFeature, SceneEntity, WallSide } from '../../state/scene';
export type { CellSide };
import type { Combatant } from '../../engine/types';
import type { Dir4, Dir8 } from '../../state/dir8';
import type { SeatPose } from '../../state/seating';

/** Point MONDE : (x,y) en unités de GRILLE continues (coins de case à ±0.5), `h` en MÈTRES.
 *  Jamais de rotation ni d'écran ici — backend affine : `tileCenter(x, y, dims, metricToLift(h))` ;
 *  backend perspective : `{ x·mpt, y·mpt, h }`. */
export interface GP {
  x: number;
  y: number;
  h: number;
}

/** Référence de MATÉRIAU (donnée JSON) — jamais une couleur. `part` distingue les faces d'un même
 *  matériau qui se dessinent différemment (falaise/rampe/tablier/pilier de relief, wedge de terrain).
 *  L'orientation d'une face (sol/paroi/pente) est dérivée par chaque backend depuis `domain`+`part`
 *  (et `side`), pas stockée. */
export interface MaterialRef {
  domain: 'terrain' | 'relief' | 'structure' | 'roof' | 'prop';
  id: string;
  part?: string;
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
   *  (`builders/propVolumes.ts` : chaque primitive sort tournée vers son dehors) ; un consommateur qui
   *  a besoin d'une normale la prend TELLE QUELLE (`backends/webgl/worldTris.ts:faceQuadsOriented`).
   *  `false` : surface OUVERTE, sans convention de sens (sol, mur nu, toit, montant) — le consommateur
   *  l'oriente lui-même, et le régime déclaré de ces faces est l'heuristique de la LOI D'ORIENTATION
   *  (vers le HAUT si horizontale, vers l'EXTÉRIEUR de la carte si verticale,
   *  `backends/webgl/worldTris.ts:orienterPoly`). */
  oriented: boolean;
  /** Id de l'ENTITÉ de scène dont la face vient (décor volumique, `builders/propVolumes.ts`) — ce que
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
export interface WallEl extends ElBase {
  kind: 'wall';
  /** Relations stables d'une façade architecturale authorée. Absentes sur les murs legacy. */
  bodyId?: string;
  facadeSectionId?: string;
  roomZoneIds?: string[];
  facadeAppearance?: string;
  /** Côté d'arête du segment (cardinal N/E ou diagonal `\`/`/`) — ombrage d'orientation MONDE (arête N
   *  dans l'ombre) et cases de profondeur du backend affine. */
  side: WallSide;
  /** Extrémités A,B de l'arête à la hauteur de BASE (mètres) — la vue du dessus SYMBOLIQUE (traits/
   *  glyphe de porte) se trace dessus sans re-scanner la scène. */
  ends: [GP, GP];
  /** Id d'apparence de structure (`wallApp`) : chaque backend résout les couleurs par `part` depuis la def. */
  appearance: string;
  /** Le segment porte une PORTE (vantail bois / corps de garde) — route la représentation 'top'. */
  door: boolean;
  faces: Face[];
}
/** Ligne SÉMANTIQUE d'un toit, en MONDE : faîte (crête horizontale), arêtier (crête/noue diagonale),
 *  égout (bord bas de la nappe), rang (rangée de tuiles le long de la pente). Les backends la stylent
 *  depuis la def du matériau (`line`/`course`) — le builder ne connaît que la géométrie. */
export type RoofLineKind = 'faite' | 'aretier' | 'egout' | 'rang';
export interface RoofLine {
  a: GP;
  b: GP;
  kind: RoofLineKind;
}
export interface RoofEl extends ElBase {
  kind: 'roof';
  /** Relations stables d'une masse architecturale authorée. Absentes sur un `RoofEl` construit à la main. */
  bodyId?: string;
  sectionId?: string;
  panId?: string;
  roomZoneIds?: string[];
  profile?: 'gable' | 'hip' | 'shed' | 'flat';
  ridge?: 'x' | 'y';
  pitch?: number;
  /** ALTITUDE (m) du bord bas de la nappe — SEULE vérité de hauteur du toit, requise : les DEUX
   *  backends s'en servent (pans par `projGP`, modes plan par `metricToLift`). L'index de couche
   *  `cell.z` désigne un étage, pas une hauteur (le plancher porte du relief). */
  eaveHeightM: number;
  /** Cellules exactes de l'empreinte, triées par y puis x. */
  cells: { x: number; y: number }[];
  /** Empreinte du toit (cases) — profondeur de tri au coin caméra-proche (`footprintDepth`). */
  span: { w: number; h: number };
  /** Matériau de couverture (id `RoofMaterialDef`) : chaque backend résout les teintes par `part`. */
  material: string;
  /** Grande union irrégulière : rangs espacés et détail clippé désactivé. */
  simplifiedCourses?: boolean;
  /** Étiquette du mode plan (vue du dessus / éditeur). */
  label: string;
  /** PANS CONTINUS : UNE face par pan (plane 'slope', part = orientation N/E/S/O de la pente
   *  DESCENDANTE) — plus aucune nappe par-cellule. Le VOLUME de l'avant-toit ajoute, par égout, une face
   *  `part:'soffite'` (débord coplanaire) et une face `part:'fascia'` (planche de rive verticale, sombre)
   *  — teintées par le backend depuis la def du matériau (`soffite`/`fascia`). */
  faces: Face[];
  lines: RoofLine[];
}
/** Élément BILLBOARD (zéro face) : les DEUX backends rendent son SVG catalogue (`propSvg`) ancré aux pieds.
 *  `source` = ORIGINE (le rendu est identique) : 'entity' = prop de scène (fouillable, empreinte, facing,
 *  anim) ; 'terrain' = décor dérivé d'un terrain (`overlayProp`, ex. bois → arbre — 1×1, jamais fouillable) ;
 *  'ornament' = ornement d'IDENTITÉ d'un bâtiment (clocheton/cheminée/enseigne/étal — dérivé de `ArchitectureBody.style`
 *  via `buildingFeatures`) ; 'architecture' = feature authorée d'une façade. */
export type BillboardPropEl = BillboardPropBase & OrigineDecor;
interface BillboardPropBase extends ElBase {
  kind: 'prop';
  /** Id stable qualifié `bodyId:facadeSectionId:featureId`. */
  architectureFeatureId?: string;
  /** Id de dessin : le type de décor tel que la donnée le NOMME — jamais normalisé. ABSENT (entité sans
   *  type) ou hors registre : le même billboard d'ERREUR (`missingPropSvg`, #877). */
  ref: string | undefined;
  /** Orientation MONDE d'auteur (props directionnels) — chaque backend la projette avec SA caméra. */
  facing?: Dir8;
  /** Géométrie d'empreinte du décor (décalage fractionnaire vers le centre + échelle au côté max). */
  foot: { offX: number; offY: number; scale: number };
  /** Surélévation MÉTRIQUE additionnelle par-dessus la surface de la case (défaut 0 : ancré au sol) — un
   *  ornement de FAÎTE (clocheton) ou de MUR (enseigne) se pose EN HAUTEUR. Honoré par les deux backends
   *  (iso : lift additionnel du token ; POV : hauteur d'ancre du billboard). */
  liftM?: number;
}
/** ORIGINE d'un décor (`source`), même union pour le billboard et le volume : une feature de façade ou
 *  un ornement de bâtiment sort en volume par la MÊME règle qu'un prop de scène. Seul un décor d'ENTITÉ de scène
 *  porte un `entId` — lui seul est désignable au pointeur — et avec lui son EMPREINTE effective au cap
 *  de l'instance (`builders/props.ts`, `empreinteDuProp`). `entId` est la seule clé dont un élément de
 *  décor a besoin : l'OFFRE d'interaction ne se recopie pas ici, elle se DÉRIVE de l'entité au moment
 *  du rendu (`estUtilisable`, `state/usable.ts`), seul endroit qui voie à la fois la scène et les
 *  drapeaux d'épuisement. */
export type OrigineDecor =
  | { source: 'entity'; entId: string; span: { w: number; h: number } }
  | { source: 'terrain' | 'ornament' | 'architecture'; entId?: never; span?: never };
/** Un décor d'ENTITÉ de scène : `entId` et `span` présents par construction. */
export type DecorDEntite = PropEl & { source: 'entity' };
/** Élément de décor à FACES : un décor dont le TYPE porte une recette volumique (`PropData.volume`) est
 *  compilé en géométrie MONDE (`builders/propVolumes.ts`) et cuit dans la masse commune — il n'a donc
 *  ni vignette ni empreinte de billboard à porter. Son empreinte d'entité (`span`) est celle de son
 *  corps au cap de l'instance, comme pour tout décor (`OrigineDecor`). */
export type VolumePropEl = VolumePropBase & OrigineDecor;
interface VolumePropBase extends ElBase {
  kind: 'prop';
  ref: string;
  /** Cap CARDINAL, jamais diagonal (cf. `Dir4`) — l'émetteur unique le refuse à la donnée. */
  facing: Dir4;
  /** NAPPE PORTEUSE : la masse dont ce décor suit le SORT au dégagement (un ornement de faîte se lève
   *  AVEC son toit au lieu de flotter). Même identité de section et mêmes cellules que les pans. */
  nappe?: { sectionId: string; cells: readonly { x: number; y: number }[] };
  /** Zones de PIÈCE de cette nappe — comme pour un `RoofEl`, PRIVÉE du monde cuit (`elCuit`) et
   *  redemandée vive par l'hôte (`roomZonesByElKey`). */
  roomZoneIds?: string[];
  faces: Face[];
}
export type PropEl = BillboardPropEl | VolumePropEl;

/** Ce décor est-il rendu en VOLUME (par opposition au billboard) ? Le seul discriminant : ses faces. */
export const estPropVolumique = (el: PropEl): el is VolumePropEl => 'faces' in el;

/** NAPPE PORTEUSE d'un élément de scène : la masse dont il suit le SORT au dégagement — un pan de toit
 *  EST sa propre nappe, un décor volumique déclare celle qui le porte. La loi de dégagement de l'hôte
 *  les lit par ce SEUL canal : ce qui se lève avec un toit se déclare, jamais ne se devine d'un `kind`. */
export function nappePorteuse(el: SceneEl): { sectionId: string; cells: readonly { x: number; y: number }[] } | null {
  if (el.kind === 'roof') return { sectionId: el.sectionId ?? el.key, cells: el.cells };
  if (el.kind === 'prop' && estPropVolumique(el) && el.nappe) return el.nappe;
  return null;
}
/** Le SUJET d'un token — la donnée d'identité que le stage transforme en corps React (tokenBodyKind/
 *  le pion-disque). La position INTERPOLÉE de marche est PAR-FRAME : elle reste au stage ; l'élément ne
 *  porte que la position LOGIQUE (`cell`) et les décisions de scène (filtres, ordre d'anneau héros). */
export type TokenSubjectEl =
  /** PNJ/créature d'AMBIANCE — `inBattle` : rendu estompé + non interactif. `seat` : la place assise
   *  que ce corps tient (`state/seating`), ancre métrique et cap COMPRIS — aucun `mountId`, aucun
   *  porteur : un attablé n'est pas un cavalier. Absent = debout sur sa case. */
  | { kind: 'figurant'; ent: SceneEntity; enrolled: boolean; inBattle: boolean; seat?: SeatPose }
  /** Combattant (branche combat). `heroIndex` = ordinal d'anneau héros ; `overhang` = jeton de
   *  muraille rendu AU-DESSUS de la zone active (chemin de ronde vu d'en bas). */
  | { kind: 'combatant'; c: Combatant; heroIndex?: number; overhang: boolean }
  /** Couple monté (iso) : UN corps composite à la tuile/empreinte de la monture. `heroIndex` = ordinal
   *  d'anneau du CAVALIER (celui qu'il a réservé sans être dessiné) — l'identité d'équipe du couple se
   *  lit au cavalier, le record de la monture pouvant porter un autre camp. */
  | { kind: 'mounted'; mount: Combatant; rider: Combatant; heroIndex?: number };
export interface TokenEl extends ElBase {
  kind: 'token';
  id: string;
  subject: TokenSubjectEl;
}

export type SceneEl = FloorEl | WallEl | RoofEl | PropEl | TokenEl;
