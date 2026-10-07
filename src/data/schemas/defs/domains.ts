import { nommerChamps } from '../grammaire/meta';
/** LDB 48. */
import { z } from 'zod';
import { charKeySchema, enumNomme, sourceRefSchema } from '../grammaire/valeurs';
import { document } from '../grammaire/document';
import { flowTestSchema, gameOpSchema, triggeredEffectSchema } from '../grammaire/mecanique';
import { refOuSpec } from '../grammaire/ref';

export const file = 'domains.json';
export const famille = 'entite';

/** LDB 48. */
export const missileBypassSchema = enumNomme({ metal: 'PA métalliques', nonMagic: 'PA non magiques' });

/** VDM 04 ; VDM 11. */
export const domainCircumstanceSchema = enumNomme({
  'feu-proche': 'Proche d’un feu',
  'volcan-actif': 'Volcan actif',
  'ville-en-flammes': 'Ville en flammes',
  charnier: 'Charnier',
  'lieu-de-massacre': 'Lieu de massacre',
  'lieu-sans-mort': 'Lieu sans mort',
  'eau-abondante': 'Eau abondante',
  'milieu-sec': 'Milieu sec',
  'mois-sommerzeit': 'Mois de Sommerzeit',
  'mois-vorgeheim': 'Mois de Vorgeheim',
  'mois-ulriczeit': 'Mois d’Ulriczeit',
  'mois-vorhexen': 'Mois de Vorhexen',
  tour: 'Au sommet d’une tour',
  'colline-elevee': 'Colline élevée',
  'sommet-de-montagne': 'Sommet de montagne',
  'en-vol': 'En vol',
  'voyage-vers-equateur': 'Voyage vers l’équateur',
  'metaux-abondants': 'Métaux abondants',
  'temps-orageux': 'Temps orageux',
  'temps-brumeux': 'Temps brumeux',
  'temps-ensoleille': 'Temps ensoleillé',
  'brise-legere': 'Brise légère',
  ville: 'Ville',
  cite: 'Cité',
  'pleine-nature': 'Pleine nature',
  'region-reculee': 'Région reculée',
  middenheim: 'Middenheim',
  'assistance-chantee': 'Assistance chantée d’un tiers',
});

