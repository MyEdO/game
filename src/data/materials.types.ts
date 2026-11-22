/**
 * MATIÈRES DU MONDE (#1686 lot 2) — vue TS de `materials.json`, dataset UNIQUE des matières de rendu.
 *
 * L'identité d'une matière est le couple (`domain`, `id`) ; l'id reste unique sur tout le périmètre,
 * si bien qu'un homonyme se COMPOSE (`prop-ardoise` /
 * `toit-ardoise`) plutôt que de compter sur son domaine pour être séparable.
 *
 * Le fichier porte UNE forme d'entrée (schéma `schemas/defs/materials.ts`), dont la charge par `domain` fait du type de
 * sortie (`EntreeDe`, `src/data/datasets.ts`) une union DISCRIMINÉE. Les types nommés que les catalogues de rendu
 * consomment sont les membres de cette union, servis par `Extract` sur `domain`.
 *
 * Il porte aussi, pour que `src/data` n'importe rien du rendu ni du noyau (#2884) : `DetailRecipe` et
 * `MaterialRef`, que les données d'apparence composent et que le rendu consomme ; `Grade`, le lien
 * vertical entre deux surfaces, que `PARTS_RELIEF` compose et que le noyau lit pour le déplacement
 * (`gradeBetween`, `src/noyau/monde/relief.ts`).
 */
import type { EntreeDe } from './datasets';
import type * as materialsDef from './schemas/defs/materials';

/**
 * Recette de DÉTAIL de surface, DONNÉE PURE portée par les defs d'apparence (`StructureAppearanceDef`,
 * `TerrainDef`) via leur champ optionnel `detail`. Lecteurs : `tintVarFactor` (`src/noyau/monde/volume/matieres.ts`)
 * pour `tintVar` ; `wallPartColor` (`src/noyau/monde/volume/structures.ts`) pour la teinte du joint ; les kits d'arête
 * Python pour les cotes de `courses` et de `timber` (`scripts/personnage-3d/arete/apparences.py`,
 * `cloture/donnees.py`, `colombage/donnees.py`, `moellons/donnees.py`).
 *
 * Les dimensions physiques (`hM`, `jointW`, `wM`…) sont en MÈTRES.
 */
export interface DetailRecipe {
  /** Rangs horizontaux (assises de pierre, bardeaux, planches). */
  courses?: {
    /** Hauteur d'un rang (m). */
    hM: number;
    /** Couleur du joint (lignes de rangs + verticales entre blocs). */
    joint: string;
    /** Épaisseur du joint (m). */
    jointW: number;
    /** Décalage horizontal des blocs d'un rang sur l'autre (appareillage), en fraction de la
     *  largeur moyenne de bloc [0,1]. Sans effet si `blockWM` absent. */
    stagger?: number;
    /** Largeur de pierre min/max (m) ; absent = rang CONTINU (bardeau/planche, pas de blocs). */
    blockWM?: [number, number];
    /** Amplitude (m) du tremblé des lignes de joint (bornes de rangs) — borné, jamais d'inversion. */
    edgeWobble?: number;
    /** Variation de teinte par bloc ∈ [0,1]. */
    paletteVar?: number;
  };
  /** Colombage : poteaux verticaux tous les `postEveryM` mètres + écharpes en X ou en V par travée. */
  timber?: { postEveryM: number; braces?: 'X' | 'V'; wM: number; color: string };
  /** Variance de TEINTE de la surface ∈ [0,1] par case : la couleur de sommet est modulée par `tintVarFactor`. */
  tintVar?: number;
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
 * de domaine `relief` (`src/noyau/monde/volume/floors.ts`), et RIEN d'autre : les deux liens verticaux
 * franchissables/infranchissables du relief (`Grade` moins `flat`, qui ne dessine aucune paroi), la
 * dalle fine d'un tablier de surplomb (`deck`) et le montant qui la porte (`pilier`).
 *
 * Il vit ICI, dans la couche donnée, parce que DEUX couches en dépendent et qu'aucune ne peut
 * importer l'autre : le schéma de scène en fait les CLÉS de `Scene.reliefDefaults` (matière posée par
 * partie), le builder de sols les y lit. Une partie de plus se déclare une fois, et la scène doit
 * alors la matérialiser — le builder n'a aucun repli à offrir.
 */
export const PARTS_RELIEF = ['cliff', 'ramp', 'deck', 'pilier'] as const satisfies readonly (
  | Exclude<Grade, 'flat'>
  | 'deck'
  | 'pilier'
)[];

/**
 * Domaines du catalogue des matières : sous-ensemble des domaines de `MaterialRef`, plus `objet` et `couleur`,
 * vérifié par `satisfies`. `terrain` et `structure` gardent leurs datasets propres
 * (`terrains.json` et `structureAppearance.json`).
 * `objet` et `couleur` vivent hors du pivot de rendu du sol : une teinte d’objet se résout par son id (`findTeinteById`),
 * et la palette d’une composition nomme une `couleur` par emplacement (`presets-de-personnage.json`).
 */
export const DOMAINES_MATIERE = ['prop', 'roof', 'relief', 'objet', 'couleur'] as const satisfies readonly (MaterialRef['domain'] | 'objet' | 'couleur')[];
export type MaterialDomain = (typeof DOMAINES_MATIERE)[number];

/** UNE entrée de `materials.json`, discriminée par `domain`, au type de son schéma (`schemas/defs/materials.ts`). */
export type MaterialEntry = EntreeDe<typeof materialsDef>;

/** L'entrée d'un domaine donné — `MatiereDe<'roof'>` = `RoofMaterialDef`. */
export type MatiereDe<D extends MaterialDomain> = Extract<MaterialEntry, { domain: D }>;

/** Matière de RENDU des recettes volumiques de décor : couleur + réponse à la lumière. Aucune
 *  émission — une source lumineuse est un `light` de prop ou d'instance, jamais une matière. */
export type PropMaterialData = MatiereDe<'prop'>;

/** Apparence de RENDU des toits (matériau de couverture : teintes de PENTE, soffite, planche de rive ; et
 *  l'entrée du « plan » vu du dessus, `vueDeDessus`). Le rendu ne porte aucun littéral de couleur —
 *  l'identité du matériau vient d'ici. */
export type RoofMaterialDef = MatiereDe<'roof'>;

/** Apparence de RENDU du relief d'environnement (falaise/rampe/tablier/pilier, iso et POV) :
 *  le renderer ne porte aucun littéral de couleur — l'identité du matériau vient d'ici, la
 *  lumière/l'ombrage vient de `lib/ombrage.ts`. */
export type ReliefMaterialDef = MatiereDe<'relief'>;

/** Palette d’une teinte d’objet, résolue par son id (`findTeinteById`). */
export type TeinteDObjet = MatiereDe<'objet'>;

/** Une couleur nommée du nuancier, résolue par son id (`findCouleurById`). */
export type CouleurNommee = MatiereDe<'couleur'>;
