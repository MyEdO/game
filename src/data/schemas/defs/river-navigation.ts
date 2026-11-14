import { nommerChamps, metaDesChamps } from '../grammaire/meta';
/** MSRC 7 */
import { z } from 'zod';
import { document, tableTiree } from '../grammaire/document';
import { difficultySchema, plageSchema, sourceRefSchema, tirageSchema } from '../grammaire/valeurs';

export const file = 'river-navigation.json';
export const famille = 'config';

const riverWindDirId = z.enum(['arriere', 'cote', 'contraire']);

/** `BandRow` (`src/engine/riverNavigation.ts`) — rangée d'une table de tirage par fourchette. */
const bandRow = nommerChamps(z.strictObject({ ...plageSchema.shape, id: z.string(), label: z.string() }), { ...metaDesChamps(plageSchema, { exigees: true }), id: { label: 'Identifiant' }, label: { label: 'Libellé' } });

/** `RiverWindEffect` (`src/engine/riverNavigation.ts`). */
const riverWindEffect = nommerChamps(z.strictObject({
  pourcentage: z.number().optional(),
  derive: z.boolean().optional(),
  louvoyage: z.boolean().optional(),
  risqueDeChavirage: z.boolean().optional(),
  risqueDeGreement: z.boolean().optional(),
}), {
  pourcentage: { label: 'Pourcentage' },
  derive: { label: 'Dérive' },
  louvoyage: { label: 'Louvoyage' },
  risqueDeChavirage: { label: 'Risque de chavirage' },
  risqueDeGreement: { label: 'Risque pour le gréement' },
});

const champs = {
  /** MSRC 7 l.27 */
  windForces: tableTiree(nommerChamps(bandRow.extend({ source: sourceRefSchema }), { ...metaDesChamps(bandRow, { exigees: true }), source: { label: 'Source' } })),
  /** MSRC 7 l.25 */
  windDirections: tableTiree(nommerChamps(bandRow.extend({ source: sourceRefSchema }), { ...metaDesChamps(bandRow, { exigees: true }), source: { label: 'Source' } })),
  windTickThreshold: z.number(),
  windTicksPerDay: z.number(),
  windEffect: z.record(z.string(), z.record(riverWindDirId, riverWindEffect)),
  driftPctOfSpeed: z.number(),
  driftNavPenalty: z.number(),
  navBaseDifficulty: difficultySchema,
  tackDifficulty: difficultySchema,
  savoirVoiesFluvialesDR: z.number(),
  capsize: nommerChamps(z.strictObject({
    removeSailDifficulty: difficultySchema,
    rightDifficulty: difficultySchema,
    rightCumulativePenalty: z.number(),
    source: sourceRefSchema,
  }), {
    removeSailDifficulty: { label: 'Difficulté pour amener la voile' },
    rightDifficulty: { label: 'Difficulté de redressement' },
    rightCumulativePenalty: { label: 'Pénalité cumulative de redressement' },
    source: { label: 'Source' },
  }),
  horsDeControle: nommerChamps(z.strictObject({ navPenalty: z.number(), source: sourceRefSchema }), { navPenalty: { label: 'Pénalité de Navigation' }, source: { label: 'Source' } }),
  echouage: nommerChamps(z.strictObject({ hullDamage: z.number(), source: sourceRefSchema }), { hullDamage: { label: 'Dégâts de coque' }, source: { label: 'Source' } }),
  temporaryRepair: nommerChamps(z.strictObject({
    woundsPerRepair: tirageSchema,
    enduranceDifficulty: difficultySchema,
    failDamage: tirageSchema,
    source: sourceRefSchema,
  }), {
    woundsPerRepair: { label: 'Blessures par réparation' },
    enduranceDifficulty: { label: 'Difficulté du Test d’Endurance' },
    failDamage: { label: 'Dégâts à l’échec' },
    source: { label: 'Source' },
  }),
};

const doc = document(
  'river-navigation',
  famille,
  champs,
  {
    windForces: { label: 'Forces de vent', hint: 'Table de tirage des forces de vent fluviales' },
    windDirections: { label: 'Vent relatif', hint: 'Table de tirage du vent relatif au bateau' },
    windTickThreshold: {
      label: 'Résultat de bascule du vent',
      hint: 'Résultat exact du d10 qui fait changer la FORCE du vent d’un cran (la direction n’est tirée qu’au départ)',
    },
    windTicksPerDay: { label: 'Bascules par jour', hint: 'Nombre de tirages de vent par journée de navigation' },
    windEffect: { label: 'Effet du vent', hint: '% de vitesse, dérive, virement, risque de chavirage/gréement par force×direction' },
    driftPctOfSpeed: { label: '% de dérive', hint: 'Part de la vitesse perdue en dérive' },
    driftNavPenalty: { label: 'Malus de dérive', hint: 'Pénalité au Test de Navigation en dérive' },
    navBaseDifficulty: { label: 'Difficulté de base', hint: 'Difficulté de base du Test de Navigation fluviale' },
    tackDifficulty: { label: 'Difficulté du louvoyage', hint: 'Difficulté du Test pour louvoyer contre le vent' },
    savoirVoiesFluvialesDR: { label: 'DR Savoir (Voies fluviales)', hint: 'Bonus de DR apporté par cette spécialisation' },
    capsize: { label: 'Chavirage', hint: 'Difficultés d’amener la voile et de redresser, pénalité cumulative' },
    horsDeControle: { label: 'Hors de contrôle', hint: 'Malus au Test de Navigation quand le bateau est hors de contrôle' },
    echouage: { label: 'Échouage', hint: 'Dégâts de coque infligés par un échouage' },
    temporaryRepair: { label: 'Réparation temporaire', hint: 'Blessures réparées par Test, Test d’Endurance de suivi' },
  },
  { codex: { keys: ['riverNavigation'] }, edit: { object: 'unique' } },
);

export const schema = doc.schema;
export const meta = doc.meta;
export const exposition = doc.exposition;
