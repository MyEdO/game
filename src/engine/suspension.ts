/**
 * SUSPENSION d'une SOURCE passive — mécanisme GÉNÉRAL, module FEUILLE (types + durée seuls).
 *
 * Une source (entité Codex : symptôme, État, mutation, trait, objet, talent…) portée par un
 * `ActiveEffect` à durée voit TOUT ce qu'elle émet ignoré tant que l'effet dure : ses `PassiveMod`
 * sont écartés par le collecteur unique (`passiveMods`), donc les États qu'elle porte tombent à la
 * réconciliation (`syncDerivedConditions`) et reviennent d'office à l'expiration (l'effet quitte la
 * liste ; `LDB 16 l.117`).
 *
 * Deux porteurs aujourd'hui, un seul mécanisme : l'op `suppressSymptom` (Racine de terre, `LDB 72
 * l.28`), qui suspend la source ENTIÈRE, et la dépense de Détermination sur un État porté (`LDB 17
 * l.61`, fenêtre `ResolveWindow`), qui ne suspend que l'ÉTAT nommé (`suppressedCondition`).
 *
 * LIMITE MESURÉE : seules les sources qui s'ANNONCENT (`PassiveMod.src`) sont suspendables. Les
 * séquelles émettent SANS `src` (`engine/trauma.ts`) — rien ne les suspend par ce canal.
 */
import type { Combatant, ActiveEffect } from './types';
import type { Duration } from './duration';
import type { CodexTarget } from './ruleRefs';

/** Deux identités Codex désignent-elles la MÊME entité ? (comparaison par ids STABLES). */
export function memeSource(a: CodexTarget | undefined, b: CodexTarget | undefined): boolean {
  return !!a && !!b && a.category === b.category && a.id === b.id;
}

/**
 * La source `src` est-elle SUSPENDUE chez `c` par un effet actif ? `conditionId` = l'État que le mod
 * interrogé porte, quand c'en est un.
 *
 * Une suspension GRANULAIRE (`suppressedCondition`) n'écarte QUE l'État qu'elle NOMME : `LDB 17 l.61`
 * (« Retirez un État : si vous retirez l'État à Terre, regagnez 1 Point de Blessure lorsque vous vous
 * mettez debout. ») retire UN État, il n'annule rien d'autre de la source. `LDB 20 l.170` le dit sur le
 * cas limite : « Gagnez l'État *Inconscient*, même si la dépense de Points de Détermination peut vous
 * ramener à la conscience pendant quelques minutes. » — la conscience revient, la fièvre et son −10
 * RESTENT. Tout mod qui ne nomme pas d'État (`conditionId` absent) continue donc d'être ÉMIS.
 *
 * Une suspension PLEINE (`suppressedCondition` absent — op `suppressSymptom`, Racine de terre,
 * `LDB 72 l.28`) garde son régime : elle écarte TOUT ce que la source émet.
 */
export function sourceSuspended(c: Combatant, src: CodexTarget | undefined, conditionId?: string): boolean {
  if (!src) return false;
  return (c.activeEffects ?? []).some((e) => memeSource(e.suppressedSource, src)
    && (e.suppressedCondition == null || e.suppressedCondition === conditionId));
}

/** POSEUR UNIQUE de la suspension — miroir de `sourceSuspended`. `effectId` (facultatif) REMPLACE
 *  l'effet de même id : un porteur qui ne doit jamais empiler deux fenêtres concurrentes le nomme.
 *  `conditionId` (facultatif) RESTREINT la suspension à cet État (LDB 17 l.61, un pion à la fois). */
export function suspendSource(c: Combatant, src: CodexTarget, duration: Duration, label: string, effectId?: string, conditionId?: string): void {
  const garde = (c.activeEffects ?? []).filter((e) => !effectId || e.effectId !== effectId);
  const effet: ActiveEffect = { label, bonus: 0, duration, suppressedSource: src, ...(effectId ? { effectId } : {}), ...(conditionId ? { suppressedCondition: conditionId } : {}) };
  c.activeEffects = [...garde, effet];
}
