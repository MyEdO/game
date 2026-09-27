/**
 * Schéma de `ambiance.json` — AMBIANCE de rendu partagée iso ⇄ POV (ciel/brumes/vignette/voile chaud/
 * filtre d'étage), consommée comme `AmbianceDef` (objet RACINE unique, PAS un tableau) —
 * `src/gameIso/catalog/ambiance.ts`.
 */
import { z } from 'zod';
import { document } from '../grammaire/document';
import { couleurHexSchema } from '../grammaire/valeurs';

export const file = 'ambiance.json';
export const famille = 'config';

const radialVeilSchema = z.strictObject({
  cx: z.string(),
  cy: z.string(),
  r: z.string(),
  color: z.string(),
  alpha: z.number(),
  innerOff: z.string().optional(),
});

const povFogSchema = z.strictObject({
  farTiles: z.number(),
  fogStartT: z.number(),
  /** Exposant de la courbe de brume (`fogAt`, `pov/camera.ts`), porté au shader comme LITTÉRAL GLSL à
   *  quatre décimales (`applyFogGamma`, `backends/webgl/sceneMeshes.ts`). Le plancher est celui de ce
   *  littéral : sous 0,00005 il s'écrirait « 0.0000 », donc `pow(x, 0) = 1` — une brume PLEINE partout,
   *  sans un mot. 0,1 le tient à distance (données actuelles : 2 dehors, 1,2 dedans). #1176 P3-1c */
  fogGamma: z.number().positive().min(0.1),
});

/** #1176 P2-6 — PRÉCIPITATION MONDE d'un type de météo : le semis de particules qui tombe dans le
 *  volume de la voie volumique. Toutes les bornes sont des bornes de PLAUSIBILITÉ physique et de
 *  BUDGET : une donnée hors bornes ne fait pas une météo étrange, elle fait un semis qui ne tombe
 *  pas (vitesse nulle), qui remonte (négative) ou qui noie la frame (densité). */
const precipSchema = z
  .strictObject({
    /** Particules par m² de SOL couvert — c'est elle qui fixe le budget d'instances de la scène. */
    density: z.number().gt(0).max(2),
    /** Vitesse de CHUTE (m/s). */
    fallMs: z.number().gt(0).max(40),
    /** Dérive du VENT (m/s) dans le plan du sol (`x` = est, `z` = sud). */
    windMs: z.strictObject({ x: z.number().min(-30).max(30), z: z.number().min(-30).max(30) }),
    /** Largeur et longueur (m) d'une particule — la longueur court dans le sens de la chute. */
    widthM: z.number().gt(0).max(1),
    lengthM: z.number().gt(0).max(4),
    /** Hauteur (m) du PLAFOND de semis au-dessus du sol : le volume où les particules vivent. */
    ceilingM: z.number().gt(0).max(60),
    color: couleurHexSchema,
    opacity: z.number().gt(0).max(1),
  })
  .refine((p) => p.lengthM >= p.widthM, {
    message: 'precip : `lengthM` ≥ `widthM` — une particule s’étire dans le sens de sa chute, elle n’est jamais plus large que longue',
  })
  .refine((p) => Math.hypot(p.windMs.x, p.windMs.z) < p.fallMs, {
    message: 'precip : la dérive du vent doit rester SOUS la vitesse de chute — au-delà, la précipitation file à l’horizontale et ne touche plus le sol',
  });

/** #1247 — BRUME MONDE d'un type de météo : des nappes horizontales translucides posées à des cotes
 *  fixes au-dessus du sol, dans le volume de la voie volumique (`backends/webgl/weatherSheets.ts`).
 *
 *  RÉFÉRENCE de `hM` : cote ABSOLUE monde, comptée au-dessus du sol le plus BAS de l'emprise de la
 *  carte — la même référence que le recyclage du semis de précipitation (`precipArea`,
 *  `backends/webgl/weatherParticles.ts`), pour que les deux expressions d'une même météo se posent
 *  dans le même repère. Une carte à fort relief a donc des nappes qui rasent ses creux et enterrent
 *  ses sommets : c'est le prix d'une cote unique par scène, et c'est mesurable à l'authoring.
 *
 *  Les bornes sont des bornes de BUDGET et de TRI : quatre nappes au plus (au-delà, c'est un voile
 *  plein), des cotes STRICTEMENT croissantes (deux nappes à la même cote ne se trient pas — leur
 *  ordre de mélange dépendrait de l'ordre de montage), et un alpha non nul (une nappe invisible se
 *  supprime, elle ne s'écrit pas `alpha: 0`). */
const brumeSchema = z
  .strictObject({
    color: couleurHexSchema,
    layers: z
      .array(
        z.strictObject({
          /** Cote (m) de la nappe au-dessus du sol le plus BAS de la carte. */
          hM: z.number().min(0).max(60),
          alpha: z.number().gt(0).max(1),
        }),
      )
      .min(1)
      .max(4),
    /** RESSERREMENT de la portée première personne sous cette météo (part de la portée du milieu) :
     *  1 = portée intacte. Appliqué EN AMONT de la courbe de brume ET du plan lointain de la caméra
     *  (`povDepth`, `gameIso/pov/camera.ts`) — les deux ou aucun. */
    povTightenK: z.number().gt(0).max(1).optional(),
  })
  .refine((b) => b.layers.every((l, i) => i === 0 || l.hM > b.layers[i - 1].hM), {
    message: 'brume : les cotes `hM` doivent croître STRICTEMENT — deux nappes à la même cote ne se trient pas',
  });

