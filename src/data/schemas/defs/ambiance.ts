import { nommerChamps } from '../grammaire/meta';
/**
 * Lumière, visibilité et météo des regards Godot (`AmbianceDef`, `src/data/index.ts`).
 */
import { z } from 'zod';
import { document } from '../grammaire/document';
import { couleurHexSchema } from '../grammaire/valeurs';
import { ref } from '../grammaire/ref';

export const file = 'ambiance.json';
export const famille = 'config';

const povFogSchema = nommerChamps(z.strictObject({
  farTiles: z.number(),
  fogStartT: z.number(),
  /** Exposant de la courbe de brume projetée vers Godot (`lumiereDeLaScene`). */
  fogGamma: z.number().positive().min(0.1),
}), {
  farTiles: { label: 'portée en cases' },
  fogStartT: { label: 'début de la brume' },
  fogGamma: { label: 'exposant de brume' },
});

/** #1176 P2-6 — PRÉCIPITATION MONDE d'un type de météo : le semis de particules qui tombe dans le
 *  volume de la voie volumique. Toutes les bornes sont des bornes de PLAUSIBILITÉ physique et de
 *  BUDGET : une donnée hors bornes ne fait pas une météo étrange, elle fait un semis qui ne tombe
 *  pas (vitesse nulle), qui remonte (négative) ou qui noie la frame (densité). */
const precipSchema = nommerChamps(z
  .strictObject({
    /** Particules par m² de SOL couvert — c'est elle qui fixe le budget d'instances de la scène. */
    density: z.number().gt(0).max(2),
    /** Vitesse de CHUTE (m/s). */
    fallMs: z.number().gt(0).max(40),
    /** Dérive du VENT (m/s) dans le plan du sol (`x` = est, `z` = sud). */
    windMs: nommerChamps(z.strictObject({ x: z.number().min(-30).max(30), z: z.number().min(-30).max(30) }), { x: { label: 'abscisse' }, z: { label: 'axe sud' } }),
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
  }), {
  density: { label: 'densité' },
  fallMs: { label: 'vitesse de chute en mètres par seconde' },
  windMs: { label: 'vent en mètres par seconde' },
  widthM: { label: 'largeur en mètres' },
  lengthM: { label: 'longueur en mètres' },
  ceilingM: { label: 'plafond en mètres' },
  color: { label: 'couleur' },
  opacity: { label: 'opacité' },
});

/** #1247 — BRUME MONDE d'un type de météo : des nappes horizontales translucides posées à des cotes
 *  fixes au-dessus du sol (`meteoSurLesBandes`, `src/noyau/monde/meteo.ts`).
 *
 *  RÉFÉRENCE de `hM` : cote ABSOLUE monde, comptée au-dessus du sol le plus BAS de l'emprise de la
 *  carte (`sceneGroundSpan`). Une carte à fort relief a donc des nappes qui rasent ses creux et enterrent
 *  ses sommets : c'est le prix d'une cote unique par scène, et c'est mesurable à l'authoring.
 *
 *  Les bornes sont des bornes de BUDGET et de TRI : quatre nappes au plus (au-delà, c'est un voile
 *  plein), des cotes STRICTEMENT croissantes (deux nappes à la même cote ne se trient pas — leur
 *  ordre de mélange dépendrait de l'ordre de montage), et un alpha non nul (une nappe invisible se
 *  supprime, elle ne s'écrit pas `alpha: 0`). */
const brumeSchema = nommerChamps(z
  .strictObject({
    color: couleurHexSchema,
    layers: z
      .array(
        nommerChamps(z.strictObject({
          /** Cote (m) de la nappe au-dessus du sol le plus BAS de la carte. */
          hM: z.number().min(0).max(60),
          alpha: z.number().gt(0).max(1),
        }), { hM: { label: 'hauteur en mètres' }, alpha: { label: 'opacité' } }),
      )
      .min(1)
      .max(4),
    /** RESSERREMENT de la portée première personne sous cette météo (part de la portée du milieu) :
     *  1 = portée intacte. Multiplie le début et la fin de la brume dans `lumiereDeLaScene`. */
    povTightenK: z.number().gt(0).max(1).optional(),
  })
  .refine((b) => b.layers.every((l, i) => i === 0 || l.hM > b.layers[i - 1].hM), {
    message: 'brume : les cotes `hM` doivent croître STRICTEMENT — deux nappes à la même cote ne se trient pas',
  }), {
  color: { label: 'couleur' },
  layers: { label: 'couches' },
  povTightenK: { label: 'facteur de réduction de portée' },
});

