/**
 * ÉLAGAGE d'un document PERSISTÉ (#1463 LD.1, #2995) — sauvegarde, roster, export de héros, règles maison du
 * stockage : ce qui nomme une règle optionnelle ou un État hors du registre COURANT est retiré, le reste se
 * charge, et les ids retirés sont rendus pour être NOMMÉS au joueur. Le document n'est jamais jeté pour une
 * dérive du registre ; seul un changement de FORMAT le jette (`state/saves.ts`, `state/roster.ts`).
 *
 * SEUL juge de ce qui se refuse : `refusDesSurcharges` (`engine/policy`) pour les surcharges, `etatsPortesInconnus`
 * (`engine/conditions`) pour les États portés. Aucun chargeur n'en garde de copie.
 */
import { refusDesSurcharges, type RuleValue } from '../../engine/policy';
import { etatsPortesInconnus } from '../../engine/conditions';
import type { ConditionInstance } from '../../engine/types';
import { t } from '../../i18n';

/** Les ids retirés d'un document : surcharges de règles refusées, États portés inconnus (sans doublon). */
export interface RetraitsDElagage {
  regles: string[];
  etats: string[];
}

/** Un combattant persisté, tel qu'il arrive du stockage : sa liste d'États est lue sans être présumée. */
type Porteur = { conditions?: ConditionInstance[] };

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
  const porteurs = (entree.porteurs ?? []).map((p) =>
    etatsPortesInconnus([p]).length ? { ...p, conditions: (p.conditions ?? []).filter((x) => !etats.includes(x.id)) } : p,
  );
  return { regles, porteurs, retraits: { regles: reglesRefusees, etats } };
}

/** Rien n'a été retiré. */
export const rienDElague = (r: RetraitsDElagage): boolean => r.regles.length === 0 && r.etats.length === 0;

/** Les ids retirés, NOMMÉS pour le message au joueur : « règles optionnelles a, b ; États x ». */
export function nommerLesRetraits(r: RetraitsDElagage): string {
  return [
    ...(r.regles.length ? [t('elagage.regles', { ids: r.regles.join(', ') })] : []),
    ...(r.etats.length ? [t('elagage.etats', { ids: r.etats.join(', ') })] : []),
  ].join(' ; ');
}