// #239 — FX de météo AUTHORÉE de scène (`scene.weather`), par type.
const weatherFxSchema = z.strictObject({
  tint: z.string(),
  alpha: z.number(),
  particles: z.enum(['pluie', 'averse', 'neige']).optional(),
  pcolor: z.string().optional(),
  density: z.number().optional(),
  /** Absent = ce type ne fait TOMBER aucune particule (le brouillard n'en fait pas). */
  precip: precipSchema.optional(),
  /** Absent = ce type ne pose AUCUNE nappe de brume (la pluie et la neige n'en posent pas : leur
   *  expression volumique est le semis plus la teinte dérivée de `tint`/`alpha`). */
  brume: brumeSchema.optional(),
});

/** Facteur multiplicatif de teinte : 0 = éteint, 1 = pleine matière — hors de [0,1] il n'éclaircit
 *  plus, il sur-expose (ou inverse le signe de la couleur). */
const tintFactor = z.number().min(0).max(1);

/** #1300 — MODELÉ DE FORME de la voie volumique : facteur d'irradiance ambiante par FAMILLE
 *  D'ORIENTATION, multiplié dans la couleur de chaque face selon la direction qu'elle regarde. Terme
 *  d'exposition au ciel et aux ouvertures, PAS une lampe — aucune source ne s'y ajoute, et une face
 *  d'une famille sombre reste sous une face d'une autre famille éclairée à l'identique.
 *  Six familles : les deux horizontales (`haut` = sol/toit, `bas` = soffite), et les quatre verticales
 *  dans l'ORDRE CYCLIQUE de la grille — `verticales[0..3]` = −z, +x, +z, −x.
 *
 *  Bornes : un facteur RETIRE de la lumière, il n'en ajoute pas (0 exclu, 1 compris). Les quatre
 *  verticales DÉCROISSENT strictement le long du cycle : c'est ce qui interdit qu'une paire
 *  cycliquement adjacente soit jumelle — le bouclage compris, la première étant alors la plus grande.
 *  Deux familles adjacentes jumelles ne modèlent plus l'angle qu'elles forment, ce qui est le défaut
 *  que ce bloc corrige. La PREMIÈRE verticale passe SOUS l'horizontale haute pour la même raison : le
 *  sol et le mur qu'il rejoint sont covisibles à chaque plinthe, et à valeur égale leur arête
 *  disparaît. Le rapport max/min des verticales est plafonné : au-delà, la famille la plus sombre
 *  passe sous le plancher de luminance de la scène (palier `tenebres` × `fogTint.explored`).
 *
 *  `bas` a un producteur : le DESSOUS d'un décor volumique (`gameIso/builders/propVolumes.ts`), dont
 *  chaque face porte son propre dehors jusqu'à la cuisson. Les murs, eux, n'en produisent aucun —
 *  `wallBoxPolys` (`gameIso/backends/webgl/worldTris.ts`) omet le dessous d'un mur, et un sol présente
 *  toujours sa normale vers le haut (`gameIso/stage/modele-forme.test.ts`). */
const faceShadeSchema = z
  .strictObject({
    haut: z.number().gt(0).max(1),
    verticales: z.array(z.number().gt(0).max(1)).length(4),
    bas: z.number().gt(0).max(1),
  })
  .refine((s) => s.verticales.every((v, i) => i === 0 || v < s.verticales[i - 1]), {
    message:
      'faceShade.verticales : les quatre facteurs doivent DÉCROÎTRE strictement le long du cycle (−z, +x, +z, −x) — deux familles cycliquement adjacentes égales laissent l’angle qu’elles forment sans modelé',
  })
  .refine((s) => s.verticales[0] < s.haut, {
    message:
      'faceShade : la première verticale doit passer SOUS `haut` — un sol et le mur qu’il rejoint sont covisibles à chaque plinthe, et à valeur égale leur arête disparaît',
  })
  .refine((s) => Math.max(...s.verticales) / Math.min(...s.verticales) <= 2, {
    message: 'faceShade.verticales : rapport max/min ≤ 2 — au-delà, la famille la plus sombre passe sous le plancher de luminance',
  });

