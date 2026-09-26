/**
 * Schéma de `traits.json` — Traits de créature (LDB 85 + suppléments/frenchy.bzh), miroir de
 * `TraitData` (`src/data/index.ts`) + `TraitCapabilities` (`src/data/index.ts`).
 * `desc`/`source`/`alsoIn`/`maison` sont des clés d'ENVELOPPE, posées par la fabrique.
 */
import { z } from 'zod';
import { entityAppearanceSchema, charKeySchema, mutationKindSchema, specsSourceSchema } from '../grammaire/valeurs';
import { refSchema } from '../grammaire/reference';
import { document } from '../grammaire/document';
import { gameOpSchema, mecaniqueDe, triggeredEffectSchema } from '../grammaire/mecanique';

export const file = 'traits.json';
export const famille = 'entite';

/** `TraitCapabilities` (`src/data/index.ts`) — clés OBSERVÉES dans `traits.json` (31/54 déclarées
 *  sur l'interface ; les autres appartiennent aux capabilities de qualités/symptômes ou sont réservées
 *  au bestiaire lu ailleurs). Schéma reflète l'INTERFACE complète (toutes optionnelles), pas seulement
 *  le sous-ensemble vu aujourd'hui — une future entrée peut légitimement en ajouter. */
const traitCapabilitiesSchema = z.strictObject({
  bonusWoundsBE: z.boolean().optional(),
  mutationAtSpawn: mutationKindSchema.optional(),
  markMutations: z.strictObject({
    countDie: z.number(),
    countDivide: z.number(),
    first: mutationKindSchema,
    mentalTable: z.string(),
    physTable: z.string(),
  }).optional(),
  swarm: z.boolean().optional(),
  naturalWeapon: z.strictObject({ ranged: z.boolean().optional() }).optional(),
  spellcaster: z.boolean().optional(),
  undead: z.boolean().optional(),
  wardSave: z.boolean().optional(),
  damageImmunity: z.boolean().optional(),
  spellDomainImmunity: z.string().optional(),
  counterOnDefenseWin: z.boolean().optional(),
  counterRequiresFastParry: z.boolean().optional(),
  unstable: z.boolean().optional(),
  painless: z.boolean().optional(),
  psychImmuneIfAhead: z.boolean().optional(),
  psychType: z.enum(['peur', 'terreur', 'animosite', 'haine', 'prejuge', 'amour', 'camaraderie', 'phobie']).optional(),
  psychImmune: z.boolean().optional(),
  psychIndice: z.number().optional(),
  psychCible: z.string().optional(),
  grantGroups: z.array(z.string()).optional(),
  frenzyCapable: z.boolean().optional(),
  mindless: z.boolean().optional(),
  woundsUseForce: z.boolean().optional(),
  freeTrample: z.boolean().optional(),
  bestial: z.boolean().optional(),
  coldBlooded: z.boolean().optional(),
  stupid: z.boolean().optional(),
  rage: z.boolean().optional(),
  territorial: z.boolean().optional(),
  skittishMount: z.boolean().optional(),
  structResistant: z.boolean().optional(),
  structImpenetrable: z.boolean().optional(),
  fly: z.boolean().optional(),
  leap: z.boolean().optional(),
  stride: z.boolean().optional(),
  autoClimb: z.boolean().optional(),
  climbFullSpeed: z.boolean().optional(),
  noRun: z.boolean().optional(),
  seesInDark: z.boolean().optional(),
  darkSightTiles: z.number().optional(),
  wakelessBite: z.boolean().optional(),
  /** ADE II 2 l.708 : « un ogre peut porter deux fois l'Encombrement normal d'un humain ». */
  encumbranceFactor: z.number().optional(),
  /** ADE II 2 l.708 : « les ogres doivent manger et boire au moins deux fois plus qu'un humain ». */
  consumptionFactor: z.number().optional(),
});

/**
 * Champs qu'une variante réglée de `traits.json` peut republier — ceux dont la lecture PASSE par
 * `effectiveEntry` : `desc`/`source` → Codex `src/ui/compendium/registry.ts`. `capabilities`,
 * `passive`, `effects` et `aura` en sont ABSENTS : le moteur les lit sur l'entrée BRUTE
 * (`src/engine/traits/dispatch.ts,231,273`, `src/engine/items.ts`).
 */
export const VARIANT_RESOLVED_FIELDS = ['desc', 'source'] as const;

