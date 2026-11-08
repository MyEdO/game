/**
 * Talent « Résistance (Menace) » — LDB 10 l.1016-1020 : « Vous pouvez réussir automatiquement le
 * premier Test pour résister à la menace spécifiée, telle que Magie, Poison, Maladie, Mutation, à
 * chaque séance de jeu. Si le DR requis est important, utilisez votre Bonus d'Endurance comme DR
 * pour le Test. »
 *
 * Moteur PUR : ce module ne fait que DÉCIDER (spec disponible ?) et COMPTER (1 usage par spec et
 * par séance — compteur `Combatant.resistanceUsed`, remis à zéro par la couture de début de séance
 * `restoreFortune`, engine/fortune). L'auto-succès lui-même passe par le MÊME mécanisme que la
 * Résilience « Je ne faillirai pas ! » : le résolveur du flux reçoit `ForcedResolve { sl: BE }`
 * (verbe `resist`).
 *
 * Un Test est ÉLIGIBLE quand son pending/étape porte un tag `menace` (posé par le SITE du Test :
 * Contraction de maladie, Exposition à la Corruption, seuil → Mutation, opposition à un Sort ; ou
 * en DONNÉE via `FlowTest.menace` — Venin/poisons). La spec du talent ET le tag `menace` sont des ids
 * stables (cf. `skills.json` migration Phase 3) — comparaison stricte par égalité, plus de pont `norm`
 * (tous les appelants, y compris `interludeFlow.ts`, passent l'id).
 * Talent JOUEUR : l'IA n'ouvre pas de modale → ne l'exploite pas.
 */
import type { Combatant } from './types';
import { bonus, effectiveChar } from './characteristics';
import { findTalentById } from '../data';
import type { SpecId } from '../data/schemas/grammaire/ref';
import { effectiveTalents } from './talentEffects';

/** Id de spec de l'entrée `resistance` de `talents.json` : le tag `menace` d'un Test, lu en donnée par
 *  `menaceSchema` (`data/schemas/grammaire/mecanique.ts`). Un littéral de code hors catalogue ne compile pas. */
export type MenaceId = SpecId<'talent', 'resistance'>;

/**
 * Les Menaces AUTHORÉES : les ids de SPEC de l'entrée `resistance` de `talents.json`, lus À
 * L'EXÉCUTION — SOURCE UNIQUE. LDB 10 l.1016-1020. Le tag `menace` est une CLÉ ÉTRANGÈRE vers cette
 * liste : jugé en donnée par `menaceSchema` (`data/schemas/grammaire/mecanique.ts`), au code par son
 * type `MenaceId`.
 */
export function menaceIds(): string[] {
  return (findTalentById('resistance')?.specs ?? []).map((s) => s.id);
}

/** La spec du talent Résistance de `c` couvrant `menaceId` et NON consommée cette séance — sinon null.
 *  (Le talent peut être pris plusieurs fois avec des specs différentes : chacune a SON usage.) */
export function availableResistance(c: Combatant, menaceId: string): string | null {
  const spec = effectiveTalents(c).find(
    (t) => t.talentId === 'resistance' && t.spec === menaceId,
  )?.spec;
  if (spec == null) return null;
  return (c.resistanceUsed ?? []).includes(spec) ? null : spec;
}

/** Consomme l'usage de séance de la spec (mute `c.resistanceUsed`). */
export function markResistanceUsed(c: Combatant, spec: string): void {
  if (!(c.resistanceUsed ?? []).includes(spec)) c.resistanceUsed = [...(c.resistanceUsed ?? []), spec];
}

/** DR de l'auto-succès : « utilisez votre Bonus d'Endurance comme DR pour le Test » (LDB 10). */
export function resistanceForcedSL(c: Combatant): number {
  return bonus(effectiveChar(c, 'endurance'));
}

/**
 * L'auto-succès à DR = Bonus d'Endurance CHANGE-T-IL l'issue d'un jet déjà posé ? (LDB 10 l.1020.)
 * `posed = null` = jet PAS ENCORE lancé → toujours oui. SOURCE UNIQUE de la fenêtre d'offre du
 * talent, lue par le verbe `resist` de la fabrique rollFlow ET par les modales qui affichent le
 * bouton — l'auto-succès REMPLACE l'issue posée (il ne s'y ajoute pas), donc un jet déjà réussi
 * avec au moins autant de DR n'a rien à y gagner : le verbe n'y consomme pas l'usage de séance.
 */
export function resistanceImproves(c: Combatant, posed: { won: boolean; sl: number } | null): boolean {
  return !posed || !posed.won || posed.sl < resistanceForcedSL(c);
}