const doc = document(
  'ambiance',
  famille,
  {
  ambientFloor: z.number(),
  // `fogTint` = APPLICATION de la politique de visibilité en facteur MULTIPLICATIF (0..1), partagée par
  // les trois rendus (`gameIso/catalog/ambiance.ts`). Trois invariants la tiennent : un facteur reste
  // dans [0,1] ; l'ordre des états ne s'inverse pas (une case jamais vue ne peut pas être plus lumineuse
  // qu'un souvenir, ni un souvenir plus lumineux que le vu) ; `explored` est le DÉNOMINATEUR du cran
  // d'ambiance de la première personne, donc strictement positif.
  fogTint: z
    .strictObject({ visible: tintFactor, explored: tintFactor, unknown: tintFactor })
    .refine((t) => t.explored > 0, {
      message: 'fogTint.explored doit être > 0 : il divise le cran d’ambiance POV (`POV_AMBIENT.unknown`)',
    })
    .refine((t) => t.visible >= t.explored && t.explored >= t.unknown, {
      message: 'fogTint doit décroître visible ≥ explored ≥ unknown : une case moins connue ne peut pas être plus lumineuse',
    }),
  faceShade: faceShadeSchema,
  /** #1372 — ENTRÉE EN SCÈNE : le voile bref que l'écran tient pendant que les sujets PROCHES du
   *  groupe reçoivent leur texture (`stage/GameStage3D.tsx`). Valeurs MAISON (rendu, hors RAW).
   *
   *  `rayonM` est un rayon MONDE en mètres, comparé à la distance du sujet au groupe dans le repère
   *  three — il ne se compte pas en cases : deux scènes de `mpt` différents ne montreraient pas la
   *  même profondeur de décor sous le même chiffre. `plafondMs` est la borne de SÉCURITÉ : un SVG
   *  qui ne se charge jamais tiendrait sinon le voile pour toute la session. Les bornes sont des
   *  bornes d'usage — un rayon nul ne voile rien, un plafond de dix secondes n'est plus un plafond. */
  entreeEnScene: z.strictObject({
    rayonM: z
      .number()
      .gt(0, 'entreeEnScene.rayonM : le rayon doit être > 0 — à zéro aucun sujet n’est « proche », et le voile tombe sans avoir rien couvert')
      .max(200, 'entreeEnScene.rayonM : le rayon doit rester ≤ 200 m — au-delà, le voile attend la carte ENTIÈRE et il n’y a plus de progressif'),
    plafondMs: z
      .number()
      .gt(0, 'entreeEnScene.plafondMs : le plafond doit être > 0 — à zéro le voile tombe avant la première texture')
      .max(10000, 'entreeEnScene.plafondMs : le plafond doit rester ≤ 10000 ms — au-delà ce n’est plus une borne de sécurité, l’écran reste voilé'),
  }),
  iso: z.strictObject({
    warm: radialVeilSchema,
    vignette: radialVeilSchema,
    lowerFloorDim: z.strictObject({ saturate: z.number(), slope: z.number() }),
    stageBg: z.string(),
    nightVeil: z.string(),
    nightVeilMax: z.number(),
    dayVignetteFloor: z.number(),
    edgeDepth: z.strictObject({
      color: z.string(),
      alpha: z.number(),
      topFrac: z.number(),
      bottomFrac: z.number(),
    }),
    weather: z.strictObject({
      pluie: weatherFxSchema.optional(),
      brouillard: weatherFxSchema.optional(),
      neige: weatherFxSchema.optional(),
      tempete: weatherFxSchema.optional(),
    }),
  }),
  pov: z.strictObject({
    skyTop: z.string(),
    fogIndoor: z.string(),
    fogOutdoor: z.string(),
    fogOutdoorSurface: z.string(),
    ambientUnseen: z.number(),
    warm: radialVeilSchema,
    floorOcclusion: z.number(),
    depth: z.strictObject({
      outdoor: povFogSchema,
      indoor: povFogSchema,
      lod: z.strictObject({
        blocksT: z.number(),
        fadeT: z.number(),
        minJointSpacingPx: z.number(),
        meshStartT: z.number(),
        meshFadeT: z.number(),
        meshShade: z.number(),
        meshJointWM: z.number(),
      }),
    }),
    vignette: radialVeilSchema,
  }),
  },
  {
    ambientFloor: { label: 'Plancher ambiant', hint: 'Luminosité minimale garantie, quel que soit le calcul de scène' },
    fogTint: { label: 'Teinte de brouillard', hint: 'Facteurs multiplicatifs visible/exploré/inconnu de la politique de visibilité' },
    faceShade: { label: 'Modelé des faces', hint: 'Facteurs d’irradiance ambiante par orientation de face' },
    entreeEnScene: { label: 'Entrée en scène', hint: 'Voile bref pendant le chargement des textures des sujets proches' },
    iso: { label: 'Ambiance isométrique', hint: 'Réglages de voiles, vignette et météo propres à la vue isométrique' },
    pov: { label: 'Ambiance première personne', hint: 'Réglages de brumes, profondeur et vignette propres à la vue première personne' },
  },
  {
    codex: {
      exempt: { kind: 'vocabulaire-app-interne', raison: 'config de rendu (éclairage iso/POV), pas une fiche de contenu.' },
    },
    edit: { none: 'aucune catégorie Codex ne l’expose, donc aucun formulaire d’atelier ne l’édite' },
  },
);

export const schema = doc.schema;
export const meta = doc.meta;

export const exposition = doc.exposition;
