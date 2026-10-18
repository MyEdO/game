import { nommerChamps, metaDesChamps } from '../grammaire/meta';
/** MDG 13 l.39-351 */
import { z } from 'zod';
import { document, type EnveloppeDocument } from '../grammaire/document';
import { difficultySchema, ecartsDeCouverture, plageOuverteSchema, sourceRefSchema } from '../grammaire/valeurs';

export const file = 'sea-navigation.json';
export const famille = 'config';

const tableRange = plageOuverteSchema;

const champs = {
  workPeriodHours: nommerChamps(z.strictObject({ voile: z.number(), avirons: z.number(), source: sourceRefSchema }), { voile: { label: 'Voile' }, avirons: { label: 'Avirons' }, source: { label: 'Source' } }),
  epuisement: nommerChamps(z.strictObject({ difficulty: difficultySchema, forcedDifficulty: difficultySchema, source: sourceRefSchema }), {
    difficulty: { label: 'Difficulté' },
    forcedDifficulty: { label: 'Difficulté au rythme forcé' },
    source: { label: 'Source' },
  }),
  forcerLeRythme: z.array(
    nommerChamps(z.strictObject({
      bonusM: z.number(),
      voile: difficultySchema.optional(),
      avirons: difficultySchema.optional(),
      source: sourceRefSchema,
    }), {
      bonusM: { label: 'Bonus de Mouvement' },
      voile: { label: 'Voile' },
      avirons: { label: 'Avirons' },
      source: { label: 'Source' },
    }),
  ),
  vitesseMax: nommerChamps(z.strictObject({
    safeBonus: z.number(),
    source: sourceRefSchema,
    table: z.array(
      nommerChamps(tableRange.extend({
        difficulty: difficultySchema,
        per: z.enum(['heure', 'minute', 'round']),
        damage: z.number(),
        source: sourceRefSchema,
      }), {
        ...metaDesChamps(tableRange, { exigees: true }),
        difficulty: { label: 'Difficulté' },
        per: { label: 'Périodicité' },
        damage: { label: 'Dégâts' },
        source: { label: 'Source' },
      }),
    ),
  }), { safeBonus: { label: 'Bonus sûr' }, source: { label: 'Source' }, table: { label: 'Table' } }),
  salissures: nommerChamps(z.strictObject({
    weeklyTest: z.boolean(),
    source: sourceRefSchema,
    levels: z.array(
      nommerChamps(z.strictObject({
        level: z.number(),
        manDR: z.number(),
        mMod: z.number(),
        navDR: z.number(),
        repairPctOfBase: z.number(),
        desc: z.string(),
        source: sourceRefSchema,
      }), {
        level: { label: 'Niveau' },
        manDR: { label: 'DR de manœuvre' },
        mMod: { label: 'Modificateur de Mouvement' },
        navDR: { label: 'DR de Navigation' },
        repairPctOfBase: { label: 'Coût de réparation (% du prix de base)' },
        desc: { label: 'Description' },
        source: { label: 'Source' },
      }),
    ),
  }), {
    weeklyTest: { label: 'Test hebdomadaire' },
    source: { label: 'Source' },
    levels: { label: 'Niveaux' },
  }),
  orientation: nommerChamps(z.strictObject({
    testsPerDay: z.number(),
    source: sourceRefSchema,
    reperes: z.array(
      nommerChamps(tableRange.extend({
        outcome: z.enum(['exact', 'ok', 'drift-minor', 'drift', 'drift-major']),
        desc: z.string(),
        source: sourceRefSchema,
      }), {
        ...metaDesChamps(tableRange, { exigees: true }),
        outcome: { label: 'Issue' },
        desc: { label: 'Description' },
        source: { label: 'Source' },
      }),
    ),
    driftMajorBonus: z.number(),
    driftSide: nommerChamps(z.strictObject({ tribordMax: z.number() }), { tribordMax: { label: 'Maximum vers tribord' } }),
    changementDeCap: z.array(
      nommerChamps(tableRange.extend({
        /** ISSUE tirée du Changement de cap — même graphie que `reperes.outcome` ci-dessus, qui est
         *  déjà la forme du dépôt pour une issue de table. */
        outcome: z.enum(['aucun', 'retard', 'quart-de-tour', 'demi-tour']),
        delayPct: z.number().optional(),
        desc: z.string(),
        source: sourceRefSchema,
      }), {
        ...metaDesChamps(tableRange, { exigees: true }),
        outcome: { label: 'Issue' },
        delayPct: { label: 'Retard (%)' },
        desc: { label: 'Description' },
        source: { label: 'Source' },
      }),
    ),
  }), {
    testsPerDay: { label: 'Tests par jour' },
    source: { label: 'Source' },
    reperes: { label: 'Repères' },
    driftMajorBonus: { label: 'Bonus de dérive majeure' },
    driftSide: { label: 'Côté de dérive' },
    changementDeCap: { label: 'Changement de cap' },
  }),
  phares: nommerChamps(z.strictObject({
    voirLaLumiere: z.array(nommerChamps(tableRange.extend({ difficulty: difficultySchema, source: sourceRefSchema }), { ...metaDesChamps(tableRange, { exigees: true }), difficulty: { label: 'Difficulté' }, source: { label: 'Source' } })),
    perilSpotBonus: z.number(),
    source: sourceRefSchema,
    clocher: nommerChamps(z.strictObject({ orientationDR: z.number(), distanceDiviseur: z.number(), source: sourceRefSchema }), {
      orientationDR: { label: 'DR d’orientation' },
      distanceDiviseur: { label: 'Diviseur de distance' },
      source: { label: 'Source' },
    }),
  }), {
    voirLaLumiere: { label: 'Voir la lumière' },
    perilSpotBonus: { label: 'Bonus de détection des périls' },
    source: { label: 'Source' },
    clocher: { label: 'Clocher' },
  }),
  longsVoyages: nommerChamps(z.strictObject({
    millesParJourParM: z.number(),
    sansVoguerDeNuitDiviseur: z.number(),
    progressionPctParDR: z.number(),
    source: sourceRefSchema,
  }), {
    millesParJourParM: { label: 'Milles par jour et par point de Mouvement' },
    sansVoguerDeNuitDiviseur: { label: 'Diviseur sans navigation de nuit' },
    progressionPctParDR: { label: 'Progression par DR (%)' },
    source: { label: 'Source' },
  }),
  poursuite: nommerChamps(z.strictObject({
    distanceUnitM: z.number(),
    source: sourceRefSchema,
    escapeDistances: z.array(
      nommerChamps(z.strictObject({ id: z.string(), label: z.string(), distance: z.number(), source: sourceRefSchema }), {
        id: { label: 'Identifiant' },
        label: { label: 'Libellé' },
        distance: { label: 'Distance' },
        source: { label: 'Source' },
      }),
    ),
    drDeltas: z.array(nommerChamps(tableRange.extend({ delta: z.number(), source: sourceRefSchema }), { ...metaDesChamps(tableRange, { exigees: true }), delta: { label: 'Variation' }, source: { label: 'Source' } })),
    lowMPenalty: z.array(nommerChamps(z.strictObject({ m: z.number(), dr: z.number(), source: sourceRefSchema }), { m: { label: 'Mouvement' }, dr: { label: 'Degrés de Réussite' }, source: { label: 'Source' } })),
  }), {
    distanceUnitM: { label: 'Unité de distance (m)' },
    source: { label: 'Source' },
    escapeDistances: { label: 'Distances d’échappement' },
    drDeltas: { label: 'Variations de DR' },
    lowMPenalty: { label: 'Pénalité de faible Mouvement' },
  }),
  reparation: nommerChamps(z.strictObject({
    portCostGoldPerWound: z.number(),
    /** Expression de dés texte (ex. « 1d10 ») — lue par `rollExpr`/`rollDice`. */
    testHours: z.string(),
    woundsPerTest: z.string(),
    charpentierPenalty: z.number(),
    lissageRepairSurcoutPct: z.number(),
    source: sourceRefSchema,
    temporaire: nommerChamps(z.strictObject({
      difficultyMin: difficultySchema,
      difficultyMax: difficultySchema,
      hoursPerRepair: z.number(),
      woundsPerRepair: z.string(),
      failDamage: z.string(),
    }), {
      difficultyMin: { label: 'Difficulté minimale' },
      difficultyMax: { label: 'Difficulté maximale' },
      hoursPerRepair: { label: 'Heures par réparation' },
      woundsPerRepair: { label: 'Blessures par réparation' },
      failDamage: { label: 'Dégâts à l’échec' },
    }),
    entretienCrewTestDR: z.number(),
  }), {
    portCostGoldPerWound: { label: 'Coût au port par Blessure (co)' },
    testHours: { label: 'Durée du Test (heures)' },
    woundsPerTest: { label: 'Blessures par Test' },
    charpentierPenalty: { label: 'Pénalité de Charpentier' },
    lissageRepairSurcoutPct: { label: 'Surcoût de lissage (%)' },
    source: { label: 'Source' },
    temporaire: { label: 'Temporaire' },
    entretienCrewTestDR: { label: 'DR du Test d’entretien de l’équipage' },
  }),
};

