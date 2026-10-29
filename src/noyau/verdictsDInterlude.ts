/**
 * Verdicts de l'INTERLUDE, en module FEUILLE : les gestes d'Activité (`noyau/interludeFlow.ts`,
 * `noyau/favorFlow.ts`) et l'écran d'interlude les lisent, sans que l'un importe l'autre.
 * Le geste applique le verdict en tête (`refuseSi`) ; l'écran le lit sans le recalculer.
 */
import { findCareerById, libelleOuAbsence } from '../data';
import { interludeEventFor } from '../data/interludeEvents';
import { t } from '../i18n';
import type { Combatant } from '../engine/types';
import type { Jeu } from './etat';

/** L'état que lisent les verdicts d'interlude. */
export type EtatDInterlude = Pick<Jeu, 'interlude' | 'party' | 'bank'>;

/** Les Événements de la période sont-ils encore à tirer (phase `'tirage'`, #942 L7) ? LDB 22 l.5 */
export function interludeDrawPending(s: Pick<Jeu, 'interlude'>): boolean {
  return s.interlude?.phase === 'tirage';
}

/** Les héros dont le dé d'Événement reste à poser pendant le tirage, dans l'ordre du groupe ; vide hors
 *  tirage. Le tirage peut rester ouvert sans dé en attente : le dénouement de groupe reste alors à valider. */
export function desEnAttente(s: EtatDInterlude): Combatant[] {
  const itl = s.interlude;
  if (!itl || !interludeDrawPending(s)) return [];
  return s.party.filter((h) => itl.perHero[h.id] && itl.perHero[h.id].eventRoll == null);
}

const nomDuHeros = (s: EtatDInterlude, heroId: string): string =>
  libelleOuAbsence(s.party.find((h) => h.id === heroId), 'heros', heroId);

/** Refus d'un geste d'interlude pendant le tirage des Événements : la raison affichée, ou `null`. Verdict
 *  UNIQUE des gestes qui ne consomment pas d'Activité (engager un Artisanat, retirer une planque). LDB 22 l.5 */
export function refusDuTirage(s: EtatDInterlude, heroId: string): string | null {
  return interludeDrawPending(s) ? t('if.drawPending', { name: nomDuHeros(s, heroId) }) : null;
}

/** Refus d'un geste qui CONSOMME une Activité d'interlude : tirage en attente, puis plus d'Activité
 *  restante. Verdict UNIQUE des gestes d'Activité et de l'écran. LDB 23 l.5 */
export function refusDActivite(s: EtatDInterlude, heroId: string): string | null {
  return refusDuTirage(s, heroId)
    ?? ((s.interlude?.perHero[heroId]?.left ?? 0) <= 0 ? t('if.noActivityLeft', { name: nomDuHeros(s, heroId) }) : null);
}

/** Refus de retirer le dépôt `index` : la planque n'attend que le tirage, l'investissement et le mécénat
 *  consomment une Activité de leur dépositaire. Verdict UNIQUE de `bankWithdraw` et de l'écran ; `null`
 *  pour un dépôt absent, que le geste ignore. LDB 23 l.168-170, ACE 12 l.49 */
export function refusDeRetrait(s: EtatDInterlude, index: number): string | null {
  const dep = (s.bank ?? [])[index];
  if (!dep) return null;
  return dep.kind === 'stash' ? refusDuTirage(s, dep.heroId) : refusDActivite(s, dep.heroId);
}

/** Classe du héros, `id` STABLE (`ClassData.id`) — les événements visent une Classe par id
 *  (`revenueClasses`/`revenueBlockedClasses`, eux aussi en id). Carrière → id de classe. */
export function heroClass(h: Combatant): string {
  return findCareerById(h.career ?? '')?.class ?? '';
}

/** Libellé de l'Événement d'un héros — appelé sous une garde `fx` (le dé et `fx` sont écrits ENSEMBLE
 *  au dénouement) ; sans dé, il se tait au lieu de nommer la première ligne du tableau. */
export const eventLabelOf = (st: { eventRoll?: number }): string =>
  st.eventRoll == null ? t('if.eventGeneric') : interludeEventFor(st.eventRoll).label;

/** L'Événement de la période bloque-t-il les Revenus pour la Classe du héros : la raison, ou `null`.
 *  Lu par la chronique ; le geste et l'écran lisent `refusDeRevenus`. LDB 22 */
export function blocageDeRevenus(s: EtatDInterlude, heroId: string): string | null {
  const st = s.interlude?.perHero[heroId];
  const h = s.party.find((x) => x.id === heroId);
  const bloquees = st?.fx?.revenueBlockedClasses;
  if (!st || !h || !bloquees || !(bloquees.includes('*') || bloquees.includes(heroClass(h)))) return null;
  return t('if.incomeBlocked', { name: h.label, event: eventLabelOf(st) });
}

/** Refus d'entreprendre les Revenus : celui de toute Activité, puis le blocage de l'Événement. Verdict
 *  UNIQUE du geste, de l'entrée et du volet. LDB 22, LDB 23 l.5 */
export function refusDeRevenus(s: EtatDInterlude, heroId: string): string | null {
  return refusDActivite(s, heroId) ?? blocageDeRevenus(s, heroId);
}
