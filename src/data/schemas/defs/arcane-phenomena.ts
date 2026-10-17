import { nommerChamps, metaDesChamps } from '../grammaire/meta';
/** VDM 14. */
import { z } from 'zod';
import { document } from '../grammaire/document';
import { deDeTableSchema, difficultySchema, enumNomme, plageSchema, sourceRefSchema, castingNumberModSchema } from '../grammaire/valeurs';

export const file = 'arcane-phenomena.json';
export const famille = 'config';

/** VDM 14. */
export const phenomenonTestSchema = enumNomme({
  incantation: 'Incantation',
  focalisation: 'Focalisation',
  dissipation: 'Dissipation',
});


const scope = nommerChamps(z.strictObject({
  /** Ids de `domains.json`. */
  domains: z.array(z.string()).min(1).optional(),

  domainsExcept: z.array(z.string()).min(1).optional(),
  /** Magie du Chaos — résolue sur `Combatant.chaosDomain` (même seam que la Condition
   *  `casterChaosDomain`, `src/engine/flowCore.ts`). */
  chaosMagic: z.boolean().optional(),

  dominantWinds: z.boolean().optional(),

  nonDominantWinds: z.boolean().optional(),
}), {
  domains: { label: 'domaines' },
  domainsExcept: { label: 'domaines exclus' },
  chaosMagic: { label: 'magie du Chaos' },
  dominantWinds: { label: 'Vents dominants' },
  nonDominantWinds: { label: 'Vents non dominants' },
});

const testMod = nommerChamps(z.strictObject({
  tests: z.array(phenomenonTestSchema).min(1),
  /** Delta de DR appliqué au Test (borne BASSE quand `drMax` est présent). */
  dr: z.number(),

  drMax: z.number().optional(),

  drDie: nommerChamps(z.strictObject({ faces: z.number(), divide: z.number(), perRound: z.boolean().optional() }), {
    faces: { label: 'faces du dé' },
    divide: { label: 'diviser' },
    perRound: { label: 'par Round' },
  }).optional(),
  scope: scope.optional(),
  /** VDM 14. */
  windRestricted: z.boolean().optional(),
  /** Valeur maison ÉDITABLE portant sa justification, quand le RAW ne chiffre qu'une fourchette sans
   *  cas général (CLAUDE.md règle 7 ; #831). Comptée comme citation par `citationCoverage.mjs`. */
  maison: z.string().optional(),
  source: sourceRefSchema,
  /** Passage RAW VERBATIM qui porte le modificateur (règle stricte 5). */
  desc: z.string(),
}), {
  tests: { label: 'Tests' },
  dr: { label: 'DR' },
  drMax: { label: 'DR maximal' },
  drDie: { label: 'dé de DR' },
  scope: { label: 'portée' },
  windRestricted: { label: 'Vent restreint' },
  maison: { label: 'arbitrage maison' },
  source: { label: 'source' },
  desc: { label: 'texte' },
});


const saturationEffect = nommerChamps(z.strictObject({

  levelsPerYear: z.number().optional(),

  levelsPerMonth: z.number().optional(),

  levels: z.number().optional(),

  viaGrandVortex: z.boolean().optional(),

  blocksPropagation: z.boolean().optional(),

  preventsJonctionSaturee: z.boolean().optional(),

  whenOffLine: z.boolean().optional(),
  source: sourceRefSchema,
  desc: z.string(),
}), {
  levelsPerYear: { label: 'niveaux par an' },
  levelsPerMonth: { label: 'niveaux par mois' },
  levels: { label: 'niveaux' },
  viaGrandVortex: { label: 'par le Grand Vortex' },
  blocksPropagation: { label: 'propagation bloquée' },
  preventsJonctionSaturee: { label: 'jonction saturée empêchée' },
  whenOffLine: { label: 'hors de la ligne' },
  source: { label: 'source' },
  desc: { label: 'texte' },
});


export const saturationTierSchema = enumNomme({
  premier: 'Premier signe',
  courant: 'Signe courant',
  extreme: 'Signe extrême',
});

/** VDM 14. */
export const phenomenonKindSchema = enumNomme({
  'ligne-de-force': 'Ligne de force',
  'pierre-gardienne': 'Pierre gardienne',
  vortex: 'Vortex',
  nexus: 'Jonction tellurique',
  'appui-arcanique': 'Appui arcanique',
  tempete: 'Tempête de magie',
  corruption: 'Corruption',
  site: 'Site',
});

const attestedNote = nommerChamps(z.strictObject({ source: sourceRefSchema, desc: z.string() }), { source: { label: 'source' }, desc: { label: 'texte' } });

