/**
 * spellSupport — classification mécanique d'un sort.
 *
 * Les métadonnées de résolution (durée, ZdE, opposition, téléportation…) vivent dans `SpellData`
 * (spells.json) : `spellSupport` en reçoit les champs sous forme de shape partielle (duck typing).
 */
import { GameOp } from './ops';

/** Shape minimale des métadonnées de résolution lues par `spellSupport` — sous-ensemble de
 *  `SpellData`. Pas d'import circulaire : les types sont inline (chaînes littérales / primitives). */
export interface SpellResolutionMeta {
  curated?: boolean;
  /** Cible structurée — `{kind:'area'}` signale une Zone d'Effet (son rayon vit ici). */
  target?: { kind?: string } | null;
  breathAttack?: boolean | true;
}

/**
 * Niveau de prise en charge MÉCANIQUE d'un sort (pour l'inventaire et les badges UI) :
 *  - 'mecanique' : tous ses effets connus sont appliqués par le moteur (ops mécaniques
 *    et/ou résolution de Projectile magique) ;
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
  // Les EFFETS (ops) vivent sur la donnée app-owned (`SpellData.effects`, Flow éditable) ;
  // l'appelant les extrait du Flow (feuilles EffectOp) et les passe ici. push/teleport/chain arrivent
  // désormais comme des ops (non-`narrative`) → comptées mécaniques par le filtre ci-dessous ; restent ici
  // la ZdE (`target.kind==='area'`) et le Souffle (`breathAttack`), métadonnées hors-op du sort.
  const mech = ops.filter((o) => o.op !== 'narrative').length > 0 || missile || spell.target?.kind === 'area'
    || spell.breathAttack != null;
  const narr = ops.some((o) => o.op === 'narrative') || (!spell.curated && ops.length === 0);
  if (mech && narr) return 'partiel';
  if (mech) return 'mecanique';
  return 'narratif';
}
