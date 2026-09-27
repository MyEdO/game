/**
 * Schéma de `sea-weather.json` — MÉTÉO DE LA MER DES GRIFFES (MDG 13 l.162-306). Consommé par
 * `src/engine/seaWeather.ts` (`DATA as unknown as { ... }`, cast inline reflété ICI 1:1) : tirage
 * quotidien (table 4 aspects), modificateur saisonnier, catalogues d'aspect (Précipitations /
 * Température / Visibilité / Vents), rose des vents, effet du vent (standard + Clinfoc), Affaler les
 * voiles, Encalminé.
 */
import { z } from 'zod';
import { document, type EnveloppeDocument } from '../grammaire/document';
import { difficultySchema, enumNomme, plageSchema, sourceRefSchema } from '../grammaire/valeurs';
import { refOuSpec } from '../grammaire/ref';

export const file = 'sea-weather.json';
export const famille = 'config';

const windForce = z.enum([
  'calme-plat',
  'legere-brise',
  'brise-fraiche',
  'vent-modere',
  'vent-violent',
  'violente-tempete',
]);
/** Aspect du vent relatif au cap (MDG 13 l.267-270). */
export const windAspectSchema = enumNomme({ arriere: 'vent arrière', lateral: 'vent latéral', face: 'vent de face' });
const windEffectCell = z.strictObject({
  pctSail: z.number().optional(),
  pctOther: z.number().optional(),
  encalmine: z.boolean().optional(),
  affaler: z.boolean().optional(),
  virement: z.boolean().optional(),
});
const windEffectTable = z.record(windForce, z.record(windAspectSchema, windEffectCell));

const champs = {
  table: z.array(
    z.strictObject({
      ...plageSchema.shape,
      precipitations: z.enum(['aucune', 'legeres', 'abondantes', 'tres-abondantes']),
      temperature: z.enum(['caniculaire', 'chaude', 'mediane', 'froide', 'glaciale']),
      visibilite: z.enum(['degage', 'brume', 'brouillard', 'puree-de-pois']),
      vent: windForce,
      source: sourceRefSchema,
    }),
  ),
  seasonMod: z.strictObject({
    ete: z.number(),
    automne: z.number(),
    printemps: z.number(),
    hiver: z.number(),
    source: sourceRefSchema,
  }),
  warmSeaMod: z.number(),
  precipitations: z.array(
    z.strictObject({
      id: z.string(),
      label: z.string(),
      desc: z.string().optional(),
      skillMods: z
        .array(
          z.strictObject({
            /** MDG 13 l.187-201. */
            skills: z.array(refOuSpec('skill')),
            mod: z.number(),
          }),
        )
        .optional(),
      otherMod: z.number().optional(),
      source: sourceRefSchema,
    }),
  ),
  temperatures: z.array(
    z.strictObject({
      id: z.string(),
      label: z.string(),
      testEveryHours: z.number().optional(),
      difficulty: difficultySchema.optional(),
      exposure: z.enum(['chaleur', 'froid']).optional(),
      litresParJour: z.number().optional(),
      source: sourceRefSchema,
    }),
  ),
  visibilites: z.array(
    z.strictObject({
      id: z.string(),
      label: z.string(),
      drPenalty: z.number().optional(),
      beyondM: z.number().optional(),
      source: sourceRefSchema,
    }),
  ),
  vents: z.array(z.strictObject({ id: z.string(), label: z.string(), source: sourceRefSchema })),
  roseDesVents: z.array(
    z.strictObject({
      ...plageSchema.shape,
      direction: z.enum(['dominant', 'nord', 'sud', 'ouest', 'est']),
      source: sourceRefSchema,
    }),
  ),
  effetDuVent: windEffectTable,
  effetDuVentClinfoc: windEffectTable,
  /** Gréement de course (MSRC 12 l.137) : DELTA de % voiles ajouté au tableau standard par aspect de vent. */
  effetDuVentGreementDelta: z.record(windAspectSchema, z.number()),
  affaler: z.strictObject({
    difficulty: difficultySchema,
    failCritLocation: z.string(),
    driftPctOfSpeed: z.number(),
  }),
  encalmine: z.strictObject({ currentM: z.number(), towM: z.number(), towManDR: z.number() }),
};

const doc = document(
  'sea-weather',
  famille,
  champs,
  {
    table: {
      label: 'Tirage quotidien',
      hint: 'Tirage 1d10 + modificateur saisonnier, PAR ASPECT (4 tirages : précipitations/température/visibilité/vent)',
    },
    seasonMod: { label: 'Modificateur saisonnier', hint: 'Décalage du tirage météo par saison' },
    warmSeaMod: { label: 'Modificateur mer chaude', hint: 'Décalage du tirage météo en mer chaude' },
    precipitations: {
      label: 'Précipitations',
      hint: "Catalogue des paliers de précipitations et de leurs pénalités (dont par spécialisation d'arme)",
    },
    temperatures: { label: 'Températures', hint: "Catalogue des paliers de température et de leur exigence de Test/exposition" },
    visibilites: { label: 'Visibilités', hint: 'Catalogue des paliers de visibilité et de leur pénalité/portée' },
    vents: { label: 'Forces de vent', hint: 'Libellés des 6 forces de vent, du calme plat à la violente tempête' },
    roseDesVents: { label: 'Rose des vents', hint: 'Tirage d10 de la direction du vent (« dominant » = vents dominants du plan d’eau)' },
    effetDuVent: { label: 'Effet du vent', hint: 'Table croisée force×aspect (% voiles/autre, encalminage, affalage, virement)' },
    effetDuVentClinfoc: { label: 'Effet du vent (clinfoc)', hint: 'Même table, variante clinfoc' },
    effetDuVentGreementDelta: { label: 'Delta gréement de course', hint: 'Delta de % voiles ajouté au tableau standard, par aspect de vent' },
    affaler: { label: 'Affaler les voiles', hint: 'Difficulté, localisation d’échec critique et dérive induite' },
    encalmine: { label: 'Encalminé', hint: 'Distances et DR de remorquage en absence de vent' },
  },
  { codex: { keys: ['seaWeather'] }, edit: { object: 'single' } },
);

export const schema = doc.schema;
export const meta = doc.meta;
export const exposition = doc.exposition;
export type SeaWeatherData = EnveloppeDocument & z.infer<z.ZodObject<typeof champs>>;
