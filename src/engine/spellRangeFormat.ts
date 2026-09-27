/**
 * Affichage FR de la portée/cible d'un sort — DÉRIVÉ de la structure (`SpellRange`/`SpellTarget`),
 * SOURCE UNIQUE de cette prose — `spells.json` ne la stocke pas. Régénérer le texte ici (au lieu
 * de le stocker) rend l'i18n possible : changer `CHAR_LABELS` ou ces gabarits propage partout.
 */
import type { Formula } from './ops';
import { CHAR_LABELS } from './types';
import type { SpellRange, SpellTarget } from './spellRange';
import type { SpellDuration } from './spellDuration';
import { t } from '../i18n';

/** Mesure → prose : `6` → « 6 », `{charOf}` → « (Force Mentale) », `{bonusOf}` → « (Bonus de Force Mentale) ». */
function fmtMeasure(f: Formula): string {
  if (typeof f === 'number') return String(f);
  if ('bonusOf' in f) return t('spellFmt.bonusOf', { char: CHAR_LABELS[f.bonusOf] });
  if ('charOf' in f) return t('spellFmt.charOf', { char: CHAR_LABELS[f.charOf] });
  return '?'; // dés/rolled/indiceOf n'apparaissent pas en portée/cible
}

/** « mètre(s) » / « kilomètre(s) » selon le pluriel (littéral 1 = singulier). */
function unitWord(f: Formula, unit: 'm' | 'km'): string {
  const sing = f === 1;
  return unit === 'km' ? (sing ? t('spellFmt.km') : t('spellFmt.kms')) : (sing ? t('spellFmt.m') : t('spellFmt.ms'));
}

export function formatSpellRange(r: SpellRange): string {
  switch (r.kind) {
    case 'self': return t('spellFmt.self');
    case 'touch': return t('spellFmt.touch');
    case 'distance': return t('spellFmt.distance', { n: fmtMeasure(r.value), unit: unitWord(r.value, r.unit) });
    case 'special': return r.text;
  }
}

export function formatSpellTarget(t2: SpellTarget): string {
  switch (t2.kind) {
    case 'self': return t('spellFmt.self');
    case 'count': return typeof t2.n === 'number'
      ? (t2.n === 1 ? t('spellFmt.oneTarget') : t('spellFmt.targets', { n: t2.n }))
      : t('spellFmt.targets', { n: fmtMeasure(t2.n) });
    case 'area': return t('spellFmt.area', { span: t2.span === 'radius' ? t('spellFmt.spanRadius') : t('spellFmt.spanDiameter'), n: fmtMeasure(t2.meters) });
    case 'cone': return t('spellFmt.cone', { length: fmtMeasure(t2.lengthMeters), width: fmtMeasure(t2.widthMeters) });
    case 'special': return t2.text;
  }
}

/** Unité d'horloge, au SINGULIER ou au PLURIEL — fonction, jamais carte de module : une carte figée à
 *  l'évaluation ne suivrait pas `setLocale` (dette nommée, `src/i18n/index.ts`). */
function clockUnit(unit: 'minutes' | 'hours' | 'days', plural: boolean): string {
  if (unit === 'minutes') return plural ? t('spellFmt.minutes') : t('spellFmt.minute');
  if (unit === 'hours') return plural ? t('spellFmt.heures') : t('spellFmt.heure');
  return plural ? t('spellFmt.jours') : t('spellFmt.jour');
}

export function formatSpellDuration(d: SpellDuration): string {
  switch (d.kind) {
    case 'instant': return t('spellFmt.instant');
    case 'rounds': return t('spellFmt.rounds', { n: fmtMeasure(d.value), unit: d.value === 1 ? t('spellFmt.round') : t('spellFmt.roundsUnit'), plus: d.plus ? t('spellFmt.fragPlus') : '' });
    case 'clock': return t('spellFmt.clock', { n: fmtMeasure(d.value), unit: clockUnit(d.unit, d.value !== 1) });
    case 'untilDawn': return t('spellFmt.untilDawn');
    case 'special': return `${d.text}${d.plus && !/\+\s*$/.test(d.text) ? ' +' : ''}`;
  }
}
