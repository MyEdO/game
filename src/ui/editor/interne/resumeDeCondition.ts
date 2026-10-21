/**
 * Résumeur d'ATELIER de l'algèbre de `Condition` (`condSummary`), réservé à `src/ui/editor/`
 * (#495, #2724).
 */
import type { Condition, CompareSubject, PartySelector, TemporalCondition } from '../../../engine/flowCore';
import type { NarratifBlock } from '../../../data/schemas/defs-scenes/narratif';
import { HIT_LOCATION_LABELS } from '../../../engine/types';
import { libelleDeValeur, valeursDe } from '../../../data/schemas/grammaire/meta';
import { attackKindSchema } from '../../../data/schemas/defs/maneuvers';
import { actorFieldSchema, actorRefSchema, hasWhatSchema, relationOrCampSchema, startleCauseSchema } from '../../../data/schemas/grammaire/mecanique';
import { findTrappingById } from '../../../data';
import { formatMoney } from '../../../engine/money';
import { libelleDEtat } from '../../compendium/libellesNarratifs';

/** Libellé d'affichage d'un `trappingId` (objet catalogué) — repli sur l'id brut (objet CUSTOM par nom). */
const trappingLabelOrId = (id?: string): string => (id ? findTrappingById(id)?.label ?? id : '');

/** Résumé d'un sélecteur de héros. */
const quiResume = (who: PartySelector | undefined, narratif: NarratifBlock | undefined): string =>
  who === 'all' ? 'groupe' : typeof who === 'object' ? `héros désigné « ${who.etat ? libelleDEtat(narratif?.etats, who.etat) : '?'} »` : 'un héros';

/** Kinds d'attaque (cf. `creatureAttackKind`) — libellés du sélecteur de la Condition `attackKind` : les
 *  `AttackKind` catalogués (nœud `attackKindSchema`, `defs/maneuvers.ts`). */
export const ATTACK_KIND_LABELS: Record<string, string> = valeursDe(attackKindSchema) ?? {};

/** Libellé du SUJET/valeur d'une comparaison : donnée fixe, valeur d'un État nommé, ou Caractéristique. */
const subjectLabel = (s: CompareSubject): string =>
  'condition' in s ? `État « ${s.condition || '?'} »`
    : 'char' in s ? `Carac. ${s.char}${s.bonus ? ' (Bonus)' : ''}`
      : libelleDeValeur(actorFieldSchema, s.field);

const pad = (n?: number) => (n == null ? '··' : String(n).padStart(2, '0'));
const winSummary = (w: TemporalCondition) => {
  const a = w.afterHour != null ? `${pad(w.afterHour)}:${pad(w.afterMinute ?? 0)}` : null;
  const b = w.beforeHour != null ? `${pad(w.beforeHour)}:${pad(w.beforeMinute ?? 0)}` : null;
  return a && b ? `${a}–${b}` : a ? `dès ${a}` : b ? `avant ${b}` : 'créneau';
};
/** Résumé HUMAIN compact d'une Condition (rangées repliées, listes) ; `narratif` résout les libellés des
 *  états de campagne (absent : racine de catalogue, les ids restent). */
export function condSummary(c: Condition | undefined, narratif?: NarratifBlock): string {
  if (!c) return '';
  switch (c.kind) {
    case 'always': return 'toujours';
    case 'flag': return c.expr || '(flag ?)';
    case 'time': return winSummary(c.window);
    case 'hasItem': return `a « ${trappingLabelOrId(c.trappingId) || '?'} »${c.count && c.count > 1 ? ` ×${c.count}` : ''}`;
    case 'money': return `bourse ≥ ${formatMoney({ gold: c.atLeast.gold ?? 0, silver: c.atLeast.silver ?? 0, brass: c.atLeast.brass ?? 0 })}`;
    case 'partyDead': return c.who === 'all' ? 'tout le groupe mort' : `${quiResume(c.who, narratif)} mort`;
    case 'etat': {
      const nom = c.etat ? libelleDEtat(narratif?.etats, c.etat) : '?';
      return c.value === undefined ? `état « ${nom} » défini` : `état « ${nom} » = ${libelleDEtat(narratif?.etats, c.etat, c.value)}`;
    }
    case 'compare': {
      const val = typeof c.value === 'number' ? `${c.value}` : `${libelleDeValeur(actorRefSchema, c.value.who)} ${subjectLabel(c.value)}`;
      return `${libelleDeValeur(actorRefSchema, c.subject.who)} : ${subjectLabel(c.subject)} ${c.op} ${val}`;
    }
    case 'slThreshold': return `marge ${c.op} ${c.value} DR`;
    case 'location': return `touche ${HIT_LOCATION_LABELS[c.is]}`;
    case 'attackKind': return `attaque = ${ATTACK_KIND_LABELS[c.is] ?? (c.is || '?')}`;
    case 'startleCause': return `effarouché par ${libelleDeValeur(startleCauseSchema, c.is)}`;
    case 'woundsDealt': return `PB infligés ${c.op} ${c.value}`;
    case 'engagedAdvantageGap': return `écart d’Avantage ${c.op} ${c.value}`;
    case 'engagedAdvantageLead': return `avance d’Avantage ${c.op} ${c.value}`;
    case 'foeInLoS': return 'ennemi en Ligne de Vue';
    case 'visiblePassive': return `${c.who === 'caster' ? 'lanceur' : 'cible'} : atteinte visible`;
    case 'hiddenFromFoes': return 'caché (hors de vue de l’ennemi)';
    case 'engaged': return 'engagé avec un ennemi';
    case 'crewTest': return 'au sein d’un Test d’équipage';
    case 'nearestFoe': return `ennemi le + proche ${c.op} ${c.value} cases`;
    case 'capability': return `${libelleDeValeur(actorRefSchema, c.who)} : capacité « ${c.id || '?'} » ${c.op ?? '>='} ${c.value ?? 1}`;
    case 'relation': return `${libelleDeValeur(actorRefSchema, c.who)} : ${libelleDeValeur(relationOrCampSchema, c.is)}`;
    case 'has': return `${libelleDeValeur(actorRefSchema, c.who)} a ${libelleDeValeur(hasWhatSchema, c.what)} « ${c.value || '?'}${c.spec ? ` (${c.spec})` : ''} »`;
    case 'casterChaosDomain': return `Domaine du Chaos du lanceur = ${c.is || '?'}`;
    case 'skill': return `${quiResume(c.who, narratif)} : Compétence « ${c.id || '?'}${c.spec ? ` (${c.spec})` : ''} »${c.advances ? ` ≥${c.advances}` : ''}`;
    case 'career': return `${quiResume(c.who, narratif)} : carrière « ${c.id || '?'} »`;
    case 'species': return `${quiResume(c.who, narratif)} : espèce « ${c.id || '?'} »`;
    case 'status': return `${quiResume(c.who, narratif)} : Statut ≥ « ${c.atLeast || '?'} »`;
    case 'all': return c.of.length ? c.of.map((x) => condSummary(x, narratif)).join(' ET ') : 'toujours';
    case 'any': return c.of.length ? c.of.map((x) => condSummary(x, narratif)).join(' OU ') : 'jamais';
    case 'not': return `NON(${condSummary(c.of, narratif)})`;
  }
}
