/**
 * Métamorphose en créature (Forme bestiale, LDB 48 — Domaine de la Bête) : « remplacez vos F, E, Ag
 * et Dex par celles de la créature, recalculez vos PB, gagnez tous ses Traits sauf Bestial ».
 *
 * RÉUTILISE la machinerie d'effets existante plutôt qu'un sous-système dédié : le remplacement de
 * Caractéristique = un `charMod` DIFFÉRENTIEL (la cible atteint la valeur de la créature ; les PB
 * sont recalculés par `refreshWounds` au passage, et le bonus est RETIRÉ à l'expiration → on
 * reprend sa vraie forme tout seul) ; chaque Trait = un `grantTrait` (retiré à l'expiration aussi).
 * Tout est donc auto-restitué à la fin du Sort par `endOfRound` / la purge d'horloge — aucun
 * handler de restauration custom. La perte de la parole/incantation, le +1 Trait facultatif par
 * +2 DR et la persistance des PB perdus restent journalisés (arbitrage MJ).
 */
import type { Combatant } from './types';
import type { GameOp } from './ops';
import { findCreatureById, findTraitById } from '../data';
import { baseWithTraits } from './characteristics';

/** id de créature dont l'apparence rig doit être rendue actuellement (op `polymorph` en cours), sinon
 *  `undefined` (forme de base). Le DERNIER effet `morphRef` actif l'emporte. Lu par la couche rig
 *  (`combatantAppearance`) — restitué seul à l'expiration de l'effet (plus de `morphRef` → forme de base). */
export function liveMorphRef(c: Combatant): string | undefined {
  let ref: string | undefined;
  for (const e of c.activeEffects ?? []) if (e.morphRef) ref = e.morphRef;
  return ref;
}

export function polymorphOps(target: Combatant, ref: string): GameOp[] {
  const cr = findCreatureById(ref);
  if (!cr) return [{ op: 'narrative', text: `Forme bestiale : « ${ref} » introuvable au bestiaire — arbitrage MJ.` }];
  const ops: GameOp[] = [];
  // F/E/Ag/Dex de la créature, par DIFFÉRENCE (effectiveChar = base + bonus = valeur de la créature).
  for (const k of ['force', 'endurance', 'agilite', 'dexterite'] as const) {
    const v = cr.char[k];
    if (typeof v === 'number') {
      const diff = v - baseWithTraits(target, k);
      if (diff !== 0) ops.push({ op: 'charMod', char: k, mod: diff });
    }
  }
  // `TraitData.nonTransferable` (LDB 48 l.23) ; `grantTrait` porte `arg`, `value` → `indice` et `range` (LDB 85 l.209).
  for (const t of cr.traits ?? [])
    if (!findTraitById(t.id)?.nonTransferable)
      ops.push({ op: 'grantTrait', traitId: t.id, ...(t.arg ? { arg: t.arg } : {}), ...(t.value != null ? { indice: t.value } : {}), ...(t.range != null ? { range: t.range } : {}) });
  ops.push({
    op: 'narrative',
    text: `${target.label} prend la forme d'un(e) ${cr.label} (F/E/Ag/Dex et Traits de la créature, PB recalculés) ; elle ne peut ni parler ni incanter, et conserve les PB perdus en reprenant sa vraie forme — arbitrage MJ.`,
  });
  return ops;
}
