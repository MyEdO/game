/**
 * Renderer JOUEUR de `GameOp[]` → `CodexRow[]` (ref #495, doctrine #295 — affichage = STRUCTURE +
 * renderer, jamais une chaîne de flux). Un `GameOp` dont le payload porte l'ID d'une entité d'une
 * catégorie Codex EXISTANTE devient une chip codex-liée (`{t:'ref', category, id, label, show, badge?}`).
 * Couverture = ANCRES NOMINATIVES (les kinds ci-dessous, à id résoluble dans une catégorie du Codex) +
 * REPLI EXHAUSTIF `humanizeOp` (compile-time, `assertNever` dans humanize.ts) pour tout le reste — un
 * kind SANS id stable (invocation d'arme nommée, marqueur d'atelier…) ou pointant une catégorie hors
 * Codex tombe en `{t:'text'}`. JAMAIS `opSummary` (résumeur d'ATELIER, `editor/GameOpEditor.tsx`).
 */
import { slBonus, estCausePersistante, type GameOp, type Formula, type PerSL } from '../../engine/ops';
import type { CodexRow } from './registry';
import { humanizeOp, humanizeFormula, humanizePerSL, CAUSE_PERSISTANTE, replieCausesPersistantes } from './humanize';
import { CHAR_LABELS, HIT_LOCATION_LABELS } from '../../engine/types';
import { formatTrait, traitLabelById } from '../../engine/traits/dispatch';
import { giveTrappingLabel } from '../../engine/items';
import { statName } from '../../engine/statEntry';
import {
  conditionLabel, psychologyLabel, diseaseLabel, symptomLabel, creatureLabel,
  refLabel, findTrappingById, findEffectTableById, mutationTables, findPsychologyById,
} from '../../data';

const textRow = (o: GameOp): CodexRow => ({ t: 'text', text: humanizeOp(o) });

/** Accord réel singulier/pluriel d'un compte — `Formula` non littérale (dé, bonus…) accorde au
 *  pluriel (jamais garanti « un » à l'affichage). Jamais le pluriel-code « (s) ». */
const plural = (n: unknown, singular: string, pluralForm: string): string => (n === 1 ? singular : pluralForm);

/**
 * CONTEXTE DE RÉSOLUTION d'un rendu d'ops : ce que le jet a TRANCHÉ et que l'op seule ne dit pas.
 * `sl` = DR du jet réalisé (verdict). Absent = AVANT le jet (ou hors jet : fiche de Codex, passif) —
 * la ligne annonce alors la RÈGLE (base + échelle par DR), jamais un nombre qui deviendra faux.
 */
export interface OpRowCtx { sl?: number }

/** Quantité d'État telle qu'`applyOps` l'appliquera une fois le DR connu (`ops.ts` : `Math.max(1,
 *  value + slBonus(ctx.sl, valuePerSL))`) — MÊME arithmétique, jamais une seconde. `undefined` quand
 *  le DR est inconnu ou que la base n'est pas un littéral (dé, Bonus de Caractéristique). */
function resolvedCount(value: Formula | undefined, perSL: PerSL | undefined, sl: number | undefined): number | undefined {
  if (sl == null || perSL == null) return undefined;
  const base = value ?? 1;
  if (typeof base !== 'number') return undefined;
  return Math.max(1, base + slBonus(sl, perSL));
}

/** Une op → SA ligne Codex. Ancre nominative quand un id résout dans une catégorie EXISTANTE, sinon
 *  repli `humanizeOp`. `ctx` : le DR du jet réalisé, quand la ligne est un VERDICT. */
