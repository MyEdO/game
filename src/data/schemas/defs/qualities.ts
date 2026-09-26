/**
 * Schéma de `qualities.json` — Atouts/Défauts d'arme/armure/objet (LDB 62-63), `QualityData`
 * (`src/data/index.ts`). `capabilities` = `QualityCapabilities` (drapeaux IRRÉDUCTIBLES,
 * `src/data/index.ts`) ; `effects`/`passive` = MÊME vocabulaire `TriggeredEffect`/`GameOp` que
 * les Traits et les sorts, PROMU dans `grammaire/mecanique.ts` (`conditionSchema`/`flowSchema`/`triggeredEffectSchema`
 * — partagés avec `maneuvers.ts`).
 *
 * `alsoIn` (clé d'ENVELOPPE) porte les emplacements SECONDAIRES (#563) — ex. `tir-de-zone` AA folio 89
 * ET MDG folio 102 (réimprime AA verbatim).
 */
import { z } from 'zod';
import { document } from '../grammaire/document';
import { gameOpSchema, triggeredEffectSchema } from '../grammaire/mecanique';

export const file = 'qualities.json';
export const famille = 'entite';

/** `QualityCapabilities` (`src/data/index.ts`) — clés OBSERVÉES dans `qualities.json` (52
 *  entrées) sauf `slowStrike`/`layerable`/`apIgnoredOnImpaleCrit` (présents dans l'interface, absents
 *  des 52 entrées actuelles — conservés car le TYPE source fait foi, pas l'échantillon courant). */
const qualityCapabilities = z.strictObject({
  fastStrike: z.boolean().optional(),
  slowStrike: z.boolean().optional(),
  fumbleOn9: z.boolean().optional(),
  fumbleDigits: z.array(z.number()).optional(),
  pushback: z.boolean().optional(),
  bladeTrap: z.boolean().optional(),
  damagesArmour: z.boolean().optional(),
  firearm: z.boolean().optional(),
  canFireWhileEngaged: z.boolean().optional(),
  magazine: z.boolean().optional(),
  salvo: z.boolean().optional(),
  areaFire: z.boolean().optional(),
  explosion: z.boolean().optional(),
  crewedTeam: z.boolean().optional(),
  parryAP: z.boolean().optional(),
  encDelta: z.number().optional(),
  layerable: z.boolean().optional(),
  critImmuneOdd: z.boolean().optional(),
  apIgnoredOnEven: z.boolean().optional(),
  apIgnoredOnImpaleCrit: z.boolean().optional(),
  siege: z.boolean().optional(),
  ram: z.boolean().optional(),
  unbreakable: z.boolean().optional(),
  magic: z.boolean().optional(),
  withheldOnRestraint: z.boolean().optional(),
  beats: z.array(z.string()).optional(),
});

const doc = document(
  'qualities',
  famille,
  {
    /** POLARITÉ de la Qualité — Atout (bénéfique) / Défaut (handicap). Trois PAIRES de rubriques selon
     *  le sous-type : objet `LDB 60 l.9`/`l.40`, arme `LDB 62 l.217`/`l.309`, armure `LDB 63 l.68`/`l.80`.
     *  Observée sur 59/59 entrées : 40 `atout`, 19 `defaut`. Lue par `isAtoutQuality` — cible des champs
     *  d'op `augmentWeapon.removeType`/`Weapon.removedTypes`, dont le NOM est persisté en donnée
     *  (1 porteur mesuré, `spells.json`) : leur rename appartient au lot des ops, #1468 (L1c). */
    polarite: z.enum(['atout', 'defaut']),
    /** `subType` observé : 'arme' | 'armure' | 'objet' (59/59) ; `QualityData.subType` autorise aussi
     *  `null` (TS `string | null`), non vu dans les 59 entrées actuelles mais le type source fait foi. */
    subType: z.enum(['arme', 'armure', 'objet']).nullable(),
    effects: z.array(triggeredEffectSchema).optional(),
    passive: z.array(gameOpSchema).optional(),
    capabilities: qualityCapabilities.optional(),
    /** Cette qualité est INDICÉE (LDB 60 l.28) — forme de `TraitData.indice`/`traits.ts`, plus l'UNITÉ
     *  que le livre imprime avec la valeur quand il y en a une (`AA 08 l.87` « Taillade (XA) », l.136
     *  « Taillade (1A) » ; `LDB 62 l.66` « Recharge 1 » n'en a aucune). Lue par `qualityRefLabel`. */
    indice: z.strictObject({ label: z.string(), unite: z.string().optional() }).optional(),
  },
  {
    polarite: { label: 'Polarité', hint: 'Atout ou Défaut' },
    subType: { label: 'Sous-type', hint: 'Arme, armure ou objet' },
    effects: { label: 'Effets déclenchés' },
    passive: { label: 'Effets passifs' },
    capabilities: { label: 'Capacités mécaniques (liste fermée)' },
    indice: {
      label: 'Qualité indicée',
      hint: 'Descripteur : la Qualité est notée (valeur sur l’instance), avec son libellé affiché',
    },
  },
  {
    codex: { keys: ['qualities'] },
    edit: { dataset: 'qualities' },
  },
  { exiges: ['desc', 'source'] },
);

export const schema = doc.schema;
export const meta = doc.meta;

export const exposition = doc.exposition;