// #239 — FX de météo AUTHORÉE de scène (`scene.weather`), par type.
const weatherFxSchema = nommerChamps(z.strictObject({
  tint: z.string(),
  alpha: z.number(),
  /** Absent = ce type ne fait TOMBER aucune particule (le brouillard n'en fait pas). */
  precip: precipSchema.optional(),
  /** Absent = ce type ne pose AUCUNE nappe de brume (la pluie et la neige n'en posent pas : leur
   *  expression volumique est le semis plus la teinte dérivée de `tint`/`alpha`). */
  brume: brumeSchema.optional(),
  /** #3834 : joué en boucle tant que la scène porte cette météo ; absent, elle ne s'entend pas. */
  son: ref('son').optional(),
}), {
  tint: { label: 'teinte' },
  alpha: { label: 'opacité' },
  precip: { label: 'précipitations' },
  brume: { label: 'brume' },
  son: { label: 'son' },
});

/** Facteur multiplicatif de teinte : 0 = éteint, 1 = pleine matière — hors de [0,1] il n'éclaircit
 *  plus, il sur-expose (ou inverse le signe de la couleur). */
const tintFactor = z.number().min(0).max(1);

const doc = document(
  'ambiance',
  famille,
  {
  // La visibilité du groupe ordonne l’éclairement des cases visibles, explorées et inconnues.
  fogTint: nommerChamps(z
    .strictObject({ visible: tintFactor, explored: tintFactor, unknown: tintFactor })
    .refine((t) => t.explored > 0, {
      message: 'fogTint.explored doit être > 0 : une case explorée garde une part de lumière',
    })
    .refine((t) => t.visible >= t.explored && t.explored >= t.unknown, {
      message: 'fogTint doit décroître visible ≥ explored ≥ unknown : une case moins connue ne peut pas être plus lumineuse',
    }), {
    visible: { label: 'visible' },
    explored: { label: 'exploré' },
    unknown: { label: 'inconnu' },
  }),
  iso: nommerChamps(z.strictObject({
    stageBg: z.string(),
    weather: nommerChamps(z.strictObject({
      pluie: weatherFxSchema.optional(),
      brouillard: weatherFxSchema.optional(),
      neige: weatherFxSchema.optional(),
      tempete: weatherFxSchema.optional(),
    }), {
      pluie: { label: 'pluie' },
      brouillard: { label: 'brouillard' },
      neige: { label: 'neige' },
      tempete: { label: 'tempête' },
    }),
  }), {
    stageBg: { label: 'fond de scène' },
    weather: { label: 'météo' },
  }),
  pov: nommerChamps(z.strictObject({
    skyTop: z.string(),
    fogIndoor: z.string(),
    fogOutdoor: z.string(),
    depth: nommerChamps(z.strictObject({
      outdoor: povFogSchema,
      indoor: povFogSchema,
    }), {
      outdoor: { label: 'extérieur' },
      indoor: { label: 'intérieur' },
    }),
  }), {
    skyTop: { label: 'haut du ciel' },
    fogIndoor: { label: 'brume intérieure' },
    fogOutdoor: { label: 'brume extérieure' },
    depth: { label: 'profondeur' },
  }),
  },
  {
    fogTint: { label: 'Teinte de brouillard', hint: 'Facteurs multiplicatifs visible/exploré/inconnu de la politique de visibilité' },
    iso: { label: 'Fond et météo', hint: 'Fond des regards tactique et plateau, catalogue météo de la scène' },
    pov: { label: 'Ambiance en immersion', hint: 'Couleurs du ciel et courbe de brume en immersion' },
  },
  {
    codex: {
      exempt: { kind: 'vocabulaire-app-interne', raison: 'configuration de lumière, visibilité et météo des regards.' },
    },
    edit: { none: 'aucune catégorie Codex ne l’expose, donc aucun formulaire d’atelier ne l’édite' },
  },
);

export const schema = doc.schema;
export const meta = doc.meta;

export const exposition = doc.exposition;
