/**
 * Verdicts de l'INTERLUDE, en module FEUILLE : les gestes d'Activité (`noyau/interludeFlow.ts`,
 * `noyau/favorFlow.ts`) et l'écran d'interlude les lisent, sans que l'un importe l'autre.
 * Le geste applique le verdict en tête (`refuseSi`) ; l'écran le lit sans le recalculer.
 */
import { findCareerById, findTalentById, findTrappingById, libelleOuAbsence, refLabel } from '../data';
import { interludeEventFor } from '../data/interludeEvents';
import { t } from '../i18n';
import type { Combatant } from '../engine/types';
import { actorStatus } from '../engine/social';
import { fromBrass, toBrass, toMoney, priceToMoney, formatMoney } from '../engine/money';
import {
  ACTIVITIES, activityAvailableAt, craftSpecOf, entrainementOptions, learnableTalents, metierOf, orderBlockOf, type EntrainementOption, type LearnOption,
} from '../engine/activities';
import { outOfTradeReason } from '../engine/disponibilite';
import { memeSpecialisation } from '../data/schemas/grammaire/ref';
import type { Jeu } from './etat';
import { refusDeBourse } from './bourseFlow';
import { refusDePx } from './depenseDePx';
import { currentPlaceId } from './worldMap';

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

const herosDe = (s: EtatDInterlude, heroId: string): Combatant | undefined => s.party.find((h) => h.id === heroId);

/** Refus d'engager un Artisanat : tirage, ouvrage en cours, Métier absent, puis l'ouvrage `trappingId`
 *  (inconnu, hors commerce, matériaux hors de la bourse). Sans ouvrage choisi, seul le héros est jugé.
 *  Verdict UNIQUE de `craftStart` et du volet. LDB 23 l.74-78 */
export function refusDArtisanat(s: EtatDInterlude, heroId: string, trappingId?: string): string | null {
  const refus = refusDuTirage(s, heroId);
  const h = herosDe(s, heroId);
  if (refus || !h) return refus;
  if (h.craft) return t('if.craftBusy', { name: h.label, label: findTrappingById(h.craft.trappingId)?.label ?? h.craft.trappingId });
  if (!metierOf(h)) return t('if.craftNoSkill', { name: h.label });
  if (trappingId == null) return null;
  const tr = findTrappingById(trappingId);
  if (!tr) return t('if.trappingUnknown', { id: trappingId });
  const spec = craftSpecOf(tr);
  if (!spec) return t('trade.craftRefused', { reason: outOfTradeReason(tr.label) });
  return refusDeBourse(h, fromBrass(spec.materialsBrass), 'if.craftMaterialsKo');
}

/** L'option d'Apprentissage particulier (`learnableTalents`, la liste du volet) du Talent `talentId`, ou
 *  `undefined` : Talent de carrière, au Maxi ou à spécialisation. LDB 23 l.68 */
export function optionDApprentissage(h: Combatant, talentId: string): LearnOption | undefined {
  return learnableTalents(h).find((o) => o.id === talentId);
}

/** Refus d'un Talent qu'Apprentissage particulier ne peut pas enseigner au héros : inconnu, ou hors de
 *  `learnableTalents`. LDB 23 l.68 */
function refusDuTalentAApprendre(h: Combatant, talentId: string): string | null {
  if (!findTalentById(talentId)) return t('if.talentUnknown', { id: talentId });
  return optionDApprentissage(h, talentId) ? null : t('if.talentNonApprenable', { name: h.label, label: refLabel('talents', { id: talentId }) });
}

/** Refus d'un Apprentissage particulier AVANT le tirage du tuteur : Activité, Talent à apprendre, PX, puis
 *  une bourse sous le tuteur le MOINS cher (fourchette de l'option). Le tirage se juge après, au même
 *  message près. Verdict UNIQUE du geste et du volet. LDB 23 l.66-72 */
export function refusDApprentissage(s: EtatDInterlude, heroId: string, talentId: string): string | null {
  const refus = refusDActivite(s, heroId);
  const h = herosDe(s, heroId);
  if (refus || !h) return refus;
  const opt = optionDApprentissage(h, talentId);
  if (!opt) return refusDuTalentAApprendre(h, talentId);
  return refusDePx(h, opt.xpCost) ?? refusDeBourse(h, fromBrass(opt.tutorMinBrass), 'if.tuteurMinKo');
}

/** L'option d'Entraînement (`entrainementOptions`) que vise le geste, ou `undefined` : hors carrière seulement. */
export function optionDEntrainement(h: Combatant, kind: EntrainementOption['kind'], id: string, spec?: string): EntrainementOption | undefined {
  return entrainementOptions(h).find((o) => o.kind === kind && o.id === id && memeSpecialisation(o.spec, spec));
}

/** Refus d'un Entraînement AVANT le tirage du tuteur : Activité, option hors carrière, PX, puis une bourse
 *  sous le tuteur le MOINS cher (`entrainementTutorRange`). Verdict UNIQUE du geste et du volet. LDB 23 l.132-136 */
