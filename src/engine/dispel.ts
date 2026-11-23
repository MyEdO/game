/**
 * DISSIPATION DE SORTS PERMANENTS (LDB 46 l.158-162) — partie PURE.
 *
 * Réfs : LDB 46 l.160 (le Test et sa condition d'aboutissement), LDB 46 l.162 (pluralité de
 * dissipateurs).
 *
 * Le CUMUL du DR → NI est porté par `extendedTestStep` (engine/tests, mutualisé), le bonus de coopération
 * par `assistedTest`. Ici : ÉNUMÉRER les sorts permanents actifs (effets marqués `ActiveEffect.spell` à
 * l'incantation, cf. Stage 1) et les RETIRER proprement à la dissipation (réversion des octrois via
 * `removeActiveEffects`). NB : ne couvre que les imprints portés par `ActiveEffect` (buffs/débuffs, traits
 * octroyés, armes invoquées, ops `perRound`, États PORTÉS `passive`/`carried` — #1695, LDB 48 l.495 : ils
 * partent avec l'effet, par la réconciliation que `removeActiveEffects` clôt) — un État pur à durée
 * (`Condition.roundsLeft`) n'est pas marqué.
 */
import { Combatant, ActiveEffect } from './types';
import type { Applique } from './faits';
import { removeActiveEffects } from './conditions';

/** Un Sort PERMANENT actif et dissipable : identité + NI (le DR à atteindre) + porteurs de ses effets. */
export interface DispellableSpell {
  spellId: string;
  casterId: string;
  label: string;
  ni: number;
  /** ids des combattants portant ≥ 1 effet actif de ce sort (un sort de zone touche plusieurs cibles). */
  carriers: string[];
}

/** Énumère les Sorts permanents actifs sur un ensemble de combattants (effets durables marqués à
 *  l'incantation), REGROUPÉS par (sort, lanceur) — un même sort sur plusieurs cibles = UNE entrée. */
export function dispellableSpellsOn(combatants: Combatant[]): DispellableSpell[] {
  const byKey = new Map<string, DispellableSpell>();
  for (const c of combatants) {
    for (const e of c.activeEffects ?? []) {
      if (!e.spell) continue;
      const key = `${e.spell.spellId}@${e.spell.casterId}`;
      let d = byKey.get(key);
      if (!d) {
        d = { spellId: e.spell.spellId, casterId: e.spell.casterId, label: e.spell.label, ni: e.spell.ni, carriers: [] };
        byKey.set(key, d);
      }
      if (!d.carriers.includes(c.id)) d.carriers.push(c.id);
    }
  }
  return [...byKey.values()];
}

/** Vrai si l'effet appartient au sort (sort, lanceur) donné. */
export function isFromSpell(e: ActiveEffect, spellId: string, casterId: string): boolean {
  return e.spell?.spellId === spellId && e.spell?.casterId === casterId;
}

/** Retire de TOUS les combattants les effets actifs d'un Sort DISSIPÉ (réversion propre des octrois via
 *  `removeActiveEffects`, comme l'expiration naturelle). Renvoie le nombre de combattants nettoyés.
 *  `recueil` reçoit ce que la réconciliation dit des États PORTÉS qui partent avec le Sort (#1695) :
 *  sans lui, trois États tomberaient sans une ligne. */
export function dissipateSpell(combatants: Combatant[], spellId: string, casterId: string, recueil?: Applique): number {
  let cleaned = 0;
  for (const c of combatants) {
    if (removeActiveEffects(c, (e) => isFromSpell(e, spellId, casterId), recueil).length) cleaned++;
  }
  return cleaned;
}
