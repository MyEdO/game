/**
 * MATIÈRES DU MONDE (#1686 lot 2) — vue TS de `materials.json`, dataset UNIQUE des matières de rendu.
 *
 * L'identité d'une matière est le couple (`domain`, `id`) ; l'id reste unique sur tout le périmètre
 * (`src/data/materials-identite.test.ts`), si bien qu'un homonyme se COMPOSE (`prop-ardoise` /
 * `toit-ardoise`) plutôt que de compter sur son domaine pour être séparable.
 *
 * Le fichier porte UNE forme d'entrée (schéma `schemas/defs/materials.ts` : toutes les clés de charge
 * optionnelles, la disjonction portée par un refine ⟺, patron `defs/oups.ts`). La VUE TS, elle, est
 * l'union DISCRIMINÉE ci-dessous : le handle de la fabrique scelle ses nœuds (`z.infer` vaut
 * `unknown`), aucun type n'est dérivé du schéma. Les types nommés que les catalogues de rendu
 * consomment sont les membres de cette union, servis par `Extract` sur `domain`.
 *
 * Il porte aussi, pour que `src/data` n'importe rien du rendu ni du noyau (#2884) : `DetailRecipe` et
 * `MaterialRef`, que les données d'apparence composent et que le rendu consomme ; `Grade`, le lien
 * vertical entre deux surfaces, que `PARTS_RELIEF` compose et que le noyau lit pour le déplacement
 * (`gradeBetween`, `src/noyau/monde/relief.ts`).
 */
import type { Slot } from './palette.types';

/**
 * Recette de DÉTAIL de surface — appareillage de pierre, bardeaux, colombage,
 * plinthes/arases, mouchetis. DONNÉE PURE portée par les defs d'apparence (`StructureAppearanceDef`,
 * `RoofMaterialDef`, `ReliefMaterialDef`, `TerrainDef`) via leur champ optionnel `detail`.
 *
 * `expandRecipe` (`gameIso/detail/expand.ts`) déplie la recette en primitives UV en ESPACE DE FACE [0,1]² (+ mètres pour
 * les épaisseurs), consommées par DEUX peintres : `gameIso/authoring/detailSvg.ts` (SVG d'authoring)
 * et `gameIso/backends/webgl/faceBake.ts` (cuisson par face du rendu
 * volumique) ; le tracé de PÉRIODE (`gameIso/detail/courses.ts`) a les mêmes trois consommateurs
 * (`gameIso/authoring/detailSvg`, `gameIso/backends/webgl/periodTexture.ts`). Chaque peintre rasterise à sa
 * résolution, les vues retombent sur le MÊME détail parce que le seed est dérivé de l'identité MONDE
 * (`hash32`, jamais stocké).
 *
 * Convention UV : u ∈ [0,1] le long de la face (gauche→droite), v ∈ [0,1] du HAUT (0) vers le BAS (1).
 * Les dimensions physiques (`hM`, `jointW`, `wM`, `rM`…) sont en MÈTRES : l'expansion les convertit en
 * fractions via la taille réelle de la face (`faceWM`/`faceHM`), donc une même recette produit des
 * pierres de même taille sur un mur de 2 m et un rempart de 6 m.
 */