export function refusDEntrainement(s: EtatDInterlude, heroId: string, kind: EntrainementOption['kind'], id: string, spec?: string): string | null {
  const refus = refusDActivite(s, heroId);
  const h = herosDe(s, heroId);
  if (refus || !h) return refus;
  const opt = optionDEntrainement(h, kind, id, spec);
  if (!opt) return t('if.entrainementUnknown', { name: h.label });
  return refusDePx(h, opt.xpCost) ?? refusDeBourse(h, fromBrass(opt.tutorMinBrass), 'if.tuteurMinKo');
}

/** Refus de Passer commande `trappingId` : Activité, objet inconnu, hors commerce ou tenu en boutique
 *  (`orderBlockOf`), puis un prix hors de la bourse. Verdict UNIQUE de `orderItem` et du volet. LDB 23 l.178-184 */
export function refusDeCommande(s: EtatDInterlude, heroId: string, trappingId: string): string | null {
  const refus = refusDActivite(s, heroId);
  const h = herosDe(s, heroId);
  if (refus || !h) return refus;
  const tr = findTrappingById(trappingId);
  if (!tr) return t('if.trappingUnknown', { id: trappingId });
  const block = orderBlockOf(tr);
  if (block === 'sans-prix') return t('trade.orderRefused', { reason: outOfTradeReason(tr.label) });
  if (block === 'stock-ordinaire') return t('if.orderInShops', { label: tr.label, availability: String(tr.availability) });
  return refusDeBourse(h, priceToMoney(tr.price), 'if.orderTooExpensive');
}

/** L'état que lit le devis d'un dépôt : celui de l'interlude, et le lieu (Mécénat). */
export type EtatDeDepot = EtatDInterlude & Pick<Jeu, 'scene' | 'worldMap'>;

/** Les trois dépôts d'une Opération bancaire. */
export type GenreDeDepot = 'invest' | 'stash' | 'mecenat';

/** Devis d'un dépôt. `refus` : la raison affichée, ou `null` ; `debite` : ce que la bourse paie (sous de
 *  cuivre) ; `depose` : ce que la banque reçoit. */
export interface DevisDeDepot { refus: string | null; debite: number; depose: number }

/** Devis d'un dépôt de `montantBrass` : le refus (Activité, Statut Bronze pour investir, lieu et mise
 *  minimale du Mécénat, bourse), la somme débitée, et celle RÉELLEMENT déposée après le `bankPct` de
 *  l'Événement. Devis UNIQUE de `bankDeposit` et du volet. LDB 23 l.164-170, LDB 22 l.40, ACE 12 l.49 */
export function devisDeDepot(s: EtatDeDepot, heroId: string, kind: GenreDeDepot, montantBrass: number): DevisDeDepot {
  const debite = Math.max(1, Math.floor(montantBrass));
  const pct = s.interlude?.perHero[heroId]?.fx?.bankPct;
  const depose = pct ? Math.max(0, Math.floor((debite * (100 + pct)) / 100)) : debite;
  return { refus: refusDeDepot(s, heroId, kind, debite), debite, depose };
}

function refusDeDepot(s: EtatDeDepot, heroId: string, kind: GenreDeDepot, montant: number): string | null {
  const refus = refusDActivite(s, heroId);
  const h = herosDe(s, heroId);
  if (refus || !h) return refus;
  if (kind === 'invest' && actorStatus(h).tier === 'bronze') return t('if.bankTierKo', { name: h.label });
  if (kind === 'mecenat') {
    const def = ACTIVITIES.find((a) => a.resolver === 'mecenat');
    if (!def || !activityAvailableAt(def, currentPlaceId(s))) return t('if.mecenatHorsLieu');
    const min = toBrass(toMoney(def.minInvest ?? {}));
    if (montant < min) return t('if.mecenatMin', { min: formatMoney(fromBrass(min)) });
  }
  return refusDeBourse(h, fromBrass(montant), 'if.depositPurseKo');
}

/** Ce que lit le verdict de confirmation dans le jet d'Activité en attente. */
export interface ConfirmationDActivite { heroId: string; success?: boolean; talent?: string; tutorBrass?: number; costBrass?: number }

/** Refus d'appliquer le jet d'Activité confirmé : Activité, Talent à apprendre (et, sur un succès, les PX
 *  de son achat : avec la liste du volet, les deux refus de `buyTalent`), puis ce que la confirmation
 *  débite (tuteur d'Apprentissage, dépense de Réputation) hors de la bourse. Verdict UNIQUE de
 *  `confirmActivity`, avant tout débit. LDB 23 l.66-72, l.228-234 */
export function refusDeConfirmerLActivite(s: EtatDInterlude, pa: ConfirmationDActivite): string | null {
  const refus = refusDActivite(s, pa.heroId);
  const h = herosDe(s, pa.heroId);
  if (refus || !h) return refus;
  const opt = pa.talent ? optionDApprentissage(h, pa.talent) : undefined;
  return (pa.talent && !opt ? refusDuTalentAApprendre(h, pa.talent) : null)
    ?? (opt && pa.success ? refusDePx(h, opt.xpCost) : null)
    ?? (pa.tutorBrass ? refusDeBourse(h, fromBrass(pa.tutorBrass), 'if.tuteurKo') : null)
    ?? (pa.costBrass ? refusDeBourse(h, fromBrass(pa.costBrass), 'if.reputationPurseKo') : null);
}

