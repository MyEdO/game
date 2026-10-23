/** AMBIANCE de rendu partagée iso ⇄ POV — vue TS de `ambiance.json` (objet RACINE unique, schéma
 *  `schemas/defs/ambiance.ts`), lue par `AMBIANCE` et ses fonctions (`src/gameIso/catalog/ambiance.ts`). */

/** État de visibilité d'une case, du plus au moins connu (`visibilityOf`, `src/noyau/visibility.ts`). */
export type Visibility = 'visible' | 'explored' | 'unknown';

/** Halo radial (voile chaud / vignette) : centre + rayon en %, couleur et alpha au bord utile. */
export interface RadialVeilDef { cx: string; cy: string; r: string; color: string; alpha: number; innerOff?: string }

/** #1176 P2-6 — PRÉCIPITATION MONDE d'un type de météo : ce qui TOMBE dans le volume de la voie
 *  volumique (`gameIso/backends/webgl/weatherParticles.ts`). Toute l'apparence et toute la physique du semis
 *  sont ici, en donnée : le MOTEUR est N+1-par-donnée — un `WeatherPrecipDef` forgé, absent du dépôt,
 *  tombe sans une ligne de code (mesuré, `weatherParticles.test.ts`) et aucun consommateur ne connaît
 *  le nom d'un type. Le VOCABULAIRE des types, lui, est une énumération à TROIS sites — `WeatherFxId`
 *  ci-dessous, `Scene['weather']` (`noyau/monde/scene.ts`) et l'objet strict du schéma
 *  (`schemas/defs/ambiance.ts`) : nommer un type de plus édite ces trois-là. */
export interface WeatherPrecipDef {
  /** Particules par m² de sol : le BUDGET d'instances de la scène en découle. */
  density: number;
  /** Vitesse de chute (m/s). */
  fallMs: number;
  /** Dérive du vent (m/s) dans le plan du sol (repère three : `x` = est, `z` = sud). */
  windMs: { x: number; z: number };
  /** Largeur et longueur (m) d'une particule ; la longueur court dans le sens de la chute. */
  widthM: number;
  lengthM: number;
  /** Plafond de semis (m) au-dessus du sol : la hauteur du volume où les particules vivent. */
  ceilingM: number;
  color: string;
  opacity: number;
}

/** #1247 — BRUME MONDE d'un type de météo : les nappes horizontales que la voie volumique pose dans
 *  le volume (`gameIso/backends/webgl/weatherSheets.ts`). `hM` est une cote ABSOLUE au-dessus du sol le plus
 *  BAS de la carte — la référence du semis de précipitation (`precipArea`). `povTightenK` resserre la
 *  portée de la première personne (`povDepth`, `gameIso/pov/camera.ts`), les deux consommateurs de portée à
 *  la fois. Aucun type de météo n'est nommé au code : tout vient de `src/data/ambiance.json`. */
export interface WeatherBrumeLayer { hM: number; alpha: number }
export interface WeatherBrumeDef {
  color: string;
  /** Nappes, cotes STRICTEMENT croissantes (garanti au schéma). */
  layers: readonly WeatherBrumeLayer[];
  povTightenK?: number;
}

/** #239 — météo authorée (`scene.weather`) : teinte (`tint`/`alpha`, dérivée en lumière par
 *  `weatherLightScalars`) et, pour la précipitation, `precip` (ci-dessus) que le monde volumique
 *  sème en quads. */
export interface WeatherFxDef {
  tint: string;
  alpha: number;
  particles?: 'pluie' | 'averse' | 'neige';
  pcolor?: string;
  density?: number;
  precip?: WeatherPrecipDef;
  brume?: WeatherBrumeDef;
}
export type WeatherFxId = 'pluie' | 'brouillard' | 'neige' | 'tempete';

