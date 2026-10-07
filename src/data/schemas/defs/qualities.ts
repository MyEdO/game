import { nommerChamps } from '../grammaire/meta';
/** LDB 62-63 ; AA ; MDG */
import { z } from 'zod';
import { document } from '../grammaire/document';
import { gameOpSchema, triggeredEffectSchema } from '../grammaire/mecanique';

export const file = 'qualities.json';
export const famille = 'entite';

/** `QualityCapabilities` (`src/data/index.ts`) — clés OBSERVÉES dans `qualities.json` (52
 *  entrées) sauf `slowStrike`/`layerable`/`apIgnoredOnImpaleCrit` (présents dans l'interface, absents
 *  des 52 entrées actuelles — conservés car le TYPE source fait foi, pas l'échantillon courant). */
const qualityCapabilities = nommerChamps(z.strictObject({
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
}), {
  fastStrike: { label: 'Frappe rapide' },
  slowStrike: { label: 'Frappe lente' },
  fumbleOn9: { label: 'Maladresse sur un 9' },
  fumbleDigits: { label: 'Chiffres de maladresse' },
  pushback: { label: 'Repousse' },
  bladeTrap: { label: 'Piège-lame' },
  damagesArmour: { label: 'Dommages à l’armure' },
  firearm: { label: 'Arme à feu' },
  canFireWhileEngaged: { label: 'Tir au contact' },
  magazine: { label: 'Chargeur' },
  salvo: { label: 'Salve' },
  areaFire: { label: 'Tir de zone' },
  explosion: { label: 'Explosion' },
  crewedTeam: { label: 'Équipe de servants' },
  parryAP: { label: 'Armure de parade' },
  encDelta: { label: 'Variation d’Encombrement' },
  layerable: { label: 'Superposable' },
  critImmuneOdd: { label: 'Immunité aux critiques impairs' },
  apIgnoredOnEven: { label: 'Armure ignorée sur un résultat pair' },
  apIgnoredOnImpaleCrit: { label: 'Armure ignorée sur un critique d’empalement' },
  siege: { label: 'Siège' },
  ram: { label: 'Éperonnage' },
  unbreakable: { label: 'Incassable' },
  magic: { label: 'Magique' },
  withheldOnRestraint: { label: 'Neutralisé pendant la retenue' },
  beats: { label: 'Qualités supplantées' },
});

const doc = document(
  'qualities',
  famille,
  {
    /** LDB 60 l.9/l.40 ; LDB 62 l.217/l.309 ; LDB 63 l.68/l.80 */
    polarite: z.enum(['atout', 'defaut']),
    /** `subType` observé : 'arme' | 'armure' | 'objet' (59/59) ; `QualityData.subType` autorise aussi
     *  `null` (TS `string | null`), non vu dans les 59 entrées actuelles mais le type source fait foi. */
    subType: z.enum(['arme', 'armure', 'objet']).nullable(),
    effects: z.array(triggeredEffectSchema).optional(),
    passive: z.array(gameOpSchema).optional(),
    capabilities: qualityCapabilities.optional(),
    /** LDB 60 l.28 ; AA 08 l.87 ; LDB 62 l.66 */
    indice: nommerChamps(z.strictObject({ label: z.string(), unite: z.string().optional() }), { label: { label: 'Libellé' }, unite: { label: 'Unité' } }).optional(),
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
