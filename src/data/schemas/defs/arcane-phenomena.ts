/**
 * Schéma de `arcane-phenomena.json` — MAGIE ENVIRONNEMENTALE des *Vents de Magie* (`VDM 14`,
 * folios 189-207) : Saturation environnementale (5 niveaux + effets par Vent), Corruption
 * environnementale, Tempêtes de Magie, lignes de force, pierres gardiennes, Grand Vortex, nexus de
 * puissance et appuis arcaniques.
 *
 * Quatre rubriques, toutes en DONNÉE éditable (aucun phénomène nommé dans le moteur) :
 *  - `saturationLevels` : les cinq paliers, leurs modificateurs de Test et leur compte d'Effets ;
 *  - `windSaturationEffects` : la rangée du tableau des Effets de Saturation propre à chaque Vent ;
 *  - `phenomena` : un phénomène = un `label`, ses `testMods` et son action sur la Saturation ;
 *  - `tables` : les trois tables tirées du chapitre (`findTableEntry`, `src/engine/tables.ts`).
 *
 * Lecteur UNIQUE : `src/engine/magicEnvironment.ts` (`environmentTestDR`), gaté par la règle
 * optionnelle `magic-vdm-environnementale` (`src/engine/policy.ts`, groupe Magie).
 */
import { z } from 'zod';
import { document } from '../grammaire/document';
import { deDeTableSchema, difficultySchema, enumNomme, plageSchema, sourceRefSchema, castingNumberModSchema } from '../grammaire/valeurs';

export const file = 'arcane-phenomena.json';
export const famille = 'config';

/** Tests portés par un modificateur de phénomène — surensemble de `WindTest` (`domainAttributes.ts`) :
 *  l'Atténuation module AUSSI les Tests de Dissipation (`VDM 14`, folio 194). */
export const phenomenonTestSchema = enumNomme({
  incantation: 'Incantation',
  focalisation: 'Focalisation',
  dissipation: 'Dissipation',
});

/** À QUELS Sorts s'applique le modificateur. Absent = tous les Domaines.
 *  `dominantWinds`/`nonDominantWinds` sont relatifs à la ZONE (le ou les Vents prépondérants) : ils
 *  se résolvent sur les Vents déclarés par l'instance de phénomène, jamais sur une constante. */
const scope = z.strictObject({
  /** Ids de `domains.json`. */
  domains: z.array(z.string()).min(1).optional(),
  /** Ids de `domains.json` EXCLUS (le modificateur porte sur tous les autres Domaines). */
  domainsExcept: z.array(z.string()).min(1).optional(),
  /** Magie du Chaos — résolue sur `Combatant.chaosDomain` (même seam que la Condition
   *  `casterChaosDomain`, `src/engine/flowCore.ts`). */
  chaosMagic: z.boolean().optional(),
  /** Vent(s) prépondérant(s) de la zone saturée. */
  dominantWinds: z.boolean().optional(),
  /** Tous les Vents SAUF les prépondérants. */
  nonDominantWinds: z.boolean().optional(),
});

const testMod = z.strictObject({
  tests: z.array(phenomenonTestSchema).min(1),
  /** Delta de DR appliqué au Test (borne BASSE quand `drMax` est présent). */
  dr: z.number(),
  /** Borne HAUTE d'une fourchette laissée aux circonstances par le RAW. */
  drMax: z.number().optional(),
  /** Loi du tirage quand le RAW fait varier le delta à chaque Round (Faille du Warp / Portail
   *  magique : `1d10/2`, arrondi au supérieur). Le tirage appartient au SITE, qui pose sa valeur dans
   *  `ArcaneOccurrence.dr` ; à défaut le moteur applique la borne BASSE `dr`, comme toute fourchette. */
  drDie: z.strictObject({ faces: z.number(), divide: z.number(), perRound: z.boolean().optional() }).optional(),
  scope: scope.optional(),
  /** Le modificateur se RESTREINT aux Vents que le site déclare réfracter (`ArcaneOccurrence.winds`)
   *  — `VDM 14` l.161. Sans ce drapeau, les Vents du site ne touchent pas le modificateur : ils
   *  n'élargissent JAMAIS une portée. */
  windRestricted: z.boolean().optional(),
  /** Valeur maison ÉDITABLE portant sa justification, quand le RAW ne chiffre qu'une fourchette sans
   *  cas général (CLAUDE.md règle 7 ; #831). Comptée comme citation par `citationCoverage.mjs`. */
  maison: z.string().optional(),
  source: sourceRefSchema,
  /** Passage RAW VERBATIM qui porte le modificateur (règle stricte 5). */
  desc: z.string(),
});

/** Action du phénomène sur la Saturation environnementale de sa région. */
const saturationEffect = z.strictObject({
  /** Niveaux gagnés (ou perdus, si négatif) par an. */
  levelsPerYear: z.number().optional(),
  /** Niveaux gagnés par mois. */
  levelsPerMonth: z.number().optional(),
  /** Niveaux gagnés INSTANTANÉMENT (Tempête de Magie). */
  levels: z.number().optional(),
  /** La Saturation est régie par le Grand Vortex (ligne de force artificielle). */
  viaGrandVortex: z.boolean().optional(),
  /** Ni la Saturation ni la Corruption ne franchissent le phénomène (Isolation). */
  blocksPropagation: z.boolean().optional(),
  /** Empêche les Jonctions telluriques d'être saturées (Atténuation). */
  preventsJonctionSaturee: z.boolean().optional(),
  /** L'effet ne vaut que si la pierre n'est PAS sur une ligne de force opérationnelle (Amplification). */
  whenOffLine: z.boolean().optional(),
  source: sourceRefSchema,
  desc: z.string(),
});