export function opRow(o: GameOp, ctx?: OpRowCtx): CodexRow {
  switch (o.op) {
    case 'charMod':
      return { t: 'ref', category: 'characteristics', id: o.char, label: CHAR_LABELS[o.char], show: CHAR_LABELS[o.char], badge: `${o.mod >= 0 ? '+' : ''}${o.mod}` };
    case 'charDRBonus':
      return { t: 'ref', category: 'characteristics', id: o.char, label: CHAR_LABELS[o.char], show: CHAR_LABELS[o.char], badge: `+${humanizeFormula(o.bonus)} DR` };
    // Mouvement voyage par sa propre famille d'ops (`moveMod`/`moveScale`, hors `CharKey`) mais
    // s'affiche COMME une Caractéristique (même entrée codex `characteristics/mouvement`, arbitrage
    // user 2026-07-17) — la sémantique moteur ne change pas, seul l'affichage converge.
    case 'moveMod':
      return { t: 'ref', category: 'characteristics', id: 'mouvement', label: 'Mouvement', show: 'Mouvement', badge: `${o.mod >= 0 ? '+' : ''}${o.mod}` };
    case 'moveScale':
      return { t: 'ref', category: 'characteristics', id: 'mouvement', label: 'Mouvement', show: 'Mouvement', badge: o.num === 1 && o.den === 2 ? '½' : `×${o.num}/${o.den}` };
    case 'wounds': {
      const badge = [
        o.ignoreAP === false ? undefined : 'ignore les PA',
        o.bypassArmour === 'metal' ? 'perce armure métallique' : o.bypassArmour === 'nonMagic' ? 'perce armure non magique' : undefined,
      ].filter((s): s is string => !!s).join(' · ') || undefined;
      return { t: 'ref', category: 'characteristics', id: 'blessure', label: 'Blessure', show: `${humanizeFormula(o.amount)} ${plural(o.amount, 'Blessure', 'Blessures')}`, badge };
    }
    // PA (Points d'Armure) : aucune entrée Codex glossaire dédiée — repli texte SEC (jamais de lien inventé).
    case 'ap':
      return { t: 'text', text: `+${humanizeFormula(o.amount)} PA${o.loc ? ` (${HIT_LOCATION_LABELS[o.loc]})` : ' (toutes Localisations)'}` };
    case 'grantTalent':
    case 'grantCareerTalent': {
      const l = refLabel('talents', o.talent);
      return { t: 'ref', category: 'talents', id: o.talent.id, label: statName(l), show: l };
    }
    case 'grantCareerSkill': {
      const l = refLabel('skills', o.skill);
      return { t: 'ref', category: 'skills', id: o.skill.id, label: statName(l), show: l };
    }
    case 'skillMod': {
      const l = refLabel('skills', o.skill);
      return { t: 'ref', category: 'skills', id: o.skill.id, label: statName(l), show: l, badge: `${o.mod >= 0 ? '+' : ''}${o.mod}` };
    }
    case 'skillDRBonus': {
      if (!o.skill) return textRow(o); // ancré sur un `testType` naval (hors catégorie Codex) → repli
      const l = refLabel('skills', o.skill);
      return { t: 'ref', category: 'skills', id: o.skill.id, label: statName(l), show: l, badge: `+${humanizeFormula(o.bonus)} DR` };
    }
    case 'grantTrait': {
      const label = traitLabelById(o.traitId);
      return { t: 'ref', category: 'traits', id: o.traitId, label, show: formatTrait({ id: o.traitId, arg: o.arg }), badge: o.indice != null ? humanizeFormula(o.indice) : undefined };
    }
    case 'grantPsychTrait': {
      const label = psychologyLabel(o.psychType);
      return { t: 'ref', category: 'psychologies', id: o.psychType, label, show: label, badge: o.cible };
    }
    case 'removePsychTrait': {
      if (!o.psychType) return textRow(o); // « au choix » : pas d'ancre
      const label = psychologyLabel(o.psychType);
      return { t: 'ref', category: 'psychologies', id: o.psychType, label, show: label };
    }
    case 'endPsych': {
      const label = psychologyLabel(o.type);
      return { t: 'ref', category: 'psychologies', id: o.type, label, show: label };
    }
    case 'beginPsych': {
      const label = psychologyLabel(o.type);
      // L'Indice (Peur 2, Terreur 3) est le BADGE de la chip : c'est le DR à surmonter, pas un nom.
      // `active:false` = le Trait ciblé RÉSISTÉ (LDB 21 l.19/l.48) : l'issue n'est pas vide, elle porte le
      // modificateur social « contenu » déclaré par l'entrée (`containedSocialMod`).
      const mod = o.active === false ? findPsychologyById(o.type)?.containedSocialMod : undefined;
      const badge = [
        o.cible ?? (o.indice != null ? humanizeFormula(o.indice) : undefined),
        mod != null ? `${mod < 0 ? '−' : '+'}${Math.abs(mod)} Sociabilité` : undefined,
      ].filter((s): s is string => !!s).join(' · ') || undefined;
      return { t: 'ref', category: 'psychologies', id: o.type, label, show: label, badge };
    }
    case 'condition': {
      const label = conditionLabel(o.id);
      // Quantité : le nombre RÉSOLU dès que le DR du jet est connu (verdict) — sinon la base, et la
      // progression par DR passe en badge, pour que l'annonce dise la règle ENTIÈRE et jamais un
      // nombre que la résolution démentira.
      const n = resolvedCount(o.value, o.valuePerSL, ctx?.sl);
      const show = n != null ? `${n} × ${label}`
        : o.value != null && o.value !== 1 ? `${humanizeFormula(o.value)} × ${label}` : label;
      // CAUSE PERSISTANTE (`LDB 16 l.117`) : l'op ne pose pas un État DE PLUS par Round — elle maintient
      // celui-ci. La chip reste UNE, la persistance est dite au badge, du même mot que le journal.
      const persistante = estCausePersistante(o);
      const duree = o.durationRounds != null ? `${humanizeFormula(o.durationRounds)} ${plural(o.durationRounds, 'Round', 'Rounds')}` : undefined;
      const badge = [
        persistante ? CAUSE_PERSISTANTE : undefined,
        duree ?? (!persistante && o.perRound ? 'par Round' : undefined),
        n == null && o.valuePerSL ? humanizePerSL(o.valuePerSL) : undefined,
      ].filter((s): s is string => !!s).join(' · ') || undefined;
      return { t: 'ref', category: 'etats', id: o.id, label, show, badge };
    }
    case 'removeCondition': {
      if (!o.id) return textRow(o); // « au choix » : pas d'ancre
      const label = conditionLabel(o.id);
      const n = resolvedCount(o.value, o.valuePerSL, ctx?.sl); // même contrat de quantité que `condition`
      const show = n != null ? `${n} × ${label}` : label;
      const badge = n == null && o.valuePerSL ? humanizePerSL(o.valuePerSL) : undefined;
      return { t: 'ref', category: 'etats', id: o.id, label, show, badge };
    }
    case 'giveTrapping': {
      if (!o.trappingId) return textRow(o); // objet CUSTOM (misc) sans id de catalogue → repli
      const label = findTrappingById(o.trappingId)?.label ?? o.trappingId;
      return { t: 'ref', category: 'trappings', id: o.trappingId, label, show: giveTrappingLabel(o), badge: o.count && o.count > 1 ? `×${o.count}` : undefined };
    }
    case 'contractDisease': {
      const label = diseaseLabel(o.disease);
      return { t: 'ref', category: 'maladies', id: o.disease, label, show: label };
    }
    case 'exposeDisease': {
      const label = diseaseLabel(o.disease);
      return { t: 'ref', category: 'maladies', id: o.disease, label, show: label };
    }
    case 'reduceDiseaseDays': {
      if (!o.disease) return textRow(o); // « une maladie » au choix : pas d'ancre
      const label = diseaseLabel(o.disease);
      const days = o.dice ? `${o.dice.n}d${o.dice.sides}` : String(o.days ?? 1);
      return { t: 'ref', category: 'maladies', id: o.disease, label, show: label, badge: `−${days} j` };
    }
    case 'suppressSymptom': {
      const label = symptomLabel(o.symptomId);
      return { t: 'ref', category: 'symptoms', id: o.symptomId, label, show: label };
    }
    case 'summon': {
      const label = creatureLabel(o.ref);
      return { t: 'ref', category: 'creatures', id: o.ref, label, show: label, badge: `×${humanizeFormula(o.count)}${o.allyOfCaster === false ? ' (hostile)' : ''}` };
    }
    case 'scheduleRespawn': {
      const label = creatureLabel(o.ref);
      return { t: 'ref', category: 'creatures', id: o.ref, label, show: label, badge: `${humanizeFormula(o.delayDays)} j` };
    }
    case 'polymorph': {
      const label = creatureLabel(o.ref);
      return { t: 'ref', category: 'creatures', id: o.ref, label, show: label };
    }
    case 'transform': {
      if (!o.morphRef) return textRow(o); // deltas purs sans forme visuelle référencée
      const label = creatureLabel(o.morphRef);
      return { t: 'ref', category: 'creatures', id: o.morphRef, label, show: label, badge: o.tag };
    }
    case 'rollMutation': {
      const label = mutationTables.find((t) => t.id === o.table)?.label ?? o.table;
      return { t: 'ref', category: 'mutationTables', id: o.table, label, show: label };
    }
    default:
      return textRow(o);
  }
}

