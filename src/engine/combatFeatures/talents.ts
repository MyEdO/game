import { findTalentById } from '../../data';
import { effectiveTalents } from '../talentsPossedes';
import type { Combatant } from '../types';
import { effectiveEntry } from '../variants';
import type { CombatFeature, CombatFeatureCtx } from './types';

/** Capacités de combat présentes sur le combattant, lues de la DONNÉE (`TalentData.combat`) des talents
 *  POSSÉDÉS (`effectiveTalents` : niveau = times ; un talent ACCORDÉ par un effet actif, op `grantTalent`,
 *  au niveau 1 tant que l'effet dure ; un talent SUSPENDU, op `suppressTalents`, absent).
 *  La DONNÉE lue est l'entrée EFFECTIVE (`effectiveEntry`, #563/#564) : la variante réglée active
 *  remplace le `combat` de base ; aucun code ne nomme un Talent. */
export function featuresOf(c: Combatant): { def: CombatFeature; ctx: CombatFeatureCtx }[] {
  const out: { def: CombatFeature; ctx: CombatFeatureCtx }[] = [];
  for (const t of effectiveTalents(c)) {
    const def = effectiveEntry(findTalentById(t.talentId))?.combat;
    if (def) out.push({ def, ctx: { combatant: c, level: t.times ?? 1, spec: t.spec } });
  }
  return out;
}

/** Somme des niveaux des capacités vérifiant `pred` (0 si aucune). */
export function levelSum(c: Combatant, pred: (d: CombatFeature) => boolean): number {
  return featuresOf(c).reduce((s, { def, ctx }) => s + (pred(def) ? ctx.level : 0), 0);
}

/** LDB 10, Âme pure ; LDB 19 l.80. */
export function talentCorruptionThreshold(c: Combatant): number {
  return levelSum(c, (d) => !!d.corruptionThreshold);
}