const doc = document(
  'domains',
  famille,
  {

    wind: z.string().optional(),

    arcane: z.boolean().optional(),
    /** VDM 02 l.192 ; LDB 50. */
    dark: z.boolean().optional(),
    /** VDM 02 l.238. */
    tables: z.record(z.string(), z.string()).optional(),

    effects: z.array(triggeredEffectSchema).optional(),

    missile: nommerChamps(z.strictObject({ bypass: missileBypassSchema, bonusFromBypass: z.boolean().optional() }), { bypass: { label: 'armure ignorée' }, bonusFromBypass: { label: 'bonus tiré de l’armure ignorée' } }).optional(),
    /** Ops appliquées AU LANCEUR après une incantation réussie. */
    casterOps: z.array(gameOpSchema).optional(),

    breathType: z.string().optional(),

    castBonus: nommerChamps(z.strictObject({ perCondition: z.string(), radiusStat: charKeySchema, bonus: z.number() }), {
      perCondition: { label: 'par État' },
      radiusStat: { label: 'caractéristique du rayon' },
      bonus: { label: 'bonus' },
    }).optional(),

    castingChar: charKeySchema.optional(),

    environmentBonus: nommerChamps(z.strictObject({ environments: z.array(z.string()), mod: z.number() }), { environments: { label: 'environnements' }, mod: { label: 'modificateur' } }).optional(),
    /** LDB 49. */
    sorcery: z.boolean().optional(),
    /** MDG 02 l.178-186. */
    seaModifier: nommerChamps(z.strictObject({

      focalisationDR: z.number().optional(),

      focalisationDrDoubled: z.boolean().optional(),

      focusCritMiscastMajeure: z.boolean().optional(),

      incantationStormDR: z.number().optional(),
      incantationCalmDR: z.number().optional(),

      critFumbleOnTens: z.boolean().optional(),
    }), {
      focalisationDR: { label: 'DR de Focalisation' },
      focalisationDrDoubled: { label: 'DR de Focalisation doublés' },
      focusCritMiscastMajeure: { label: 'Incantation imparfaite majeure sur critique de Focalisation' },
      incantationStormDR: { label: 'DR d’Incantation pendant une tempête' },
      incantationCalmDR: { label: 'DR d’Incantation par temps calme' },
      critFumbleOnTens: { label: 'critiques et maladresses sur les dizaines' },
    }).optional(),
    /** VDM 04 l.48-56 ; VDM 05 l.38-44 ; VDM 06 l.34-38 ; VDM 07 l.42-48 ; VDM 08 l.36-40 ; VDM 09 l.38-42 ; VDM 10 l.38-42 ; VDM 11 l.38-44. */
    windModifiers: z.array(nommerChamps(z.strictObject({
      /** Tests portés par le modificateur. */
      tests: z.array(z.enum(['incantation', 'focalisation', 'seconde-vue'])).min(1),
      /** Delta de DR appliqué au Test. */
      dr: z.number(),
      /** Circonstances dont UNE suffit à déclencher le modificateur, signées par l'appelant.
       *  ABSENT = permanent. */
      when: z.array(domainCircumstanceSchema).min(1).optional(),

      cancelledBy: nommerChamps(z.strictObject({
        circumstance: domainCircumstanceSchema,
        requiresSkill: refOuSpec('skill').optional(),
        test: flowTestSchema,
        sustained: z.boolean().optional(),
        source: sourceRefSchema,
        /** Passage RAW VERBATIM qui porte l'annulation (règle stricte 5). */
        desc: z.string(),
      }), {
        circumstance: { label: 'circonstance' },
        requiresSkill: { label: 'Compétence requise' },
        test: { label: 'Test' },
        sustained: { label: 'maintenu' },
        source: { label: 'source' },
        desc: { label: 'texte' },
      }).optional(),
      source: sourceRefSchema,
      /** Passage RAW VERBATIM qui porte le modificateur (règle stricte 5). */
      desc: z.string(),
    }), {
      tests: { label: 'Tests' },
      dr: { label: 'DR' },
      when: { label: 'condition' },
      cancelledBy: { label: 'annulation' },
      source: { label: 'source' },
      desc: { label: 'texte' },
    })).optional(),
  },
  {
    wind: { label: 'Vent de magie', hint: 'Couleur associée (Aqshy, Ghyran…), extraite du texte' },
    arcane: { label: 'Enseignable (Magie des Arcanes)', hint: 'Domaine ouvert via le Talent Magie des Arcanes' },
    dark: { label: 'Domaine sombre', hint: 'Nécromancie/Démonologie' },
    tables: { label: 'Tables associées', hint: 'Tables de tables.json déclarées par le Domaine, par clé de rôle' },
    effects: { label: 'Effets déclenchés', hint: 'Effets à la touche d’un Sort du Domaine' },
    missile: {
      label: 'Projectile magique du Domaine',
      hint: 'Les Sorts à Dégâts du Domaine ignorent les PA d’une matière — et peuvent en tirer un bonus de Dégâts',
    },
    casterOps: { label: 'Effets appliqués au lanceur', hint: 'Ops appliquées au lanceur après une incantation réussie' },
    breathType: { label: 'Type de Souffle', hint: 'Élément conféré par le Talent Magie des Arcanes du Domaine' },
    castBonus: { label: 'Bonus d’incantation conditionnel', hint: 'Bonus lié à un État porté à portée' },
    castingChar: {
      label: 'Caractéristique d’incantation',
      hint: 'Remplace la Caractéristique par défaut des Tests d’Incantation',
    },
    environmentBonus: {
      label: 'Bonus d’environnement',
      hint: 'Bonus d’incantation lié à l’environnement de Scène',
    },
    sorcery: { label: 'Domaine de Sorcellerie' },
    seaModifier: {
      label: 'Modificateurs en mer',
      hint: 'Vents de Magie en mer (Focalisation, Incantation, Critique/Maladresse)',
    },
    windModifiers: { label: 'Modificateurs du Vent', hint: 'Modificateurs de DR propres au Vent, hors mer' },
  },
  {
    codex: { keys: ['domains'] },
    edit: { dataset: 'domains' },
  },
  // `wind`, `arcane` : pools des sources `winds`/`arcaneDomains` (`grammaire/sourcesDeSpecs.ts`).
  { espace: { marqueurs: ['wind', 'arcane'] } },
);

export const schema = doc.schema;
export const meta = doc.meta;

export const exposition = doc.exposition;
