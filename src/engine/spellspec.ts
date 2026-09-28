/**
 * spellSupport — classification mécanique d'un sort.
 *
 * Les métadonnées de résolution (durée, ZdE, opposition, téléportation…) vivent dans `SpellData`
 * (spells.json) : `spellSupport` en reçoit les champs sous forme de shape partielle (duck typing).
 */
import { GameOp } from './ops';
import { spellEffectOps } from './flowCore';
import { isMagicMissile } from './magic';
import type { SpellData } from '../data';

/** Shape minimale des métadonnées de résolution lues par `spellSupport` — sous-ensemble de
 *  `SpellData`. Pas d'import circulaire : les types sont inline (chaînes littérales / primitives). */
export interface SpellResolutionMeta {
  curated?: boolean;
  breathAttack?: boolean | true;
}

/**
 * Niveau de prise en charge MÉCANIQUE d'un sort (pour l'inventaire et les badges UI) :
 *  - 'mecanique' : tous ses effets connus sont appliqués par le moteur (ops mécaniques, touche de
 *    Projectile magique et/ou attaque de zone du Souffle) ;
 *  - 'partiel'   : effets mécaniques + un volet journalisé « arbitrage MJ » ;
 *  - 'narratif'  : RIEN n'est appliqué mécaniquement — l'effet est journalisé verbatim
 *    (sorts utilitaires, Traits temporisés, enchantements d'arme…).
 *
 * `spell` : shape partielle de `SpellData` (duck typing — pas d'import circulaire data→engine).
 * `ops`   : feuilles EffectOp extraites du Flow (`spellEffectOps(spell.effects)`).
 * `missile` : vrai si le sort est un Projectile magique (`isMagicMissile(spell)`).
 */
export function spellSupport(
  ops: GameOp[],
  spell: SpellResolutionMeta,
  missile: boolean,
): 'mecanique' | 'partiel' | 'narratif' {
  // Hors op, seules comptent les métadonnées qui PRODUISENT un effet : la touche du Projectile
  // (`appliquerTouchePourCible`, `src/state/combatFlow.ts`) et l'attaque de zone du Souffle
  // (`applyAreaAttack`, même fichier). Une ZdE (`target.kind === 'area'`) ne fait que CHOISIR les
  // cibles (`castCommitZone`, même fichier) des effets portés par les ops.
  const mech = ops.filter((o) => o.op !== 'narrative').length > 0 || missile || spell.breathAttack != null;
  const narr = ops.some((o) => o.op === 'narrative') || (!spell.curated && ops.length === 0);
  if (mech && narr) return 'partiel';
  if (mech) return 'mecanique';
  return 'narratif';
}

/** `spellSupport` d'un sort de la donnée : ses ops par `spellEffectOps`, son Projectile par `isMagicMissile`. */
export function spellSupportOf(spell: SpellData): ReturnType<typeof spellSupport> {
  return spellSupport(spellEffectOps(spell.effects), spell, isMagicMissile(spell));
}
