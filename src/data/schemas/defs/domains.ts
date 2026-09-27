/**
 * Schéma de `domains.json` — dérivé du contenu RÉEL (19 entrées, script d'inventaire) et de
 * `DomainData` (`src/data/index.ts`). Domaine de magie (Couleur, LDB 48) : attributs éditables
 * au Codex (riders `effects`, mitigation `missile`, `casterOps` post-incantation…).
 *
 * `effects` porte des `TriggeredEffect<EffectOp>` (`src/engine/flowCore.ts`) — Condition/Flow
 * PROMUS dans `grammaire/mecanique.ts` (`conditionSchema`/`flowSchema`/`triggeredEffectSchema`, partagés ici
 * et dans maneuvers/qualities/talents/etats/spells/traits/trappings/psychology).
 * `desc`/`source`/`alsoIn` sont des clés d'ENVELOPPE, posées par la fabrique.
 */
import { z } from 'zod';
import { charKeySchema, enumNomme, sourceRefSchema } from '../grammaire/valeurs';
import { document } from '../grammaire/document';
import { flowTestSchema, gameOpSchema, triggeredEffectSchema } from '../grammaire/mecanique';
import { refOuSpec } from '../grammaire/ref';

export const file = 'domains.json';
export const famille = 'entite';

/** Matière de PA ignorée par les Sorts du Domaine (LDB 48). */
export const missileBypassSchema = enumNomme({ metal: 'PA métalliques', nonMagic: 'PA non magiques' });

/**
 * CIRCONSTANCES d'un modificateur de Vent (`VDM 04`–`VDM 11`) — vocabulaire FERMÉ de situations que
 * l'appelant signale (`DomainWindCtx.circumstances`, `src/engine/domainAttributes.ts`), jamais des ids
 * d'entités : météo, saison, relief, lieu, densité de bâti. UNE déclaration pour les DEUX nœuds qui le
 * portent (`windModifiers[].when`, `windModifiers[].cancelledBy.circumstance`).
 */
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
    /** Vent de Magie (Couleur), EXTRAIT du `desc` (« Domaine du Feu (Aqshy) »). Absent pour les
     *  Domaines dérivés (Sorcellerie/Nécromancie/Démonologie/Magie naturelle…). */
    wind: z.string().optional(),
    /** Domaine ENSEIGNABLE via le Talent Magie des Arcanes — source du pool `arcaneDomains`. */
    arcane: z.boolean().optional(),
    /** `VDM 02 l.192` (`careerSlots.arcaneDomainGate`) — Nécromancie, Démonologie (LDB 50). */
    dark: z.boolean().optional(),
    /** Tables de `tables.json` déclarées par le Domaine, par CLÉ de rôle (`arcaneMark` = Marques
     *  Arcaniques du Vent, `VDM 02 l.238`) — lues par l'op `rollDomainTable`. */
    tables: z.record(z.string(), z.string()).optional(),
    /** Effets DÉCLENCHÉS « à la touche » sur une cible d'un Sort du Domaine — 5/19 entrées. */
    effects: z.array(triggeredEffectSchema).optional(),
    /** Mitigation des Projectiles (ignore les PA d'une matière). */
    missile: z.strictObject({ bypass: missileBypassSchema, bonusFromBypass: z.boolean().optional() }).optional(),
    /** Ops appliquées AU LANCEUR après une incantation réussie. */
    casterOps: z.array(gameOpSchema).optional(),
    /** Élément du Souffle conféré par le Talent Magie des Arcanes du Domaine. */
    breathType: z.string().optional(),
    /** Bonus d'incantation CONDITIONNEL par État porté à portée. */
    castBonus: z.strictObject({ perCondition: z.string(), radiusStat: charKeySchema, bonus: z.number() }).optional(),
    /** Caractéristique des Tests d'Incantation, à la place de la carac par défaut. */
    castingChar: charKeySchema.optional(),
    /** Bonus d'incantation lié à l'ENVIRONNEMENT de Scène. */
    environmentBonus: z.strictObject({ environments: z.array(z.string()), mod: z.number() }).optional(),
    /** Domaine de la SORCELLERIE (LDB 49) : marqueur DONNÉE. */
    sorcery: z.boolean().optional(),
    /** Modificateur des Vents de Magie EN MER (MDG 02 l.178-186). */
    seaModifier: z.strictObject({
      /** Feu (Aqshy, l.182) : DR de Focalisation en mer. */
      focalisationDR: z.number().optional(),
      /** Vie (Ghyran, l.186) : le DR de Focalisation en mer est DOUBLÉ. */
      focalisationDrDoubled: z.boolean().optional(),
      /** Vie (Ghyran, l.186) : Focalisation Critique en mer → Imparfaite MAJEURE (au lieu de Mineure). */
      focusCritMiscastMajeure: z.boolean().optional(),
      /** Cieux (Azyr, l.184) : DR d'Incantation en mer pendant une Violente tempête / en Calme plat. */
      incantationStormDR: z.number().optional(),
      incantationCalmDR: z.number().optional(),
      /** Bête (Ghur, l.180) : Critique/Maladresse déclenchés aussi sur un résultat finissant par 0. */
      critFumbleOnTens: z.boolean().optional(),
    }).optional(),
    /**
     * Modificateurs de DR PROPRES au Vent du Domaine, hors mer (`seaModifier`) — chaque Vent des
     * Vents de Magie en porte une rubrique : `VDM 04 l.48-56` (Hysh), `VDM 05 l.38-44` (Chamon),
     * `VDM 06 l.34-38` (Ghyran), `VDM 07 l.42-48` (Azyr), `VDM 08 l.36-40` (Ulgu),
     * `VDM 09 l.38-42` (Shyish), `VDM 10 l.38-42` (Aqshy), `VDM 11 l.38-44` (Ghur).
     * Forme commune des huit : une LISTE de (Tests visés, delta de DR, circonstance déclenchante).
     */
    windModifiers: z.array(z.strictObject({
      /** Tests portés par le modificateur. */
      tests: z.array(z.enum(['incantation', 'focalisation', 'seconde-vue'])).min(1),
      /** Delta de DR appliqué au Test. */
      dr: z.number(),
      /** Circonstances dont UNE suffit à déclencher le modificateur, signées par l'appelant.
       *  ABSENT = permanent. */
      when: z.array(domainCircumstanceSchema).min(1).optional(),
      /** Annulation par un TIERS (Hysh) : l'appelant signale `circumstance` quand un assistant
       *  possédant `requiresSkill` a réussi `test` et maintient son chant (`sustained`). */
      cancelledBy: z.strictObject({
        circumstance: domainCircumstanceSchema,
        requiresSkill: refOuSpec('skill').optional(),
        test: flowTestSchema,
        sustained: z.boolean().optional(),
        source: sourceRefSchema,
        /** Passage RAW VERBATIM qui porte l'annulation (règle stricte 5). */
        desc: z.string(),
      }).optional(),
      source: sourceRefSchema,
      /** Passage RAW VERBATIM qui porte le modificateur (règle stricte 5). */
      desc: z.string(),
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
