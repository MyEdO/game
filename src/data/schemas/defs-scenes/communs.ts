import { nommerChamps, nommerNoeud, libelleDeValeur } from '../grammaire/meta';
/**
 * Vocabulaire FEUILLE partagé par les schémas d'une racine `src/scenes` — les formes que la SCÈNE
 * (`./scene.ts`) et les EFFETS (`./effets.ts`) posent l'une comme l'autre. Un concept = une
 * définition : ce module existe pour qu'aucune des deux ne recopie l'autre (et pour que le cycle
 * `scene ⇄ effets` n'ait pas lieu — la scène porte des Flows, les effets portent des cases).
 */
import { tableTotale } from '../../../lib/tableTotale';
import { z } from 'zod';
import { talentRefSchema, traitInstanceSchema } from '../grammaire/reference';
import { refOuSpec, refs } from '../grammaire/ref';
import { listeCle } from '../grammaire/collection-cle';
import type { SkillRef } from '../../index';
import { charStatKeySchema, sizeCategorySchema } from '../grammaire/valeurs';
import { ID_D_ENTREE } from '../../source/dossier';

/** `Pt` (`state/path.ts`) — case, `z` = couche d'empilement (absent = base). */
export const ptSchema = nommerChamps(z.strictObject({ x: z.number(), y: z.number(), z: z.number().optional() }), { x: { label: "abscisse" }, y: { label: "ordonnée" }, z: { label: "étage" } });
/** CANON de l'arête de mur — arête cardinale N/E, diagonales `\` (NO→SE) et `/` (NE→SO). Source
 *  UNIQUE de l'union : `state/scene.ts` (`WallSide`) et `engine/types.ts` (`WallEdgeSide`) en
 *  DÉRIVENT, l'éditeur en dérive ses options (`wallSideSchema.options`). Garde : `unions-canon.test.ts`. */
export const wallSideSchema = z.enum(['N', 'E', '\\', '/']);
export type WallSide = z.infer<typeof wallSideSchema>;
/** `SkillRef` (`src/data/index.ts`) — MÊME nœud que le statbloc du bestiaire (`defs/creatures.ts`) :
 *  la réf de la grammaire (`spec` XOR `choix`) + la valeur de Test IMPRIMÉE. La FORME de sortie est
 *  ANNOTÉE (patron `AxesData`, `defs/axes.ts`) : `refOuSpec` déclare `RefASpecialisation` et n'y porte
 *  pas l'`extra` du porteur — sans cette annotation, `value` disparaîtrait du type inferé de la scène. */
export const competenceChiffreeSchema: z.ZodType<SkillRef> = refOuSpec('skill', { value: nommerNoeud(z.number(), { nom: 'valeur' }) }) as z.ZodType<SkillRef>;

/** Identifiant GLOBAL d'une entrée de fiche de dossier de chapitre (#2290) : format `ID_D_ENTREE`
 *  (`src/data/source/dossier.ts`). Feuille de `couvre` et de `narratif.ecartes[].entree`. */
export const entreeDeFicheSchema = z.string().regex(ID_D_ENTREE, 'entrée de fiche : « <ABBR>-<NN>#<id> » attendu.');

/** `couvre` (#2290) — les entrées de fiche de dossier de chapitre qu'un élément du paquet de campagne
 *  couvre, sans doublon. Posé par l'éditeur (`CouvreField`, `src/ui/editor/CouvreField.tsx`). */
export const couvreSchema = listeCle(entreeDeFicheSchema, { nom: 'entrée de fiche', scalaire: true });

/** `CustomStatblock.spells` — ids de `spells.json` : la porte est la fabrique canonique (`refs('spell')`),
 *  la FORME DE SORTIE est DÉCLARÉE nue (patron `couvertureSchema`, `./scene.ts`) — le type moteur
 *  `CustomStatblock` porte des ids nus (`byId`, `src/data/index.ts`), l'éditeur les saisit au `<select>`. */
const sortsConnusSchema: z.ZodType<string[], string[]> = refs('spell');

/** `CustomStatblock.char` — `Partial<Record<CharKey | 'M' | 'B', number>>` : toutes les clés sont
 *  FERMÉES et chacune est facultative (un profil n'imprime que ce que le livre imprime). Écrit en objet
 *  à champs optionnels, jamais en `z.record` : `z.record(z.enum, …)` est EXHAUSTIF en zod 4 (il
 *  EXIGERAIT les 12 clés), et un `z.record(z.string(), …)` accepterait n'importe quelle clé. */
export const charStatsSchema = nommerChamps(z.strictObject(
  tableTotale(charStatKeySchema.options, () => z.number().optional()),
), tableTotale(charStatKeySchema.options, cle => ({ label: libelleDeValeur(charStatKeySchema, cle) })));

/**
 * `CustomStatblock` (`engine/statblock.ts`) — profil PNJ/bête custom d'éditeur, DOCUMENT EMBARQUÉ du
 * document de scène : il porte son `type` comme tout document (#1467 L1b), et ses 14 champs sont
 * déclarés UN À UN, calés sur l'interface TS (aucun champ n'y est plus large qu'elle — `char` compris,
 * dont les clés sont FERMÉES sur `charStatKeySchema`).
 */
export const customStatblockSchema = nommerChamps(z.strictObject({
  type: z.literal('statblock'),
  label: z.string(),
  char: charStatsSchema,
  weaponDamage: z.string().optional(),
  armour: z.number().optional(),
  traits: z.array(traitInstanceSchema).optional(),
  size: sizeCategorySchema.optional(),
  groups: z.array(z.string()).optional(),
  spells: sortsConnusSchema.optional(),
  skills: z.array(competenceChiffreeSchema).optional(),
  talents: z.array(talentRefSchema).optional(),
  randomChars: z.boolean().optional(),
  inert: z.boolean().optional(),
  followsCharacterRules: z.boolean().optional(),
}), { type: { label: "type"  }, label: { label: "libellé" , texte: { regime: "designation"} }, char: { label: "caractéristiques" }, weaponDamage: { label: "dégâts d’arme" , texte: { regime: "technique"} }, armour: { label: "armure" }, traits: { label: "Traits" }, size: { label: "Taille"  }, groups: { label: "groupes" , texte: { regime: "technique"} }, spells: { label: "sorts" , texte: { regime: "technique"} }, skills: { label: "Compétences" }, talents: { label: "Talents" }, randomChars: { label: "caractéristiques aléatoires" }, inert: { label: "inerte" }, followsCharacterRules: { label: "règles de personnage" } });