/** Fourchette d'une rangée de table (« 1–2 · Perte d'Initiative », « 8 · Mutation »). */
const tableRowRange = (r: { min: number; max: number; label?: string }): string =>
  `${r.min === r.max ? r.min : `${r.min}–${r.max}`}${r.label ? ` · ${r.label}` : ''}`;

/** Profondeur d'expansion des tables IMBRIQUÉES (une rangée de table portant elle-même `rollTable`) —
 *  1 niveau : la table de tête s'expanse en rangées, une table trouvée DANS une rangée déjà expansée
 *  se rend par son libellé + lien codex (`opRowsForOp`), jamais ré-expansée (borne l'imbrication). */
const MAX_TABLE_DEPTH = 1;

/** Rangées `[min,max] → ops` d'une table d'effets → lignes Codex (sous-titre de fourchette + ops de la
 *  rangée passées par la MÊME humanisation récursive). SOURCE UNIQUE, composée par la catégorie Codex
 *  « Tables d'effets » (`registry.ts`) ET par l'expansion générique de l'op `rollTable` ci-dessous. */
export function tableRows(rows: { min: number; max: number; label?: string; ops: GameOp[] }[], depth = 0, ctx?: OpRowCtx): CodexRow[] {
  return rows.flatMap((r): CodexRow[] => [
    { t: 'sub', label: tableRowRange(r) },
    ...r.ops.flatMap((o) => opRowsForOp(o, depth, ctx)),
  ]);
}

