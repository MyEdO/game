import { nommerChamps } from '../grammaire/meta';
/** LDB 62-63 ; AA ; MDG */
import { z } from 'zod';
import { document } from '../grammaire/document';
import { passifsDe, triggeredEffectSchema } from '../grammaire/mecanique';
import { refs } from '../grammaire/ref';

export const file = 'qualities.json';
export const famille = 'entite';

/** Drapeaux et marqueurs de CAPACITÉ IRRÉDUCTIBLES d'une qualité d'arme, d'armure ou d'objet (`QualityCapabilities`,
 *  `src/data/index.ts`) : règles que le moteur INTERROGE par id (`engine/qualities/dispatch`), ni un modificateur
 *  (`passive`) ni un effet déclenché (`effects`). Un Indice (Salve N, Protectrice N…) est porté par l'instance
 *  (`QualityInstance.value`) : la capacité n'est qu'un marqueur de PRÉSENCE. LDB 62-63 */
export const qualityCapabilitiesSchema = nommerChamps(z.strictObject({
  /** Rapide : pré-emption d'initiative, −10 à la parade adverse non Rapide. */
  fastStrike: z.boolean().optional(),
  /** Lente : frappe en dernier. */
  slowStrike: z.boolean().optional(),
  /** Dangereuse : Maladresse sur tout Test raté incluant un 9. */
  fumbleOn9: z.boolean().optional(),
  /** Chiffres de Maladresse (dizaines OU unités). AA 08 l.544 */
  fumbleDigits: z.array(z.number()).optional(),
  /** Perturbante : repousse au lieu de blesser. */
  pushback: z.boolean().optional(),
  /** Piège-lame : piéger ou briser une lame sur un Critique défensif. */
  piegeALame: z.boolean().optional(),
  /** Taille : endommage l'armure ou le bouclier frappé. */
  damagesArmour: z.boolean().optional(),
  /** Poudre noire / Explosion : Incident de Tir et terreur (Nerveux). */
  firearm: z.boolean().optional(),
  /** Pistolet : tir au contact. */
  canFireWhileEngaged: z.boolean().optional(),
  /** À Répétition : chargeur (Indice). */
  magazine: z.boolean().optional(),
  /** Salve : chargeur (Indice), pénalité de chaque tir suivant du Round. */
  salvo: z.number().optional(),
  /** Tir de zone : nuage de projectiles (Indice). */
  areaFire: z.boolean().optional(),
  /** À Explosion : la zone d'Indice mètres autour du point visé. LDB 62 l.254 */
  explosion: z.boolean().optional(),
  /** Arme d'équipe : sous-effectif (Indice), pénalité par Défaut redoublé. */
  crewedTeam: z.number().optional(),
  /** Protectrice : Indice PA en opposant. */
  parryAP: z.boolean().optional(),
  /** Léger −1 / Volumineux +1 Encombrement. LDB 60 */
  encDelta: z.number().optional(),
  /** Flexible : superposition sous une couche non Flexible. LDB 63 */
  layerable: z.boolean().optional(),
  /** Partielle : PA ignorés sur jet pair ou Critique. */
  apIgnoredOnEven: z.boolean().optional(),
  /** Points faibles : PA ignorés sur Critique Empaleuse. */
  apIgnoredOnImpaleCrit: z.boolean().optional(),
  /** Siège : double les Dégâts aux structures, outrepasse Résistant/Impénétrable. ADE II 8 */
  siege: z.boolean().optional(),
  /** Bélier : la pièce n'endommage QUE les portes, lu par `engine/structures`. ADE II 8 l.249 */
  ram: z.boolean().optional(),
  /** Incassable : insensible aux dégâts et à la destruction. */
  unbreakable: z.boolean().optional(),
  /** Magique : attaques magiques (blesse l'Éthéré). */
  magic: z.boolean().optional(),
  /** Retirée quand on Retient ses coups. AA 07 l.61 */
  withheldOnRestraint: z.boolean().optional(),
  /** Préséance : cette qualité l'emporte sur les `beats` présentes (Imprécise > Précise, Lente > Rapide). */
  beats: refs('quality').optional(),
}), {
  fastStrike: { label: 'Frappe rapide' },
  slowStrike: { label: 'Frappe lente' },
  fumbleOn9: { label: 'Maladresse sur un 9' },
  fumbleDigits: { label: 'Chiffres de maladresse' },
  pushback: { label: 'Repousse' },
  piegeALame: { label: 'Piège-lame' },
  damagesArmour: { label: 'Dommages à l’armure' },
  firearm: { label: 'Arme à feu' },
  canFireWhileEngaged: { label: 'Tir au contact' },
  magazine: { label: 'Chargeur' },
  salvo: { label: 'Salve', hint: 'Pénalité de chaque tir suivant du Round' },
  areaFire: { label: 'Tir de zone' },
  explosion: { label: 'Explosion' },
  crewedTeam: { label: 'Équipe de servants', hint: 'Pénalité par Défaut redoublé du sous-effectif' },
  parryAP: { label: 'Armure de parade' },
  encDelta: { label: 'Variation d’Encombrement' },
  layerable: { label: 'Superposable' },
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
    /** Id de `qualitySubtypes.json` ; `null` = aucun sous-type. */
    subType: z.enum(['arme', 'armure', 'objet']).nullable(),
    effects: z.array(triggeredEffectSchema).optional(),
    passive: passifsDe().optional(),
    capabilities: qualityCapabilitiesSchema.optional(),
    /** LDB 60 l.28 ; AA 08 l.87 ; LDB 62 l.66 */
    indice: nommerChamps(z.strictObject({ label: z.string(), unite: z.string().optional() }), { label: { label: 'Libellé' }, unite: { label: 'Unité' } }).optional(),
    /** LDB 60 l.24 ; LDB 60 l.52 — marqueur de la sous-liste lue par `defs/apparences.ts`. */
    aspect: z.literal(true).optional(),
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
    aspect: { label: 'Qualité d’aspect', hint: 'La Qualité se voit sur l’objet : une apparence peut naître d’elle' },
  },
  {
    codex: { keys: ['qualities'] },
    edit: { dataset: 'qualities' },
  },
  { exiges: ['desc', 'source'], espace: { marqueurs: ['aspect'] } },
);

export const schema = doc.schema;
export const meta = doc.meta;

export const exposition = doc.exposition;
