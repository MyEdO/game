/** AMBIANCE partagée iso ⇄ POV — donnée pure (`src/data/ambiance.json`) : ciel d'extérieur, brumes
 *  (intérieure sombre / extérieure claire), vignette, voile chaud, filtre d'étage inférieur, voile de
 *  nuit. Les deux regards de l'hôte du monde (`stage/MondeDeCampagne`) et la QC headless consomment
 *  les MÊMES defs SVG assemblées ici —
 *  plus aucune de ces couleurs en dur dans un renderer. */
import { ambiance } from '../../data';
import { ao, luminanceHex, spec } from '../shade';
import type { Dims } from '../../geometry/iso';
import type { Visibility } from '../../state/visibility';
import { isIndoor, type Scene } from '../../noyau/monde/scene';

/** Halo radial (voile chaud / vignette) : centre + rayon en %, couleur et alpha au bord utile. */
export interface RadialVeilDef { cx: string; cy: string; r: string; color: string; alpha: number; innerOff?: string }

/** #1176 P2-6 — PRÉCIPITATION MONDE d'un type de météo : ce qui TOMBE dans le volume de la voie
 *  volumique (`backends/webgl/weatherParticles.ts`). Toute l'apparence et toute la physique du semis
 *  sont ici, en donnée : le MOTEUR est N+1-par-donnée — un `WeatherPrecipDef` forgé, absent du dépôt,
 *  tombe sans une ligne de code (mesuré, `weatherParticles.test.ts`) et aucun consommateur ne connaît
 *  le nom d'un type. Le VOCABULAIRE des types, lui, est une énumération à TROIS sites — `WeatherFxId`
 *  ci-dessous, `Scene['weather']` (`noyau/monde/scene.ts`) et l'objet strict du schéma
 *  (`data/schemas/defs/ambiance.ts`) : nommer un type de plus édite ces trois-là. */
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
 *  le volume (`backends/webgl/weatherSheets.ts`). `hM` est une cote ABSOLUE au-dessus du sol le plus
 *  BAS de la carte — la référence du semis de précipitation (`precipArea`). `povTightenK` resserre la
 *  portée de la première personne (`povDepth`, `pov/camera.ts`), les deux consommateurs de portée à
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
   *  du clamp de lumière des DEUX vues — POV (`tint`, `pov/camera.ts`) et voile d'occlusion des sols iso
   *  (`authoring/floorsSvg.ts`) → les deux répondent d'un cran égal. */
  ambientFloor: number;
  /** APPLICATION de la politique de visibilité (`state/visibility.ts`) en facteur multiplicatif, par
   *  état de case. Source UNIQUE des rendus : couleur de sommet du monde three (`visibilityTint`) et
   *  lumière d'ambiance d'une surface non vue au POV. Un rendu 3D garde, pour une case inconnue, un
   *  facteur bas mais NON nul — une silhouette noire y serait illisible. */
  fogTint: Record<Visibility, number>;
  /** MODELÉ DE FORME de la voie VOLUMIQUE (#1300) : facteur d'irradiance ambiante par FAMILLE
   *  D'ORIENTATION, multiplié dans la couleur de sommet de chaque face selon la direction qu'elle
   *  regarde (`shadeFactorOf`, `backends/webgl/faceColors.ts`). `verticales[0..3]` suit l'ordre
   *  CYCLIQUE de la grille (−z, +x, +z, −x) ; le schéma en tient les bornes et l'absence de paire
   *  cycliquement adjacente jumelle (`data/schemas/defs/ambiance.ts`). */
  faceShade: { haut: number; verticales: readonly number[]; bas: number };
  /** #1372 — ENTRÉE EN SCÈNE : rayon MONDE (m) autour du groupe dont les sujets tiennent le voile de
   *  chargement, et PLAFOND (ms) au-delà duquel il tombe quoi qu'il arrive. Lus par l'écran volumique
   *  (`stage/GameStage3D.tsx`), nulle part ailleurs. */
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

export const AMBIANCE: AmbianceDef = ambiance;