/** Palier d'apparition d'un Effet de Saturation dans le tableau par Vent (italique = premier signe,
 *  gras = Saturation Extrême). */
export const saturationTierSchema = enumNomme({
  premier: 'Premier signe',
  courant: 'Signe courant',
  extreme: 'Signe extrême',
});

/** Nature d'un phénomène arcanique — vocabulaire du chapitre (`VDM 14`), jamais une paraphrase. */
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

const attestedNote = z.strictObject({ source: sourceRefSchema, desc: z.string() });

const doc = document(
  'arcane-phenomena',
  famille,
  {
  saturationLevels: z.array(
    z.strictObject({
      id: z.string(),
      label: z.string(),
      /** Rang du palier (1 = Basse … 5 = Corrompue) — l'ORDRE est une donnée, pas l'index du tableau. */
      order: z.number(),
      /** Nombre d'Effets de Saturation manifestés par le palier. */
      effectsMin: z.number(),
      effectsMax: z.number(),
      /** Palier Corrompu : la zone tire sur une table de Corruption environnementale. */
      corrupts: z.boolean().optional(),
      testMods: z.array(testMod).optional(),
      source: sourceRefSchema,
      desc: z.string(),
    }),
  ),
  windSaturationEffects: z.array(
    z.strictObject({
      id: z.string(),
      /** Id de `domains.json` du Domaine porté par le Vent. */
      domainId: z.string(),
      /** Nom du Vent tel qu'imprimé (`DomainData.wind`). */
      wind: z.string(),
      /** Environnements sensibles où ce Vent prédomine. */
      environments: z.array(z.string()).min(1),
      /** Effets de Saturation : `premier` = apparaît en premier (italique du tableau),
       *  `extreme` = Saturation Extrême seulement (gras du tableau). */
      effects: z.array(z.strictObject({ label: z.string(), tier: saturationTierSchema })).min(1),
      /** Surnoms populaires de la condition météorologique. */
      surnoms: z.array(z.string()).min(1),
      source: sourceRefSchema,
    }),
  ),
  phenomena: z.array(
    z.strictObject({
      id: z.string(),
      label: z.string(),
      /** `site` = lieu NOMMÉ du chapitre dont le RAW chiffre l'effet magique (folios 200-207). */
      kind: phenomenonKindSchema,
      testMods: z.array(testMod).optional(),
      /** Modificateurs de NIVEAU D'INCANTATION du lieu (`VDM 14 l.353`, l.437, l.489). */
      niMods: z.array(castingNumberModSchema).optional(),
      saturation: saturationEffect.optional(),
      /** Le phénomène est une Influence corruptrice (LDB 19 l.25-31). */
      influenceMalveillante: z.boolean().optional(),
      /** Incantation Critique élargie aux réussites finissant par 0 (Jonction saturée). */
      critOnTens: z.boolean().optional(),
      /** Le nombre de démons invoqués par Sorts et rituels est doublé (Faille du Warp). */
      daemonsDoubled: z.boolean().optional(),
      /** Le phénomène ne diffuse qu'une seule couleur de magie (Portail magique). */
      singleWind: z.boolean().optional(),
      /** Trait de créature ANNULÉ dans la zone (`traits.json`) — Réserve de *Dhar* / Instable. */
      cancelsTraitId: z.string().optional(),
      /** Le bonus ne vaut que pour les Vents effectivement réfractés par la pierre. */
      refractedWindsOnly: attestedNote.optional(),
      /** Nombre de propriétés de pierre gardienne qu'une pierre d'ogham peut recevoir. */
      stonePropertySlots: z.strictObject({ max: z.number(), source: sourceRefSchema, desc: z.string() }).optional(),
      /** Table de Flux magique tirée à chaque Round (`tables[].id`). */
      fluxTableId: z.string().optional(),
      /** Un sorcier maître d'un appui arcanique peut CHOISIR le Flux magique de la région. */
      controlFlux: z.strictObject({ difficulty: difficultySchema, source: sourceRefSchema, desc: z.string() }).optional(),
      /** Surincantation subie par Sort lancé pendant le phénomène. */
      overcastPerSpell: z.strictObject({ dice: z.string(), source: sourceRefSchema, desc: z.string() }).optional(),
      /** Table de Corruption environnementale (`tables[].id`) et nombre de tirages. */
      tableId: z.string().optional(),
      draws: z.number().optional(),
      source: sourceRefSchema,
      desc: z.string(),
    }),
  ),
  tables: z.array(
    z.strictObject({
      id: z.string(),
      label: z.string(),
      die: deDeTableSchema,
      rows: z.array(
        z.strictObject({
          ...plageSchema.shape,
          label: z.string(),
          /** Flux magique : Domaine(s) désigné(s) par la rangée. */
          domainIds: z.array(z.string()).min(1).optional(),
          /** Flux magique : la rangée désigne AUSSI la Magie du Chaos (sans Domaine dédié). */
          chaosMagic: z.boolean().optional(),
          /** Rangée RECONSTRUITE : la cellule imprimée ne porte rien (débordement de la rangée
           *  voisine à l'impression). Le texte dit ce qui est LU au Source et ce qui est DÉDUIT —
           *  sans lui, une valeur déduite serait indiscernable d'une valeur lue. */
          maison: z.string().optional(),
        }),
      ).min(1),
      source: sourceRefSchema,
      desc: z.string(),
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