const doc = document(
  'sea-navigation',
  famille,
  champs,
  {
    workPeriodHours: { label: 'Période de travail', hint: "Durée d'un quart de voile/d'avirons avant relève" },
    epuisement: { label: 'Épuisement', hint: "Difficulté du Test d'Épuisement de l'équipage, normal et forcé" },
    forcerLeRythme: { label: 'Forcer le rythme', hint: 'Difficulté du Test de Voile / de Rame à payer pour gagner ce bonus de Mouvement' },
    vitesseMax: {
      label: 'Vitesse maximum',
      hint: 'Seuil de vitesse sûre et, au-delà, table par BONUS DE VITESSE (M − M de conception) : Difficulté, périodicité, Dégâts',
    },
    salissures: { label: 'Salissures de coque', hint: 'Paliers d’encrassement — pénalités de manœuvre/Navigation et coût de nettoyage' },
    orientation: { label: 'Orientation', hint: 'Repères de route et Changement de cap : issues par fourchette de DR' },
    phares: { label: 'Phares et clochers', hint: 'Portée de détection des phares, orientation par clocher' },
    longsVoyages: { label: 'Longs voyages', hint: 'Milles par jour et par point de Mouvement, progression par DR' },
    poursuite: { label: 'Course-poursuite', hint: "Distances d'échappement, delta de DR, pénalité à faible Mouvement" },
    reparation: { label: 'Réparations au port', hint: 'Coût, durée et rendement des réparations de coque, dont la réparation temporaire' },
  },
  { codex: { keys: ['seaNavigation'] }, edit: { object: 'single' } },
  {
    // MDG 13 l.125, l.140 (vitesseMax) ; l.316, l.320 (reperes) ; l.320, l.326 (changementDeCap) ;
    // l.380, l.394 (drDeltas) ; l.343, l.345 (phares.voirLaLumiere) ; patron `structure-criticals.ts`.
    affinerDataset: (dataset) =>
      dataset.superRefine((v, ctx) => {
        type Bande = { min?: number | null; max?: number | null };
        const d = v as Partial<SeaNavigationData>;
        const tables: [string[], Bande[], number | 'ouverte', number | 'ouverte'][] = [
          [['vitesseMax', 'table'], d.vitesseMax?.table ?? [], (d.vitesseMax?.safeBonus ?? 0) + 1, 'ouverte'],
          [['orientation', 'reperes'], d.orientation?.reperes ?? [], 'ouverte', 'ouverte'],
          [['orientation', 'changementDeCap'], d.orientation?.changementDeCap ?? [], 1, 10 + (d.orientation?.driftMajorBonus ?? 0)],
          [['poursuite', 'drDeltas'], d.poursuite?.drDeltas ?? [], 'ouverte', 'ouverte'],
          [['phares', 'voirLaLumiere'], d.phares?.voirLaLumiere ?? [], 'ouverte', 15],
        ];
        for (const [path, bandes, depuis, jusqua] of tables) {
          const ecarts = ecartsDeCouverture(bandes, depuis, jusqua, (b) => `la rangée n° ${bandes.indexOf(b) + 1}`);
          if (ecarts.length) {
            ctx.addIssue({
              code: 'custom',
              path,
              message: `sea-navigation.json › ${path.join('.')} : les bandes ne couvrent pas leur domaine d'un seul tenant — ${ecarts.join(' ; ')}.`,
            });
          }
        }
      }),
  },
);

export const schema = doc.schema;
export const meta = doc.meta;
export const exposition = doc.exposition;
export type SeaNavigationData = EnveloppeDocument & z.infer<z.ZodObject<typeof champs>>;