/** PORTE UNIQUE de la météo à l'écran (#1176 P2-6) : la scène a-t-elle une météo à MONTRER, et
 *  laquelle ? Une scène d'INTÉRIEUR n'en montre aucune. C'est le semis de particules du monde
 *  volumique (`backends/webgl/weatherParticles.ts`) qui la lit. Le verdict d'intérieur lui-même vient
 *  de `isIndoor` (`noyau/monde/scene.ts`), la porte de toutes les vues.
 *  C'est le REGISTRE qui décide de ce qui se montre : un id sans entrée au catalogue — `clair`
 *  compris — ne montre rien. */
export function sceneWeatherFx(scene: Pick<Scene, 'weather' | 'ambiance'>): WeatherFxDef | null {
  if (isIndoor(scene)) return null;
  const id = scene.weather;
  if (!id) return null;
  const registre: Partial<Record<string, WeatherFxDef>> = AMBIANCE.iso.weather;
  return registre[id] ?? null;
}

/** La PRÉCIPITATION monde de la scène — ce qui tombe, ou `null`. Même porte, lue par la voie
 *  volumique : un type sans `precip` en donnée (le brouillard) ne fait tomber aucune particule. */
export function scenePrecip(scene: Pick<Scene, 'weather' | 'ambiance'>): WeatherPrecipDef | null {
  return sceneWeatherFx(scene)?.precip ?? null;
}

/** La BRUME monde de la scène — les nappes à poser, ou `null` (#1247). Même porte que le semis : un
 *  type sans `brume` en donnée (la pluie, la neige) n'en pose aucune. */
export function sceneBrume(scene: Pick<Scene, 'weather' | 'ambiance'>): WeatherBrumeDef | null {
  return sceneWeatherFx(scene)?.brume ?? null;
}

/** Ce que la météo fait à la LUMIÈRE de la scène (#1247). */
export interface WeatherLight {
  /** Facteur d'exposition sous la météo — multiplie ambiante, soleil et exposition des billboards.
   *  Il DÉPASSE 1 sous une météo plus CLAIRE que la scène (brouillard, neige) : c'est un facteur
   *  d'exposition, pas une transmittance. */
  dim: number;
  /** Couleur vers laquelle la lumière et le fond se déplacent (`null` = aucune météo à l'écran). */
  tint: string | null;
  /** Dosage de ce déplacement — l'`alpha` de la donnée. */
  k: number;
}

/** Météo sans effet : la scène garde sa lumière entière. */
export const METEO_SANS_EFFET: WeatherLight = { dim: 1, tint: null, k: 0 };

/** ALBÉDO DE RÉFÉRENCE de l'appariement ci-dessous : le gris moyen (128/255), en sRGB — l'espace où
 *  la donnée de météo est ÉCRITE, et où se compose le voile d'écran qu'elle décrit. */
export const ALBEDO_REF = 0.5;

/**
 * LUMIÈRE DÉRIVÉE de la météo — l'expression VOLUMIQUE du voile d'écran que décrit la donnée authorée
 * (`tint`/`alpha`) : aucun champ de lumière n'est authoré, donc un type de météo qui n'a que
 * `tint`/`alpha` (la neige) est servi sans une ligne de code de plus.
 *
 * APPARIEMENT EN LUMINANCE, sur l'albédo de référence. Un voile compose `(1 − a)·scène + a·teinte` :
 * il ÉCLAIRCIT dès que la teinte est plus claire que la scène (mesuré sur gris moyen : brouillard
 * 128 → 140, neige 128 → 140 ; pluie 128 → 120, tempête 128 → 102). Une lumière, elle, MULTIPLIE — et
 * `1 − a` seul assombrissait donc TOUTES les météos, à rebours de la moitié d'entre elles. Le facteur
 * rendu est celui qui reproduit cette composition sur cet albédo :
 *   `dim = (1 − a) + a · L(teinte) / ALBEDO_REF`,
 * avec `L` la luminance perçue (Rec. 709, `luminanceHex`) en sRGB — l'espace des octets de la donnée,
 * celui où le voile mélange. Il dépasse 1 pour une teinte claire : les intensités de three ne sont pas
 * bornées à 1, et c'est ce qui fait qu'une neige ÉCLAIRE la scène.
 *
 * CE QUE L'APPARIEMENT NE TIENT PAS, en fait : il est exact sur l'albédo de référence et approché
 * ailleurs (une lumière multiplie, un voile interpole — les deux ne coïncident qu'en un point). Un
 * albédo sombre rend donc un peu moins que le voile, un albédo clair un peu plus ; le SENS de
 * l'effet, lui, est le même partout (le facteur est > 1 ou < 1 pour tous les
 * albédos à la fois). La TEINTE (hue) ne passe pas par ce scalaire : elle vit dans la couleur des
 * lampes et du fond (`meteoLightColor`, `stageClearColor`), dont la luminance est bornée par
 * construction — aucun déplacement de couleur ne relèverait à lui seul l'exposition.
 */