export interface DetailRecipe {
  /** Rangs horizontaux (assises de pierre, bardeaux, planches). */
  courses?: {
    /** Hauteur d'un rang (m). */
    hM: number;
    /** Couleur du joint (lignes de rangs + verticales entre blocs). */
    joint: string;
    /** Épaisseur du joint (m) — rendue par le backend, pas convertie en UV. */
    jointW: number;
    /** Décalage horizontal des blocs d'un rang sur l'autre (appareillage), en fraction de la
     *  largeur moyenne de bloc [0,1]. Sans effet si `blockWM` absent. */
    stagger?: number;
    /** Largeur de pierre min/max (m) ; absent = rang CONTINU (bardeau/planche, pas de blocs). */
    blockWM?: [number, number];
    /** Amplitude (m) du tremblé des lignes de joint (bornes de rangs) — borné, jamais d'inversion. */
    edgeWobble?: number;
    /** Variation de teinte par bloc ∈ [0,1] — le backend module la couleur de face par `shade`. */
    paletteVar?: number;
  };
  /** Bandes horizontales pleines (plinthe, arase, bandeau) : `atV` = CENTRE de la bande ∈ [0,1]
   *  (0 = haut de la face, 1 = bas), `hM` = hauteur (m). */
  bands?: { atV: number; hM: number; color: string }[];
  /** Colombage : poteaux verticaux tous les `postEveryM` mètres + écharpes en X ou en V par travée. */
  timber?: { postEveryM: number; braces?: 'X' | 'V'; wM: number; color: string };
  /** Mouchetis (lichen, salissure, silex) : densité par m², rayon (m) min/max, palette tirée au seed.
   *  `vBias` > 0 tasse les taches vers le BAS de la face (usure/salissure au pied ; 0 = uniforme). */
  speckle?: { perM2: number; rM: [number, number]; colors: string[]; vBias?: number };
  /** Touffes d'herbe / brins (sol) : densité par m², hauteur de brin (m) min/max, palette tirée au seed. */
  tufts?: { perM2: number; hM: [number, number]; colors: string[] };
  /** Variance de TEINTE de la surface entière ∈ [0,1] par unité de seed (tuile/face) — tue l'uniformité
   *  d'un aplat répété : le backend module le fill de base par `shade(base, 1 ± tintVar)`. */
  tintVar?: number;
  /** Portée de l'IDENTITÉ du seed — dit à l'APPELANT quoi hasher (le seed n'est jamais stocké) :
   *  'edge' = par arête de mur (x,y,z,side), 'tile' = par tuile (x,y,z), 'instance' = par instance
   *  (bâtiment/structure entière : même détail sur toutes ses faces). */
  seedScope: 'edge' | 'tile' | 'instance';
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

/** Nature du lien vertical entre deux surfaces voisines (`gradeBetween`, `src/noyau/monde/relief.ts`). */
export type Grade = 'flat' | 'ramp' | 'cliff';

/**
 * PARTIES de relief — le vocabulaire des `MaterialRef.part` que le builder de sols ÉMET pour une face
 * de domaine `relief` (`src/gameIso/builders/floors.ts`), et RIEN d'autre : les deux liens verticaux
 * franchissables/infranchissables du relief (`Grade` moins `flat`, qui ne dessine aucune paroi), la
 * dalle fine d'un tablier de surplomb (`deck`) et le montant qui la porte (`pilier`).
 *
 * Il vit ICI, dans la couche donnée, parce que DEUX couches en dépendent et qu'aucune ne peut
 * importer l'autre : le schéma de scène en fait les CLÉS de `Scene.reliefDefaults` (matière posée par
 * partie), l'émetteur en type ses faces. Une partie de plus se déclare une fois, et la scène doit
 * alors la matérialiser — le builder n'a aucun repli à offrir.
 */
export const PARTS_RELIEF = ['cliff', 'ramp', 'deck', 'pilier'] as const satisfies readonly (
  | Exclude<Grade, 'flat'>
  | 'deck'
  | 'pilier'
)[];
export type PartRelief = (typeof PARTS_RELIEF)[number];

/**
 * Domaines du catalogue des matières : sous-ensemble des domaines de `MaterialRef`, plus `objet`,
 * vérifié par `satisfies`. `terrain` et `structure` gardent leurs datasets propres
 * (`terrains.json` et `structureAppearance.json`).
 * `objet` vit hors du pivot de rendu du sol ; le rig lit sa palette par l’id `teinte`.
 */
export const DOMAINES_MATIERE = ['prop', 'roof', 'relief', 'objet'] as const satisfies readonly (MaterialRef['domain'] | 'objet')[];
export type MaterialDomain = (typeof DOMAINES_MATIERE)[number];

/** Enveloppe commune à toute matière — la CHARGE commune est vide : chaque domaine peint autre chose. */
interface MatiereBase {
  id: string;
  type: 'materials';
  /** Nom d'auteur de la matière, affiché tel quel par les sélecteurs de l'éditeur. */
  label: string;
  domain: MaterialDomain;
}

/** Matière de RENDU des recettes volumiques de décor : couleur + réponse à la lumière. Aucune
 *  émission — une source lumineuse est un `light` de prop ou d'instance, jamais une matière. */
export interface PropMaterialData extends MatiereBase {
  domain: 'prop';
  color: string;
  roughness: number;
  metalness: number;
}

/** Apparence de RENDU des toits (matériau de couverture iso : teintes par orientation de PENTE +
 *  liseré/rangs de tuiles ; et « plan » vu du dessus en vue carrée). Le renderer ne porte aucun
 *  littéral de couleur — l'identité du matériau vient d'ici. */
export interface RoofMaterialDef extends MatiereBase {
  domain: 'roof';
  /** Ce matériau COUVRE-t-il un pan ? Seuls ceux-là sont posables sur une masse de toit (sélecteurs de
   *  l'éditeur, `noyau/validateScene`). Absent = entrée de rendu qui ne couvre rien : le plan vu du
   *  dessus n'a ni pente ni égout. UNE seule graphie : le champ vaut `true` ou il est ABSENT — le
   *  schéma refuse `false` (`src/data/schemas/defs/materials.ts`). */
  couverture?: true;
  /** Cette entrée EST le plan vu du dessus (#1691) : le rendu de la vue carrée la résout par ce
   *  marqueur (`matierePlan`, `src/data/index.ts`), plus par un id littéral. Le dataset en porte
   *  EXACTEMENT une (`schemas/defs/materials.ts`), et elle ne couvre aucun pan. */
  vueDeDessus?: true;
  /** Recette de détail de COUVERTURE (matériaux v2) : `courses` = les rangs (le pas `hM` fixe leur
   *  espacement — source unique builder/backend — `joint` leur couleur ; `blockWM`+`stagger`+
   *  `paletteVar` = bardeaux décalés nuancés ; `edgeWobble` seul = rangs organiques type chaume) ;
   *  `tufts` = balayage de brins le long de la pente (paille). */
  detail?: DetailRecipe;
  /** Teintes de pente iso par orientation d'AVANT-TOIT (N/E/S/O) + liseré de STRUCTURE (`line` :
   *  faîte/arêtiers/égouts). Présents pour les matériaux de couverture. */
  N?: string;
  E?: string;
  S?: string;
  O?: string;
  line?: string;
  /** Plan du toit vu du dessus (vue carrée) : corps, liseré, cadre intérieur, texte du nom. */
  planBody?: string;
  planEdge?: string;
  planInner?: string;
  planText?: string;
  /** VOLUME de l'avant-toit (le toit DÉBORDE des murs, il ne pose plus à ras). Géométrie ADDITIVE émise
   *  par le builder (`roofPans`) sur chaque ÉGOUT, colorée ici :
   *  - `eaveOverhangM` : longueur du SOFFITE en CASES (run le long de la pente au-delà de l'égout ; le
   *    bord extérieur descend de `eaveOverhangM × ROOF_SLOPE_M` → soffite COPLANAIRE au pan). Absent ⇒
   *    aucun débord ;
   *  - `soffite` : ton du DESSOUS débordant (uniforme, ombré — un dessous ne capte pas la lumière du ciel) ;
   *  - `fasciaDropM` : hauteur de la planche de rive VERTICALE pendant du bord extérieur du soffite.
   *    Absent ⇒ pas de fascia dure (bord arrondi, ex. chaume) ;
   *  - `fascia` : ton de la fascia (sombre — c'est l'ombre sous l'avant-toit qui « détache » le toit du mur) ;
   *  - `fasciaThickM` : ÉPAISSEUR de cette planche de rive, pour le backend VOLUMIQUE qui en fait une
   *    boîte mince centrée sur son plan (le backend affine l'ignore : il peint un quad d'écran). Absent ⇒
   *    `FASCIA_THICK_M` ;
   *  - `ridgeCap` : liseré CLAIR du couronnement de FAÎTE (rendu par un trait de faîte renforcé au backend). */
  eaveOverhangM?: number;
  soffite?: string;
  fasciaDropM?: number;
  fasciaThickM?: number;
  fascia?: string;
  ridgeCap?: string;
}

/** Apparence de RENDU du relief d'environnement (falaise/rampe/tablier/pilier, iso et POV) :
 *  le renderer ne porte aucun littéral de couleur — l'identité du matériau vient d'ici, la
 *  lumière/l'ombrage vient de `shade.ts`. */
export interface ReliefMaterialDef extends MatiereBase {
  domain: 'relief';
  /** Masse BÂTIE (maçonnerie, ouvrage) par opposition au relief NATUREL (talus, terre remuée) — même axe
   *  que `TerrainDef.built`. Absent = naturel. */
  built?: boolean;
  /** Recette de détail de surface (strates/joints/mouchetis) — consommée par les backends (iso + POV). */
  detail?: DetailRecipe;
  /** Face principale (claire/éclairée). */
  face: string;
  /** FALAISE : ombre de pied. */
  foot?: string;
  /** RAMPE : nez de pente éclairé (le pied est dérivé par ombrage). */
  slopeTop?: string;
  /** Facteur d'ombrage de la face/pied côté ombre (falaise/tablier). */
  shadeDark?: number;
}

/** Palette d’une teinte d’objet, résolue par son id au rendu du rig. */
export interface TeinteDObjet extends MatiereBase {
  domain: 'objet';
  palette: Partial<Record<Slot, string>>;
}

/** UNE entrée de `materials.json`, discriminée par `domain`. */
export type MaterialEntry = PropMaterialData | RoofMaterialDef | ReliefMaterialDef | TeinteDObjet;

/** L'entrée d'un domaine donné — `MatiereDe<'roof'>` = `RoofMaterialDef`. */
export type MatiereDe<D extends MaterialDomain> = Extract<MaterialEntry, { domain: D }>;
