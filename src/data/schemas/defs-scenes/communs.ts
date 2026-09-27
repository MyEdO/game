/**
 * Vocabulaire FEUILLE partagé par les schémas d'une racine `src/scenes` — les formes que la SCÈNE
 * (`./scene.ts`) et les EFFETS (`./effets.ts`) posent l'une comme l'autre. Un concept = une
 * définition : ce module existe pour qu'aucune des deux ne recopie l'autre (et pour que le cycle
 * `scene ⇄ effets` n'ait pas lieu — la scène porte des Flows, les effets portent des cases).
 */
import { tableTotale } from '../../../lib/tableTotale';
import { z } from 'zod';
import { talentRefSchema, traitInstanceSchema } from '../grammaire/reference';
import { refOuSpec } from '../grammaire/ref';
import type { SkillRef } from '../../index';
import { charStatKeySchema, sizeCategorySchema } from '../grammaire/valeurs';

/** `Pt` (`state/path.ts`) — case, `z` = couche d'empilement (absent = base). */
export const ptSchema = z.strictObject({ x: z.number(), y: z.number(), z: z.number().optional() });
/** CANON de l'arête de mur — arête cardinale N/E, diagonales `\` (NO→SE) et `/` (NE→SO). Source
 *  UNIQUE de l'union : `state/scene.ts` (`WallSide`) et `engine/types.ts` (`WallEdgeSide`) en
 *  DÉRIVENT, l'éditeur en dérive ses options (`wallSideSchema.options`). Garde : `unions-canon.test.ts`. */
export const wallSideSchema = z.enum(['N', 'E', '\\', '/']);
export type WallSide = z.infer<typeof wallSideSchema>;
/** `SkillRef` (`src/data/index.ts`) — MÊME nœud que le statbloc du bestiaire (`defs/creatures.ts`) :
 *  la réf de la grammaire (`spec` XOR `choix`) + la valeur de Test IMPRIMÉE. La FORME de sortie est
 *  ANNOTÉE (patron `AxesData`, `defs/axes.ts`) : `refOuSpec` déclare `RefASpecialisation` et n'y porte
 *  pas l'`extra` du porteur — sans cette annotation, `value` disparaîtrait du type inferé de la scène. */
export const skillRefSchema: z.ZodType<SkillRef> = refOuSpec('skill', { value: z.number() }) as z.ZodType<SkillRef>;

/** `CustomStatblock.char` — `Partial<Record<CharKey | 'M' | 'B', number>>` : toutes les clés sont
 *  FERMÉES et chacune est facultative (un profil n'imprime que ce que le livre imprime). Écrit en objet
 *  à champs optionnels, jamais en `z.record` : `z.record(z.enum, …)` est EXHAUSTIF en zod 4 (il
 *  EXIGERAIT les 12 clés), et un `z.record(z.string(), …)` accepterait n'importe quelle clé. */
export const charStatsSchema = z.strictObject(
  tableTotale(charStatKeySchema.options, () => z.number().optional()),
);

/**
 * `CustomStatblock` (`engine/statblock.ts`) — profil PNJ/bête custom d'éditeur, DOCUMENT EMBARQUÉ du
 * document de scène : il porte son `type` comme tout document (#1467 L1b), et ses 14 champs sont
 * déclarés UN À UN, calés sur l'interface TS (aucun champ n'y est plus large qu'elle — `char` compris,
 * dont les clés sont FERMÉES sur `charStatKeySchema`).
 */
export const customStatblockSchema = z.strictObject({
  type: z.literal('statblock'),
  label: z.string(),
  char: charStatsSchema,
  weaponDamage: z.string().optional(),
  armour: z.number().optional(),
  traits: z.array(traitInstanceSchema).optional(),
  size: sizeCategorySchema.optional(),
  groups: z.array(z.string()).optional(),
  spells: z.array(z.string()).optional(),
  skills: z.array(skillRefSchema).optional(),
  talents: z.array(talentRefSchema).optional(),
  randomChars: z.boolean().optional(),
  inert: z.boolean().optional(),
  followsCharacterRules: z.boolean().optional(),
});