export interface AmbianceDef {
  /** Luminosité PLANCHER partagée : une surface éclairée à 0 n'est jamais totalement noire. Source UNIQUE
   *  du clamp de lumière des DEUX vues — POV (`tint`, `gameIso/pov/camera.ts`) et voile d'occlusion des sols iso
   *  (`gameIso/authoring/floorsSvg.ts`) → les deux répondent d'un cran égal. */
  ambientFloor: number;
  /** APPLICATION de la politique de visibilité (`visibilityOf`, `src/noyau/visibility.ts`) en facteur multiplicatif, par
   *  état de case. Source UNIQUE des rendus : couleur de sommet du monde three (`visibilityTint`) et
   *  lumière d'ambiance d'une surface non vue au POV. Un rendu 3D garde, pour une case inconnue, un
   *  facteur bas mais NON nul — une silhouette noire y serait illisible. */
  fogTint: Record<Visibility, number>;
  /** MODELÉ DE FORME de la voie VOLUMIQUE (#1300) : facteur d'irradiance ambiante par FAMILLE
   *  D'ORIENTATION, multiplié dans la couleur de sommet de chaque face selon la direction qu'elle
   *  regarde (`shadeFactorOf`, `gameIso/backends/webgl/faceColors.ts`). `verticales[0..3]` suit l'ordre
   *  CYCLIQUE de la grille (−z, +x, +z, −x) ; le schéma en tient les bornes et l'absence de paire
   *  cycliquement adjacente jumelle (`schemas/defs/ambiance.ts`). */
  faceShade: { haut: number; verticales: readonly number[]; bas: number };
  /** #1372 — ENTRÉE EN SCÈNE : rayon MONDE (m) autour du groupe dont les sujets tiennent le voile de
   *  chargement, et PLAFOND (ms) au-delà duquel il tombe quoi qu'il arrive. Lus par l'écran volumique
   *  (`gameIso/stage/GameStage3D.tsx`), nulle part ailleurs. */
  entreeEnScene: { rayonM: number; plafondMs: number };
  iso: {
    /** Voile CHAUD (lumière dorée descendante) posé sur toute la scène. */
    warm: RadialVeilDef;
    /** Vignette d'assombrissement des bords. */
    vignette: RadialVeilDef;
    /** Filtre de l'ÉTAGE INFÉRIEUR (multi-niveaux) : désaturation + assombrissement, SANS opacité. */
    lowerFloorDim: { saturate: number; slope: number };
    /** FOND du canevas volumique : ce qu'on voit LÀ OÙ IL N'Y A PAS DE CARTE (`stageBg`, teinté par la
     *  météo dans `stageClearColor`) — sourd, jamais noir : un noir enclavé entre deux bâtis se lit
     *  comme un trou dans le monde. */
    stageBg: string;
    /** Voile de NUIT (rect plein écran, alpha piloté par la lumière ambiante). */
    nightVeil: string;
    /** Alpha MAX du voile de nuit (à luminosité 0). L'alpha effectif = `(1 − ambientScalar) × nightVeilMax`,
     *  PARTAGÉ par l'iso ET le POV → les deux vues s'assombrissent à l'identique selon `scene.ambientLight`. */
    nightVeilMax: number;
    /** Opacité de la VIGNETTE à PLEINE lumière (jour). Elle monte vers 1 quand la luminosité baisse →
     *  une scène « jour » n'est plus enfumée de grimdark ; on l'assombrit en baissant `ambientLight`. */
    dayVignetteFloor: number;
    /** Ombrage de PROFONDEUR de la vue « de face » (edge-on) : les rangées écran LOINTAINES (haut de
     *  l'écran) s'assombrissent progressivement (perspective atmosphérique). Décoration de VUE, subtile
     *  (alpha ≈ 8-12 % max). `topFrac`/`bottomFrac` = bornes verticales écran du dégradé (0 = haut). */
    edgeDepth: { color: string; alpha: number; topFrac: number; bottomFrac: number };
    /** Voiles de MÉTÉO authorée de scène (`scene.weather`), par type (#239). `clair` = absent. */
    weather: Partial<Record<WeatherFxId, WeatherFxDef>>;
  };
  pov: {
    /** Haut du ciel d'extérieur — l'horizon se fond dans `fogOutdoor`. */
    skyTop: string;
    /** Brume de distance en INTÉRIEUR (sombre) — aussi le fond des scènes couvertes. */
    fogIndoor: string;
    /** Brume de distance du CIEL EXTÉRIEUR (claire) : bas du dégradé `pov-sky` = horizon. */
    fogOutdoor: string;
    /** Brume de distance des SURFACES en extérieur (sol/mur/relief). DÉCOUPLÉE du ciel : plus chaude et
     *  moins claire que `fogOutdoor` → les sols lointains se fondent dans une brume atmosphérique COHÉRENTE
     *  avec l'iso (chaud/mat), plutôt que de se relever vers le ciel froid et clair (« délavé »). */
    fogOutdoorSurface: string;
    /** Facteur de LUMIÈRE D'AMBIANCE d'une surface STATIQUE non encore VUE (brouillard de guerre) :
     *  multiplie la lumière ambiante de la scène (jour clair / nuit sombre) pour garder la matière
     *  lisible mais LÉGÈREMENT en retrait d'une case explorée — jamais du noir ni un aplat de brume. */
    ambientUnseen: number;
    /** Voile CHAUD du POV (miroir de `iso.warm`) : réconcilie la TEMPÉRATURE des matériaux entre les deux
     *  vues — le POV, sinon, reste froid (swatch neutre + brume de ciel froide) là où l'iso a `g_warm`. */
    warm: RadialVeilDef;
    /** OCCLUSION intra-tuile du sol POV : amplitude d'un dégradé vertical (spéculaire en haut/loin →
     *  ombre de contact en bas/près) posé sur chaque losange — miroir du « creusé » que l'iso tire de son
     *  dégradé de terrain (ex. `g_pave` 143→99). MOYENNE-neutre (highlight ET ombre) : on ajoute du relief,
     *  pas du sombre. 0 = aplat plasticky, sans relief. */
    floorOcclusion: number;
    /** PROFONDEUR du POV — portées, courbes de brume et bandes de LOD, tout en DONNÉE. */
    depth: PovDepthDef;
    vignette: RadialVeilDef;
  };
}