const doc = document(
  'traits',
  famille,
  {
    indice: z.strictObject({ label: z.string() }).optional(),
    range: z.boolean().optional(),
    specsSource: specsSourceSchema.optional(),
    specsOpen: z.boolean().optional(),
    specsMulti: z.boolean().optional(),
    /** Trait EXCLU d'un octroi en masse de Traits de créature — `LDB 48 l.23` : « Gagnez tous les Traits
     *  standards de la créature sauf Bestial. » Lu par `polymorphOps` (engine/polymorph). */
    nonTransferable: z.boolean().optional(),
    effects: z.array(triggeredEffectSchema).optional(),
    grantsManeuvers: z.array(refSchema).optional(),
    /** Désignateur : `careerTalentAdditions` (`engine/talentEffects.ts`), déplié à l'avancement (`state/advancement.ts`). */
    passive: z.array(mecaniqueDe({ 'grantCareerTalent.talent': 'specOuChoixFacultatifs' }).gameOp).optional(),
    appearance: entityAppearanceSchema.optional(),
    capabilities: traitCapabilitiesSchema.optional(),
    suppressesCapabilities: z.array(z.string()).optional(),
    aura: z
      .strictObject({
        rangeChar: charKeySchema.optional(),
        rangeMeters: z.number().optional(),
        affects: z.enum(['enemies', 'allies', 'all']).optional(),
        /** Ids de `groups.json` : filtre d'APPARTENANCE de la cible, en plus du camp — l'aura ne touche
         *  qu'un combattant d'AU MOINS un de ces Groupes (union `groupMatch`). Une règle CONJONCTIVE
         *  (« X qui sont aussi Y ») n'est PAS exprimable ici : elle se scinde en entrées.
         *  BORNE MESURÉE sur les auras de Dhar, dont le texte vise « les sorciers et démons » d'un dieu et
         *  que l'union rend par le seul Groupe du dieu. Sur-inclusion : un cultiste slaaneshi qui possède
         *  la Compétence reçoit le +1 DR à Langue (Magick) sans être ni sorcier ni démon. Sous-inclusion :
         *  aucun sorcier NON démon ne peut porter le Groupe d'un dieu tant que `marque-de-slaanesh`/
         *  `marque-de-nurgle` n'existent pas en donnée (seuls le folder du bestiaire et `grantGroups` le
         *  dérivent). La conjonction se posera quand un statbloc l'exigera. */
        affectsGroups: z.array(z.string()).optional(),
        /** L'ÉMETTEUR est lui-même touché par son aura (frenchy-bzh 295 l.233 / 313 l.341) — absent =
         *  l'émetteur n'est jamais touché (Perturbant, LDB 85 l.260-262). */
        includesSelf: z.boolean().optional(),
        passive: z.array(gameOpSchema),
      })
      .optional(),
    standard: z.boolean().optional(),
  },
  {
    indice: {
      label: 'Trait indicé',
      hint: 'Descripteur : le Trait est noté (valeur sur l’instance), avec le libellé affiché (Indice/Degré…)',
    },
    range: {
      label: 'Porte une portée',
      hint: 'Le Trait prend une portée chiffrée EN PLUS de son argument, affichée « (Portée) » (À distance, Langue préhensile)',
    },
    specsSource: {
      label: 'Registre de spécialisations',
      hint: 'Catalogue partagé (armes, Vents, Domaines, Cultes…) d’où proviennent les spécialisations',
    },
    specsOpen: {
      label: 'Spécialisation ouverte',
      hint: 'La liste de spécialisations accepte de nouvelles entrées à l’authoring (fermé sinon)',
    },
    specsMulti: { label: 'Argument multiple', hint: 'L’argument du Trait peut combiner plusieurs spécialisations' },
    nonTransferable: { label: 'Non transférable', hint: 'Exclu d’un octroi en masse de Traits de créature' },
    effects: { label: 'Effets déclenchés' },
    grantsManeuvers: { label: 'Manœuvres accordées' },
    passive: { label: 'Effets passifs' },
    appearance: { label: 'Apparence' },
    capabilities: {
      label: 'Capacités mécaniques (liste fermée)',
      hint: 'Sac de flags fermé (vol, immunités, résistances structurelles…)',
    },
    suppressesCapabilities: { label: 'Capacités supprimées' },
    aura: { label: 'Aura', hint: 'Effet passif diffusé à portée aux alliés/ennemis/tous' },
    standard: { label: 'Trait standard' },
  },
  {
    codex: { keys: ['traits', 'psychologie'] },
    edit: { dataset: 'traits' },
  },
  { exiges: ['desc', 'source'], variantes: VARIANT_RESOLVED_FIELDS },
);

export const schema = doc.schema;
export const meta = doc.meta;
export const exposition = doc.exposition;
/** Clés top-level de l'entrée (enveloppe + champs), relevées AVANT le sceau — le nœud rendu par la
 *  fabrique n'a plus de `.shape`. Consommée par `src/data/variants-integrity.test.ts`. */
export const cles = doc.cles;