export function weatherLightScalars(scene: Pick<Scene, 'weather' | 'ambiance'>): WeatherLight {
  const fx = sceneWeatherFx(scene);
  if (!fx) return METEO_SANS_EFFET;
  const k = Math.min(1, Math.max(0, fx.alpha));
  const L = luminanceHex(fx.tint);
  // Teinte non hexa (CSS `var(--x)`) : aucune luminance mesurable, on s'en tient à la transmittance.
  const dim = L === null ? 1 - k : (1 - k) + (k * L) / ALBEDO_REF;
  return { dim, tint: fx.tint, k };
}

/** Alpha du voile de NUIT à la luminosité `light` (0..1) — SOURCE UNIQUE du dosage, dont
 *  `ambianceLuminance` ci-dessous est l'autre face. */
export function nightVeilAlpha(light: number): number {
  return (1 - light) * AMBIANCE.iso.nightVeilMax;
}

/** Part de la LUMINANCE d'origine qui subsiste sous le voile de nuit à la luminosité `light` — soit
 *  `1 − nightVeilAlpha(light)`, l'autre face de la MÊME donnée. C'est le scalaire d'exposition du
 *  stage : il en dose les LAMPES (`stage/stageLights.ts`) — d'où un plancher non nul à luminosité 0
 *  (`1 − nightVeilMax`). */
export function ambianceLuminance(light: number): number {
  return 1 - nightVeilAlpha(light);
}

const radialVeil = (id: string, v: RadialVeilDef, fadeOut: boolean): string =>
  `<radialGradient id="${id}" cx="${v.cx}" cy="${v.cy}" r="${v.r}">` +
  (fadeOut
    ? `<stop offset="0%" stop-color="${v.color}" stop-opacity="${v.alpha}"/><stop offset="100%" stop-color="${v.color}" stop-opacity="0"/>`
    : `<stop offset="${v.innerOff ?? '50%'}" stop-color="${v.color}" stop-opacity="0"/><stop offset="100%" stop-color="${v.color}" stop-opacity="${v.alpha}"/>`) +
  `</radialGradient>`;

/** Defs SVG de l'ambiance ISO (voile chaud `g_warm`, vignette `g_vig`). */
export function isoAmbianceDefs(): string {
  const { warm, vignette } = AMBIANCE.iso;
  return radialVeil('g_warm', warm, true) + radialVeil('g_vig', vignette, false);
}

/** Assombrissement de l'étage INFÉRIEUR (z < activeZ) en CSS `filter` (GPU-composité par le navigateur →
 *  coût quasi nul, ≠ filtre SVG `url()` re-rastérisé au CPU par élément = rame). Même effet que l'ancien
 *  `lower-floor-dim` : désaturation + assombrissement, SANS opacité (l'étage recule mais reste OPAQUE). */
export function lowerFloorDimCss(): string {
  const { lowerFloorDim: dim } = AMBIANCE.iso;
  return `saturate(${dim.saturate}) brightness(${dim.slope})`;
}