/** Courbe de brume ATMOSPHÉRIQUE d'un milieu : portée max de rendu (cases), début du voile,
 *  gamma de la smoothstep (>1 = les silhouettes restent lisibles plus loin avant de se délaver). */
export interface PovFogDef { farTiles: number; fogStartT: number; fogGamma: number }

export interface PovDepthDef {
  /** Extérieur : perspective atmosphérique longue (claire). */
  outdoor: PovFogDef;
  /** Intérieur : brume sombre COURTE (donnée séparée). */
  indoor: PovFogDef;
  /** Bandes de LOD matériaux — les transitions se CHEVAUCHENT en fondu, jamais de coupure sèche. */
  lod: {
    /** Appareillage COMPLET (blocs nuancés + joints verticaux) jusqu'ici (cases)… */
    blocksT: number;
    /** …puis fondu des blocs/verticaux sur cette longueur (cases). */
    fadeT: number;
    /** Pas PROJETÉ minimal (px) d'un rang : en-dessous les rangs se fondent (anti-moiré) —
     *  le maillage de tuiles et la brume prennent le relais. */
    minJointSpacingPx: number;
    /** Maillage de tuiles des terrains SANS appareillage : fondu d'entrée [start, start+fade] (cases). */
    meshStartT: number;
    meshFadeT: number;
    /** Assombrissement des lignes du maillage (× shade de la teinte du terrain) — très subtil. */
    meshShade: number;
    /** Épaisseur métrique des lignes du maillage (m) quand le terrain n'a pas de joint propre. */
    meshJointWM: number;
  };
}
