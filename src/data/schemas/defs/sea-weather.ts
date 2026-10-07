import { nommerChamps, metaDesChamps } from '../grammaire/meta';
/** MDG 13 l.162-306 */
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
/** MDG 13 l.267-270 */
export const windAspectSchema = enumNomme({ arriere: 'vent arrière', lateral: 'vent latéral', face: 'vent de face' });
const windEffectCell = nommerChamps(z.strictObject({
  pctSail: z.number().optional(),
  pctOther: z.number().optional(),
  encalmine: z.boolean().optional(),
  affaler: z.boolean().optional(),
  virement: z.boolean().optional(),
}), {
  pctSail: { label: 'Vitesse à la voile (%)' },
  pctOther: { label: 'Autres vitesses (%)' },
  encalmine: { label: 'Encalminé' },
  affaler: { label: 'Amener les voiles' },
  virement: { label: 'Virement' },
});
const windEffectTable = z.record(windForce, z.record(windAspectSchema, windEffectCell));

const champs = {
  table: z.array(
    nommerChamps(z.strictObject({
      ...plageSchema.shape,
      precipitations: z.enum(['aucune', 'legeres', 'abondantes', 'tres-abondantes']),
      temperature: z.enum(['caniculaire', 'chaude', 'mediane', 'froide', 'glaciale']),
      visibilite: z.enum(['degage', 'brume', 'brouillard', 'puree-de-pois']),
      vent: windForce,
      source: sourceRefSchema,
    }), {
      ...metaDesChamps(plageSchema, { exigees: true }),
      precipitations: { label: 'Précipitations' },
      temperature: { label: 'Température' },
      visibilite: { label: 'Visibilité' },
      vent: { label: 'Vent' },
      source: { label: 'Source' },
    }),
  ),
  seasonMod: nommerChamps(z.strictObject({
    ete: z.number(),
    automne: z.number(),
    printemps: z.number(),
    hiver: z.number(),
    source: sourceRefSchema,
  }), {
    ete: { label: 'Été' },
    automne: { label: 'Automne' },
    printemps: { label: 'Printemps' },
    hiver: { label: 'Hiver' },
    source: { label: 'Source' },
  }),
  warmSeaMod: z.number(),
  precipitations: z.array(
    nommerChamps(z.strictObject({
      id: z.string(),
      label: z.string(),
      desc: z.string().optional(),
      skillMods: z
        .array(
          nommerChamps(z.strictObject({
            /** MDG 13 l.187-201 */
            skills: z.array(refOuSpec('skill')),
            mod: z.number(),
          }), { skills: { label: 'Compétences' }, mod: { label: 'Modificateur' } }),
        )
        .optional(),
      otherMod: z.number().optional(),
      source: sourceRefSchema,
    }), {
      id: { label: 'Identifiant' },
      label: { label: 'Libellé' },
      desc: { label: 'Description' },
      skillMods: { label: 'Modificateurs de Compétence' },
      otherMod: { label: 'Autre modificateur' },
      source: { label: 'Source' },
    }),
  ),
  temperatures: z.array(
    nommerChamps(z.strictObject({
      id: z.string(),
      label: z.string(),
      testEveryHours: z.number().optional(),
      difficulty: difficultySchema.optional(),
      exposure: z.enum(['chaleur', 'froid']).optional(),
      litresParJour: z.number().optional(),
      source: sourceRefSchema,
    }), {
      id: { label: 'Identifiant' },
      label: { label: 'Libellé' },
      testEveryHours: { label: 'Périodicité du Test (heures)' },
      difficulty: { label: 'Difficulté' },
      exposure: { label: 'Exposition' },
      litresParJour: { label: 'Litres par jour' },
      source: { label: 'Source' },
    }),
  ),
  visibilites: z.array(
    nommerChamps(z.strictObject({
      id: z.string(),
      label: z.string(),
      drPenalty: z.number().optional(),
      beyondM: z.number().optional(),
      source: sourceRefSchema,
    }), {
      id: { label: 'Identifiant' },
      label: { label: 'Libellé' },
      drPenalty: { label: 'Pénalité de DR' },
      beyondM: { label: 'Au-delà de la portée (m)' },
      source: { label: 'Source' },
    }),
  ),
  vents: z.array(nommerChamps(z.strictObject({ id: z.string(), label: z.string(), source: sourceRefSchema }), { id: { label: 'Identifiant' }, label: { label: 'Libellé' }, source: { label: 'Source' } })),
  windTickThreshold: z.number(),
  windTicksPerDay: z.number(),
  roseDesVents: z.array(
    nommerChamps(z.strictObject({
      ...plageSchema.shape,
      direction: z.enum(['dominant', 'nord', 'sud', 'ouest', 'est']),
      source: sourceRefSchema,
    }), { ...metaDesChamps(plageSchema, { exigees: true }), direction: { label: 'Direction' }, source: { label: 'Source' } }),
  ),
  effetDuVent: windEffectTable,
  effetDuVentClinfoc: windEffectTable,
  /** MSRC 12 l.137 */
  effetDuVentGreementDelta: z.record(windAspectSchema, z.number()),
  affaler: nommerChamps(z.strictObject({
    difficulty: difficultySchema,
    failCritLocation: z.string(),
    driftPctOfSpeed: z.number(),
  }), {
    difficulty: { label: 'Difficulté' },
    failCritLocation: { label: 'Localisation du critique à l’échec' },
    driftPctOfSpeed: { label: 'Dérive (% de vitesse)' },
  }),
  encalmine: nommerChamps(z.strictObject({ currentM: z.number(), towM: z.number(), towManDR: z.number() }), {
    currentM: { label: 'Mouvement du courant' },
    towM: { label: 'Mouvement de remorquage' },
    towManDR: { label: 'DR de manœuvre en remorquage' },
  }),
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
    windTickThreshold: {
      label: 'Résultat de bascule du vent',
      hint: 'Résultat exact du d10 qui fait changer la FORCE du vent d’un cran',
    },
    windTicksPerDay: { label: 'Bascules par jour', hint: 'Nombre de tirages de vent par journée en mer' },
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
