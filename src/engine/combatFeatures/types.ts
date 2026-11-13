import type { z } from 'zod';
import type { Combatant } from '../types';
import type { castingKindSchema, combatFeatureSchema } from '../../data/schemas/grammaire/valeurs';

/** Famille d'incantation conférée par un Talent de lanceur (LDB 10) — pilote l'apprentissage
 *  des sorts (grimoire.ts). Source UNIQUE du type, partagée avec `CasterTalent`. */
export type CastingKind = z.output<typeof castingKindSchema>;

/** La famille d'incantation est-elle une Prière (Bénédiction/Miracle) ? Discriminant UNIQUE. `LDB 40 l.13` */
export function isPrayerFamily(family: string | undefined): boolean {
  return family === 'beni' || family === 'invocation';
}

/** Contexte lecture seule d'un hook de capacité (level = times du talent / Indice du trait). */
export interface CombatFeatureCtx {
  combatant: Combatant;
  level: number;
  /** Spécialisation du talent (« Sans Peur (Vampires) » → « Vampires ») — absente sur un
   *  talent accordé par sort (op grantTalent) ou non spécialisé. */
  spec?: string;
}

/**
 * Une capacité de combat/de jeu conférée par un TALENT (LDB 10) — registre `defs/` généré
 * (gen-registry.mjs), même patron que `engine/qualities`. Chaque champ décrit UN effet écrit de la
 * source ; les helpers de `dispatch.ts` les agrègent et les consommateurs (combat.ts, combatFlow,
 * rollFlowSpecs, store) les appellent aux moments de jeu. `level` = nombre de fois pris (times).
 *
 * Les talents de CRÉATION (+5 carac., compétence/talent ajouté aux carrières, Blessures/Chance/
 * Détermination/Mouvement) restent pilotés par les données via `talentEffects.ts` (ops `GameOp`) ;
 * les talents NARRATIFS sont allowlistés par le test de parité (`parity.test.ts`) — rien d'inventé.
 */
export type CombatFeature = z.output<typeof combatFeatureSchema>;
