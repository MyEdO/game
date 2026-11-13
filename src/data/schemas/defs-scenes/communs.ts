import { nommerChamps, nommerNoeud } from '../grammaire/meta';
/**
 * Vocabulaire FEUILLE partagé par les schémas d'une racine `src/scenes` — les formes que la SCÈNE
 * (`./scene.ts`) et les EFFETS (`./effets.ts`) posent l'une comme l'autre. Un concept = une
 * définition : ce module existe pour qu'aucune des deux ne recopie l'autre (et pour que le cycle
 * `scene ⇄ effets` n'ait pas lieu — la scène porte des Flows, les effets portent des cases).
 */
import { z } from 'zod';
import { talentRefSchema, traitPoseDeSceneSchema } from '../grammaire/reference';
import { refOuSpec, refs, type PorteeLocale } from '../grammaire/ref';
import { DECLARABLE_PAR_UN_PORTEUR } from '../grammaire/sousListes';
import { listeCle } from '../grammaire/collection-cle';
import type { SkillRefDesignee } from '../../index';
import { profilChiffreSchema, sizeCategorySchema } from '../grammaire/valeurs';
import { ID_D_ENTREE } from '../../source/dossier';

/** Les scènes du projet, que désignent un lieu de la carte, son point d'intérêt, l'embuscade d'une route et
 *  l'effet `transition`. */
export const SCENES_DU_PROJET = { collection: 'scenes', catalogue: 'scènes du projet' } as const satisfies PorteeLocale;
/** Les dialogues de la scène, que désignent `entities[].dialogueId` et l'effet `startDialogue`. */
export const DIALOGUES_DE_LA_SCENE = { collection: 'dialogues', catalogue: 'dialogues de la scène' } as const satisfies PorteeLocale;
/** Un personnage, parmi les entités de la scène. */
const PERSONNAGE = { champ: 'kind', vaut: 'personnage' } as const;
/** Les personnages de la scène, que désignent le locuteur de l'effet `startDialogue` et le soigneur de l'effet
 *  `medicalAid`. */
export const PERSONNAGES_DE_LA_SCENE = { collection: 'entities', catalogue: 'personnages de la scène', retient: [PERSONNAGE] } as const satisfies PorteeLocale;
/** Les marchands de la scène, les personnages qui portent `merchant`, que désigne l'effet `openMerchant`. */
export const MARCHANDS_DE_LA_SCENE = { collection: 'entities', catalogue: 'marchands de la scène', retient: [PERSONNAGE, { champ: 'merchant' }] } as const satisfies PorteeLocale;
/** Les rencontres de la scène, que désignent les effets `startCombat` et `startPursuit`. */
export const RENCONTRES_DE_LA_SCENE = { collection: 'encounters', catalogue: 'rencontres de la scène' } as const satisfies PorteeLocale;
/** Les portées locales qu'ouvre la scène (`sceneSchema`). */
export const PORTEES_DE_LA_SCENE: readonly PorteeLocale[] = [DIALOGUES_DE_LA_SCENE, PERSONNAGES_DE_LA_SCENE, MARCHANDS_DE_LA_SCENE, RENCONTRES_DE_LA_SCENE];

/** `Pt` (`noyau/monde/path.ts`) — case, `z` = couche d'empilement (absent = base). */
export const ptSchema = nommerChamps(z.strictObject({ x: z.number(), y: z.number(), z: z.number().optional() }), { x: { label: "abscisse" }, y: { label: "ordonnée" }, z: { label: "étage" } });
/** CANON de l'arête de mur — arête cardinale N/E, diagonales `\` (NO→SE) et `/` (NE→SO). Source
 *  UNIQUE de l'union : `noyau/monde/scene.ts` (`WallSide`) et `engine/types.ts` (`WallEdgeSide`) en
 *  DÉRIVENT, l'éditeur en dérive ses options (`wallSideSchema.options`). Garde : `unions-canon.test.ts`. */
export const wallSideSchema = z.enum(['N', 'E', '\\', '/']);
export type WallSide = z.infer<typeof wallSideSchema>;
/** `SkillRefDesignee` (`src/data/index.ts`) — la réf de la grammaire au régime qui DÉSIGNE (`{ id }` ou
 *  `{ id, spec }`, `refOuSpec`) + la valeur de Test IMPRIMÉE ; le statbloc du bestiaire
 *  (`defs/creatures.ts`) porte, lui, des emplacements (`choix`). */