/** Une op → SES lignes Codex — 1 pour la plupart des kinds, N pour un `rollTable` (rangées EXPANSÉES,
 *  bornées par `MAX_TABLE_DEPTH`). Réutilisée par `opRows` (liste plate) ET la catégorie « Tables
 *  d'effets » — jamais une 2e implémentation de la projection table → rangées lisibles. */
function opRowsForOp(o: GameOp, depth: number, ctx?: OpRowCtx): CodexRow[] {
  if (o.op === 'rollTable') {
    if (depth >= MAX_TABLE_DEPTH) {
      // Table imbriquée déjà sous une rangée expansée : libellé + lien codex (tableId), sinon repli texte
      // (rows inline sans id à lier) — jamais de ré-expansion (borne l'imbrication).
      if ('tableId' in o) {
        const t = findEffectTableById(o.tableId);
        return [{ t: 'ref', category: 'effectTables', id: t.id, label: t.label, show: t.label }];
      }
      return [textRow(o)];
    }
    const rows = 'tableId' in o ? findEffectTableById(o.tableId).rows : o.rows;
    return tableRows(rows, depth + 1, ctx);
  }
  return [opRow(o, ctx)];
}

/** Une liste d'ops → SES lignes Codex, dans l'ordre (un `rollTable` s'expanse en ses rangées).
 *  `ctx` : le DR du jet réalisé quand ces lignes sont un VERDICT (cf. `OpRowCtx`). */
export function opRows(ops: GameOp[], ctx?: OpRowCtx): CodexRow[] {
  return replieCausesPersistantes(ops).flatMap((o) => opRowsForOp(o, 0, ctx));
}
