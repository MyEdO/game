/**
 * ÉLAGAGE d'un document PERSISTÉ (#1463 LD.1, #2995) — sauvegarde, roster, export de héros, règles maison du
 * stockage : ce qui nomme une règle optionnelle, un État ou la Cible d'un Trait psychologique hors du registre COURANT est retiré, le reste se
 * charge, et les ids retirés sont rendus pour être NOMMÉS au joueur. Le document n'est jamais jeté pour une
 * dérive du registre ; seul un changement de FORMAT le jette (`hote/sauvegardes.ts`, `hote/roster.ts`).
 *
 * SEUL juge de ce qui se refuse : `refusDesSurcharges` (`engine/policy`) pour les surcharges, `etatsPortesInconnus`
 * (`engine/conditions`) pour les États portés, `ciblesPsyInconnues` (`engine/psychology`) pour les Cibles de Traits
 * psychologiques. Aucun chargeur n'en garde de copie.
 */
import { refusDesSurcharges, type RuleValue } from '../../engine/policy';
import { etatsPortesInconnus } from '../../engine/conditions';
import { ciblesPsyInconnues, sansCiblesPsyInconnues } from '../../engine/psychology';
import type { Combatant, ConditionInstance } from '../../engine/types';
import { t } from '../../i18n';
import { lesChaines } from '../../lib/stockage';

/** Les ids retirés d'un document : surcharges de règles refusées, États portés inconnus, Cibles inconnues de Traits
 *  psychologiques retirés (sans doublon). */
export interface RetraitsDElagage {
  regles: string[];
  etats: string[];
  groupes: string[];
}

/** Un combattant persisté, tel qu'il arrive du stockage : ses États et ses Traits psychologiques sont lus sans être
 *  présumés. */
type Porteur = { conditions?: ConditionInstance[] } & Partial<Pick<Combatant, 'psychTraits' | 'psychState' | 'activeEffects'>>;

/** Élague `regles` et `porteurs` : rend ce qui se charge, et les ids élagués (`retraits`). */
export function elaguerLePersiste<P extends Porteur>(entree: { regles?: Readonly<Record<string, unknown>>; porteurs?: readonly P[] }): {
  regles: Record<string, RuleValue>;
  porteurs: P[];
  retraits: RetraitsDElagage;
} {
  const brutes = entree.regles ?? {};
  const reglesRefusees = refusDesSurcharges(brutes).map((r) => r.id);
  const regles = Object.fromEntries(Object.entries(brutes).filter(([id]) => !reglesRefusees.includes(id))) as Record<string, RuleValue>;
  const etats = [...new Set(etatsPortesInconnus(entree.porteurs ?? []))];
  const groupes = [...new Set(ciblesPsyInconnues(entree.porteurs ?? []))];
  const porteurs = (entree.porteurs ?? []).map((p) =>
    sansCiblesPsyInconnues(etatsPortesInconnus([p]).length ? { ...p, conditions: (p.conditions ?? []).filter((x) => !etats.includes(x.id)) } : p),
  );
  return { regles, porteurs, retraits: { regles: reglesRefusees, etats, groupes } };
}

/** Les retraits relus de `v`, un témoin venu d'un stockage : chaque liste réduite à ses chaînes ; `null` si `v` n'est
 *  pas un objet. */
export function lireLesRetraits(v: unknown): RetraitsDElagage | null {
  if (v === null || typeof v !== 'object') return null;
  const r = v as Partial<Record<keyof RetraitsDElagage, unknown>>;
  return { regles: lesChaines(r.regles), etats: lesChaines(r.etats), groupes: lesChaines(r.groupes) };
}

/** L'union de `a` et `b`, sans doublon ; `null` si les deux le sont. */
export function cumulerLesRetraits(a: RetraitsDElagage | null, b: RetraitsDElagage | null): RetraitsDElagage | null {
  if (!a || !b) return a ?? b;
  const union = (x: string[], y: string[]) => [...new Set([...x, ...y])];
  return { regles: union(a.regles, b.regles), etats: union(a.etats, b.etats), groupes: union(a.groupes, b.groupes) };
}

/** Rien n'a été retiré. */
export const rienDElague = (r: RetraitsDElagage): boolean => r.regles.length === 0 && r.etats.length === 0 && r.groupes.length === 0;

/** Les ids retirés, NOMMÉS pour le message au joueur : « règles optionnelles a, b ; États x ; … ». */
export function nommerLesRetraits(r: RetraitsDElagage): string {
  return [
    ...(r.regles.length ? [t('elagage.regles', { ids: r.regles.join(', ') })] : []),
    ...(r.etats.length ? [t('elagage.etats', { ids: r.etats.join(', ') })] : []),
    ...(r.groupes.length ? [t('elagage.groupes', { ids: r.groupes.join(', ') })] : []),
  ].join(' ; ');
}