const doc = document(
  'arcane-phenomena',
  famille,
  {
  saturationLevels: z.array(
    nommerChamps(z.strictObject({
      id: z.string(),
      label: z.string(),
      /** Rang du palier (1 = Basse … 5 = Corrompue) — l'ORDRE est une donnée, pas l'index du tableau. */
      order: z.number(),

      effectsMin: z.number(),
      effectsMax: z.number(),

      corrupts: z.boolean().optional(),
      testMods: z.array(testMod).optional(),
      source: sourceRefSchema,
      desc: z.string(),
    }), {
      id: { label: 'identifiant' },
      label: { label: 'libellé' },
      order: { label: 'ordre' },
      effectsMin: { label: 'nombre minimal d’effets' },
      effectsMax: { label: 'nombre maximal d’effets' },
      corrupts: { label: 'corruption' },
      testMods: { label: 'modificateurs de Test' },
      source: { label: 'source' },
      desc: { label: 'texte' },
    }),
  ),
  windSaturationEffects: z.array(
    nommerChamps(z.strictObject({
      id: z.string(),
      /** Id de `domains.json` du Domaine porté par le Vent. */
      domainId: z.string(),
      /** Nom du Vent tel qu'imprimé (`DomainData.wind`). */
      wind: z.string(),

      environments: z.array(z.string()).min(1),

      effects: z.array(nommerChamps(z.strictObject({ label: z.string(), tier: saturationTierSchema }), { label: { label: 'libellé' }, tier: { label: 'niveau' } })).min(1),
      /** Surnoms populaires de la condition météorologique. */
      surnoms: z.array(z.string()).min(1),
      source: sourceRefSchema,
    }), {
      id: { label: 'identifiant' },
      domainId: { label: 'domaine' },
      wind: { label: 'Vent' },
      environments: { label: 'environnements' },
      effects: { label: 'effets' },
      surnoms: { label: 'surnoms' },
      source: { label: 'source' },
    }),
  ),
  phenomena: z.array(
    nommerChamps(z.strictObject({
      id: z.string(),
      label: z.string(),

      kind: phenomenonKindSchema,
      testMods: z.array(testMod).optional(),
      /** VDM 14 l.353. */
      niMods: z.array(castingNumberModSchema).optional(),
      saturation: saturationEffect.optional(),
      /** LDB 19 l.25-31. */
      influenceMalveillante: z.boolean().optional(),

      critOnTens: z.boolean().optional(),

      daemonsDoubled: z.boolean().optional(),

      singleWind: z.boolean().optional(),

      cancelsTraitId: z.string().optional(),

      refractedWindsOnly: attestedNote.optional(),

      stonePropertySlots: nommerChamps(z.strictObject({ max: z.number(), source: sourceRefSchema, desc: z.string() }), {
        max: { label: 'maximum' },
        source: { label: 'source' },
        desc: { label: 'texte' },
      }).optional(),

      fluxTableId: z.string().optional(),

      controlFlux: nommerChamps(z.strictObject({ difficulty: difficultySchema, source: sourceRefSchema, desc: z.string() }), {
        difficulty: { label: 'difficulté' },
        source: { label: 'source' },
        desc: { label: 'texte' },
      }).optional(),

      overcastPerSpell: nommerChamps(z.strictObject({ dice: z.string(), source: sourceRefSchema, desc: z.string() }), {
        dice: { label: 'dés' },
        source: { label: 'source' },
        desc: { label: 'texte' },
      }).optional(),

      tableId: z.string().optional(),
      draws: z.number().optional(),
      source: sourceRefSchema,
      desc: z.string(),
    }), {
      id: { label: 'identifiant' },
      label: { label: 'libellé' },
      kind: { label: 'type' },
      testMods: { label: 'modificateurs de Test' },
      niMods: { label: 'modificateurs du NI' },
      saturation: { label: 'saturation' },
      influenceMalveillante: { label: 'influence malveillante' },
      critOnTens: { label: 'critiques sur les dizaines' },
      daemonsDoubled: { label: 'démons doublés' },
      singleWind: { label: 'Vent unique' },
      cancelsTraitId: { label: 'Trait annulé' },
      refractedWindsOnly: { label: 'Vents réfractés uniquement' },
      stonePropertySlots: { label: 'emplacements de propriétés de pierre' },
      fluxTableId: { label: 'table de flux' },
      controlFlux: { label: 'contrôle du flux' },
      overcastPerSpell: { label: 'surincantation par sort' },
      tableId: { label: 'table' },
      draws: { label: 'tirages' },
      source: { label: 'source' },
      desc: { label: 'texte' },
    }),
  ),
  tables: z.array(
    nommerChamps(z.strictObject({
      id: z.string(),
      label: z.string(),
      die: deDeTableSchema,
      rows: z.array(
        nommerChamps(z.strictObject({
          ...plageSchema.shape,
          label: z.string(),

          domainIds: z.array(z.string()).min(1).optional(),

          chaosMagic: z.boolean().optional(),

          maison: z.string().optional(),
        }), {
          ...metaDesChamps(plageSchema, { exigees: true }),
          label: { label: 'libellé' },
          domainIds: { label: 'domaines' },
          chaosMagic: { label: 'magie du Chaos' },
          maison: { label: 'arbitrage maison' },
        }),
      ).min(1),
      source: sourceRefSchema,
      desc: z.string(),
    }), {
      id: { label: 'identifiant' },
      label: { label: 'libellé' },
      die: { label: 'dé de tirage' },
      rows: { label: 'rangées' },
      source: { label: 'source' },
      desc: { label: 'texte' },
    }),
  ),
  },
  {
    saturationLevels: {
      label: 'Paliers de Saturation',
      hint: "Les cinq paliers de Saturation environnementale, leurs modificateurs de Test et leur nombre d'Effets",
    },
    windSaturationEffects: {
      label: 'Effets de Saturation par Vent',
      hint: 'Rangée du tableau des Effets de Saturation propre à chaque Vent de Magie',
    },
    phenomena: { label: 'Phénomènes arcaniques', hint: 'Un phénomène nommé, ses modificateurs de Test et son action sur la Saturation' },
    tables: { label: 'Tables tirées', hint: 'Les tables d10/d100 du chapitre, consultées par identifiant' },
  },
  { codex: { keys: ['arcanePhenomena'] }, edit: { object: 'single' } },
);

export const schema = doc.schema;
export const meta = doc.meta;

export const exposition = doc.exposition;