/** Gabarit d'ALIGNEMENT ÉDITEUR (couche `z < currentLayer`, EditorCanvas UNIQUEMENT — jamais le jeu,
 *  qui reste sur `lowerFloorDimCss` ci-dessus telle quelle) : MÊME désaturation/assombrissement
 *  catalogués que le jeu + une VRAIE opacité — un gabarit doit pouvoir s'EFFACER franchement pour ne
 *  pas concurrencer le tracé de la couche active, ce que le voile de jeu (opaque par choix, l'étage
 *  du DESSOUS doit y rester pleinement lisible) ne permet pas. `opacity` = réglage UTILISATEUR
 *  (curseur, 0 = masqué, 1 = plein), jamais une constante catalogue. */
export function editorLowerLayerFilterCss(opacity: number): string {
  const { lowerFloorDim: dim } = AMBIANCE.iso;
  return `saturate(${dim.saturate}) brightness(${dim.slope}) opacity(${opacity})`;
}

/** Voile d'ASSOMBRISSEMENT de profondeur de la vue « de face » (edge-on) : les rangées écran lointaines
 *  (haut de l'écran) reculent dans une brume sombre progressive. DÉCORATION DE VUE (screen-space) —
 *  jamais dans les builders : le stage affine ET la QC l'appliquent au dessin, PAR-DESSUS la scène. Vide
 *  hors edge-on. Auto-contenu (gradient objectBoundingBox + rect plein cadre) → une seule source, deux
 *  consommateurs ; l'id partagé est sans risque (contenu identique entre panneaux). */
export function edgeDepthVeil(dims: Dims, w: number, h: number): string {
  if (!dims.edge || dims.view === 'top') return '';
  const { color, alpha, topFrac, bottomFrac } = AMBIANCE.iso.edgeDepth;
  return (
    `<linearGradient id="edge-depth" x1="0" y1="0" x2="0" y2="1">` +
    `<stop offset="${(topFrac * 100).toFixed(1)}%" stop-color="${color}" stop-opacity="${alpha}"/>` +
    `<stop offset="${(bottomFrac * 100).toFixed(1)}%" stop-color="${color}" stop-opacity="0"/>` +
    `</linearGradient>` +
    `<rect x="0" y="0" width="${w}" height="${h}" fill="url(#edge-depth)" pointer-events="none"/>`
  );
}

/** Defs SVG du POV : ciel d'extérieur (`pov-sky`) + vignette (`pov-vignette`).
 *  Le ciel atteint la couleur de brume EXACTEMENT à l'horizon (50 % = ligne d'œil, projection sans
 *  tangage) et le reste sous l'horizon : tout ce qui est coupé en portée ou hors visibilité se fond
 *  dans cette nappe — plus de « trous » de ciel à travers le sol. */
export function povAmbianceDefs(): string {
  const { skyTop, fogOutdoor, vignette, warm, floorOcclusion: occl } = AMBIANCE.pov;
  // OCCLUSION intra-tuile du sol : dégradé NEUTRE (spéculaire en haut/loin → transparent → ombre de contact
  // en bas/près) en objectBoundingBox → chaque losange de sol reçoit le MÊME « creusé » vertical que l'iso,
  // indépendamment de sa couleur (fog/lumière). Couleurs via `spec`/`ao` (shade.ts, sanctionnés).
  const floorShade =
    `<linearGradient id="pov-floor-shade" x1="0" y1="0" x2="0" y2="1">` +
    `<stop offset="0%" stop-color="${spec(occl)}"/>` +
    `<stop offset="50%" stop-color="${ao(0)}"/>` +
    `<stop offset="100%" stop-color="${ao(occl)}"/>` +
    `</linearGradient>`;
  return (
    `<linearGradient id="pov-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="${skyTop}"/><stop offset="50%" stop-color="${fogOutdoor}"/><stop offset="100%" stop-color="${fogOutdoor}"/></linearGradient>` +
    floorShade +
    radialVeil('pov-warm', warm, true) +
    radialVeil('pov-vignette', vignette, false)
  );
}