export const competenceChiffreeSchema: z.ZodType<SkillRefDesignee> = refOuSpec('skill', { value: nommerNoeud(z.number(), { nom: 'valeur' }) });

/** Identifiant GLOBAL d'une entrée de fiche de dossier de chapitre (#2290) : format `ID_D_ENTREE`
 *  (`src/data/source/dossier.ts`). Feuille de `couvre` et de `narratif.ecartes[].entree`. */
export const entreeDeFicheSchema = z.string().regex(ID_D_ENTREE, 'entrée de fiche : « <ABBR>-<NN>#<id> » attendu.');

/** `couvre` (#2290) — les entrées de fiche de dossier de chapitre qu'un élément du paquet de campagne
 *  couvre, sans doublon. Posé par l'éditeur. */
export const couvreSchema = listeCle(entreeDeFicheSchema, { nom: 'entrée de fiche', scalaire: true });

/** `CustomStatblock.spells` — ids de `spells.json` : la porte est la fabrique canonique (`refs('spell')`),
 *  la FORME DE SORTIE est DÉCLARÉE nue (patron `couvertureSchema`, `./scene.ts`) — le type moteur
 *  `CustomStatblock` porte des ids nus (`byId`, `src/data/index.ts`), l'éditeur les saisit au `<select>`. */
const sortsConnusSchema: z.ZodType<string[], string[]> = refs('spell');

/** `CustomStatblock.groups` — ids de `groups.json` qu'un PORTEUR déclare (`DECLARABLE_PAR_UN_PORTEUR`) : même
 *  FORME DE SORTIE nue que `sortsConnusSchema`, le type moteur `CustomStatblock` porte des ids nus. #3045 */
const groupesDuStatblocSchema: z.ZodType<string[], string[]> = refs('groupe', { sousListe: DECLARABLE_PAR_UN_PORTEUR });

/** `CustomStatblock.char` — `Partial<Record<CharKey | 'M' | 'B', number>>`. */
export const charStatsSchema = profilChiffreSchema(z.number());

/**
 * `CustomStatblock` (`engine/statblock.ts`, sa forme de sortie) — profil PNJ/bête custom d'éditeur, DOCUMENT EMBARQUÉ du
 * document de scène : il porte son `type` comme tout document (#1467 L1b) ; les clés de `char` sont FERMÉES sur
 * `charStatKeySchema`.
 */
export const customStatblockSchema = nommerChamps(z.strictObject({
  type: z.literal('statblock'),
  label: z.string(),
  char: charStatsSchema,
  traits: z.array(traitPoseDeSceneSchema).optional(),
  /** LDB 85 ; absente, dérivée du Trait « Taille (X) ». */
  size: sizeCategorySchema.optional(),
  /** LDB 21. */
  groups: groupesDuStatblocSchema.optional(),
  spells: sortsConnusSchema.optional(),
  skills: z.array(competenceChiffreeSchema).optional(),
  talents: z.array(talentRefSchema).optional(),
  /** LDB 77 l.108 (`randomizeChars`). */
  randomChars: z.boolean().optional(),
  /** AA/MDG 12 : un affût servi, sans réaction de combat ni tour propre (`isInanimate`). */
  inert: z.boolean().optional(),
  /** #143 : propagé au spawn (`Combatant.followsCharacterRules`, `engine/relations.ts`). */
  followsCharacterRules: z.boolean().optional(),
}), { type: { label: "type"  }, label: { label: "libellé" , texte: { regime: "designation"} }, char: { label: "caractéristiques" }, traits: { label: "Traits" }, size: { label: "Taille"  }, groups: { label: "groupes" , texte: { regime: "technique"} }, spells: { label: "sorts" , texte: { regime: "technique"} }, skills: { label: "Compétences" }, talents: { label: "Talents" }, randomChars: { label: "caractéristiques aléatoires" }, inert: { label: "inerte" }, followsCharacterRules: { label: "règles de personnage" } });
