/**
 * Calendrier impérial WFRP4 (CI) — pur, sans état. Le CONTENU (mois, jours intercalaires, jours de
 * semaine, phases du jour) vit en DONNÉE ÉDITABLE (datasets `calendarMonths`/`calendarIntercalary`/
 * `calendarWeekdays`/`calendarPhases`, éditables au Codex). Ce module ne porte que la MÉCANIQUE
 * temporelle + les scalaires de config (époque, fenêtre de nuit). EDO 12 l.13, l.17, l.19-30, l.32-47, l.60-203.
 *
 * La DÉRIVATION (slots de l'année) est mémoïsée par `memoParVersion` sur les versions de
 * `calendarMonths` et `calendarIntercalary` (`src/data/versionDataset.ts`).
 * Les datasets-tableaux sont mutés EN PLACE (splice) → les réfs exportées (`IMPERIAL_MONTHS`,
 * `DAY_PHASES`, `WEEKDAYS`) restent valides et live.
 */
import type { IconId } from '../data/schemas/icons';
import type { DureeEnJours } from '../data/schemas/grammaire/valeurs';
import { calendarMonths, calendarIntercalary, calendarWeekdays, calendarPhases } from '../data';
import { findTierEntry } from './tables';
import { memoParVersion } from '../data/versionDataset';
import { garanti } from '../lib/garanti';

export interface ImperialMonth { label: string; days: number; }

/** Mois, jours intercalaires, jours de semaine — DONNÉE éditable (réfs live via mutation en place). */
export const IMPERIAL_MONTHS: ImperialMonth[] = calendarMonths;
export const INTERCALARY: { id: string; label: string; afterMonth: number }[] = calendarIntercalary;
export const WEEKDAYS: { id: string; label: string }[] = calendarWeekdays;

/** EDO 12 l.19-30 ; MDG 15 l.268 */
export function joursParSemaine(): number { return WEEKDAYS.length; }

/** Convertit une durée déclarée en jours ou en semaines vers des jours. */
export function dureeEnJours(duree: DureeEnJours): number {
  return typeof duree === 'number' ? duree : duree.semaines * joursParSemaine();
}

/** Nombre de semaines entières dans une durée en jours. */
export function semainesCompletes(jours: number): number { return Math.floor(jours / joursParSemaine()); }

/** Cette durée en jours se termine-t-elle au terme d'une semaine entière ? */
export function termineUneSemaine(jours: number): boolean { return jours > 0 && jours % joursParSemaine() === 0; }

export const MINUTES_PER_DAY = 24 * 60;

/** Durée en minutes d'une semaine impériale. */
export function minutesParSemaine(): number { return joursParSemaine() * MINUTES_PER_DAY; }

export const EPOCH_YEAR = 2512; // minute 0 = Hexenstag 2512 00:00 (scalaire de config)

/** Un « slot de jour » de l'année : soit un jour intercalaire (par id), soit un (index de mois, jour). */
type YearSlot = { intercalaire: string } | { mois: number; day: number };

/** Recalcule la structure de l'année depuis les tables de DONNÉE (mois + intercalaires). */
function buildYearData() {
  const slots: YearSlot[] = [];
  const inter = (after: number) => calendarIntercalary.filter((i) => i.afterMonth === after);
  for (const i of inter(-1)) slots.push({ intercalaire: i.id }); // intercalaires avant le 1er mois (Hexenstag)
  for (let m = 0; m < calendarMonths.length; m++) {
    for (let d = 1; d <= calendarMonths[m].days; d++) slots.push({ mois: m, day: d });
    for (const i of inter(m)) slots.push({ intercalaire: i.id });
  }
  // Jours de MOIS qui précèdent chaque slot (un intercalaire n'avance pas la semaine — elle enjambe les fêtes).
  const monthDaysBeforeSlot: number[] = [];
  let c = 0;
  for (const slot of slots) { monthDaysBeforeSlot.push(c); if (!('intercalaire' in slot)) c++; }
  return {
    slots,
    monthDaysBeforeSlot,
    daysPerYear: slots.length, // 394 (mois) + intercalaires
    monthDaysPerYear: calendarMonths.reduce((s, m) => s + m.days, 0), // jours de mois (hors semaine = HS intercalaires)
  };
}

/** Dérivation MÉMOÏSÉE sur la version des tables (`memoParVersion`) → recalcul à l'édition au Codex. */
const yearData = memoParVersion(['calendarMonths', 'calendarIntercalary'], buildYearData);

/** Nombre de jours dans l'année impériale (live — dérivé des tables). */
export const daysPerYear = (): number => yearData().daysPerYear;

/** Entrée nommée d'un dataset du calendrier (`calendarMonths`, `calendarIntercalary`, `calendarWeekdays`). */
export interface NomDuCalendrier { id: string; nom: string }

/** Date impériale : un jour intercalaire est hors du mois et du cycle hebdomadaire (EDO 12 l.60-203). */
export type ImperialDate = { year: number; hour: number; minute: number } & (
  | { intercalaire: NomDuCalendrier; mois: null; day: null; semaine: null }
  | { intercalaire: null; mois: NomDuCalendrier & { index: number }; day: number; semaine: NomDuCalendrier }
);

/** Forme d'entrée de `fromDate` : index 0-based du mois et jour 1-based, ou id d'intercalaire. */
export type DateDuCalendrier = { year: number; hour: number; minute: number } & ({ mois: number; day: number } | { intercalaire: string });

const nomDuCalendrier = (e: { id: string; label: string }): NomDuCalendrier => ({ id: e.id, nom: e.label });

/** Minutes depuis l'époque → date impériale. */
export function toDate(minutes: number): ImperialDate {
  const yd = yearData();
  const totalDays = Math.floor(minutes / MINUTES_PER_DAY);
  const minOfDay = minutes - totalDays * MINUTES_PER_DAY;
  const year = EPOCH_YEAR + Math.floor(totalDays / yd.daysPerYear);
  const dayOfYear = ((totalDays % yd.daysPerYear) + yd.daysPerYear) % yd.daysPerYear;
  const slot = yd.slots[dayOfYear];
  // Semaine CONTINUE qui enjambe les intercalaires : seuls les jours de MOIS comptent ; un intercalaire
  // est hors du cycle (semaine = null). Ancre : 1 Nachhexen 2512 = 1er jour de semaine (convention).
  const week = joursParSemaine();
  const monthDaysElapsed = (year - EPOCH_YEAR) * yd.monthDaysPerYear + yd.monthDaysBeforeSlot[dayOfYear];
  const base = { year, hour: Math.floor(minOfDay / 60), minute: minOfDay % 60 };
  if ('intercalaire' in slot) {
    const inter = garanti(INTERCALARY.find((i) => i.id === slot.intercalaire), slot.intercalaire, 'jour intercalaire');
    return { ...base, intercalaire: nomDuCalendrier(inter), mois: null, day: null, semaine: null };
  }
  const semaine = nomDuCalendrier(WEEKDAYS[((monthDaysElapsed % week) + week) % week]);
  return { ...base, intercalaire: null, mois: { ...nomDuCalendrier(calendarMonths[slot.mois]), index: slot.mois }, day: slot.day, semaine };
}

/** Date impériale → minutes depuis l'époque (inverse de toDate). */
export function fromDate(d: DateDuCalendrier): number {
  const yd = yearData();
  const dayOfYear = yd.slots.findIndex((s) =>
    'intercalaire' in d ? 'intercalaire' in s && s.intercalaire === d.intercalaire
      : 'mois' in s && s.mois === d.mois && s.day === d.day,
  );
  const totalDays = (d.year - EPOCH_YEAR) * yd.daysPerYear + dayOfYear;
  return totalDays * MINUTES_PER_DAY + d.hour * 60 + d.minute;
}

/** « 30 Jahrdrung 2512 CI » ou « Hexenstag 2512 CI » (intercalaire). */
export const jourImperial = (d: ImperialDate): string =>
  (d.intercalaire ? `${d.intercalaire.nom} ${d.year} CI` : `${d.day} ${d.mois.nom} ${d.year} CI`);

/** « 30 Jahrdrung 2512 CI · 14:30 » ou « Hexenstag 2512 CI · 08:00 » (intercalaire). */
export function formatImperial(minutes: number): string {
  const d = toDate(minutes);
  return `${jourImperial(d)} · ${String(d.hour).padStart(2, '0')}:${String(d.minute).padStart(2, '0')}`;
}

/** « Festag · 30 Jahrdrung 2512 CI », ou « Hexenstag 2512 CI » (un intercalaire est hors de la semaine). */
export function formatJourImperial(minutes: number): string {
  const d = toDate(minutes);
  return d.semaine ? `${d.semaine.nom} · ${jourImperial(d)}` : jourImperial(d);
}

/** Début de la campagne (EiS) : dernier jour de Jahrdrung 2512, 08:00 (« fin Jahrdrung », année défaut WFRP4). */
export const campaignStart = memoParVersion(['calendarMonths', 'calendarIntercalary', 'calendarWeekdays'], () => fromDate({
  year: 2512, mois: 1, day: IMPERIAL_MONTHS[1].days, hour: 8, minute: 0,
}));

// ─── Phases du jour (#T1c) ─── affichage riche, découplé de l'obscurité mécanique ───
export type DayPhaseId = 'aube' | 'matin' | 'midi' | 'apresmidi' | 'crepuscule' | 'soir' | 'nuit';
export interface DayPhase { id: DayPhaseId; label: string; icon: IconId; isNight: boolean; }

/** Phases d'AFFICHAGE (palier `seuil` en minutes-de-jour + libellé + icône) — DONNÉE éditable, réf live.
 *  'nuit' enjambe minuit (00:00–05:00). Le canon est muet sur l'heure exacte du lever/coucher. */
export const DAY_PHASES: { id: DayPhaseId; seuil: number; label: string; icon: IconId }[] =
  calendarPhases as { id: DayPhaseId; seuil: number; label: string; icon: IconId }[];

/**
 * Heure de début d'une phase ANCRE, résolue par son id. PURE (les phases sont un paramètre) : sa
 * branche d'erreur est atteignable en test, elle n'est pas du texte mort.
 *
 * Le résolveur VALIDE (fail-fast) : il ne retombe sur rien. Un repli positionnel désignerait une
 * AUTRE phase que celle demandée et rendrait une heure fausse en silence — une donnée amputée pète
 * ici, à la première lecture de son ancre.
 */
export function ancreDePhase(phases: readonly { id: string; seuil: number }[], id: DayPhaseId): number {
  const phase = phases.find((p) => p.id === id);
  if (!phase) {
    throw new Error(
      `clock: phase d'ancre « ${id} » absente de calendarPhases.json (ids présents : ` +
        `${phases.map((p) => p.id).join(', ') || '(aucun)'}).`,
    );
  }
  return phase.seuil;
}

/** Fenêtre d'OBSCURITÉ mécanique (combat −20 tir / rendu sombre), DÉCOUPLÉE des phases d'affichage.
 *  [start,end) en minutes-de-jour ; enjambe minuit (22:00 → 05:00). Scalaire de config. */
export const NIGHT_WINDOW = { start: 22 * 60, end: 5 * 60 } as const;

const minuteOfDay = (minutes: number) => ((minutes % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY;

/** Obscurité ? (seul seuil mécanique). Vrai si l'heure du jour ∈ NIGHT_WINDOW (qui enjambe minuit). */
export function isNight(minutes: number): boolean {
  const m = minuteOfDay(minutes);
  return m >= NIGHT_WINDOW.start || m < NIGHT_WINDOW.end;
}

/** Phase d'affichage pour une heure donnée (`findTierEntry`) ; avant le plus bas palier, la phase du
 *  plus HAUT, qui enjambe minuit. */
export function dayPhase(minutes: number): DayPhase {
  const chosen = findTierEntry(DAY_PHASES, minuteOfDay(minutes)) ?? findTierEntry(DAY_PHASES, Number.POSITIVE_INFINITY)!;
  return { id: chosen.id, label: chosen.label, icon: chosen.icon, isNight: isNight(minutes) };
}

/** Minutes à avancer pour atteindre la PROCHAINE occurrence (toujours en avant) de l'heure-du-jour
 *  cible. 0 si on y est déjà. Le temps ne recule jamais (« tout est horodaté »). */
export function minutesUntilNext(currentMinutes: number, targetMinuteOfDay: number): number {
  return (minuteOfDay(targetMinuteOfDay) - minuteOfDay(currentMinutes) + MINUTES_PER_DAY) % MINUTES_PER_DAY;
}

/** Heure de l'aube (minutes-de-jour) — fin d'une nuit de sommeil ; cible du « Dormir ». */
export const dawnMinute = memoParVersion('calendarPhases', () => ancreDePhase(DAY_PHASES, 'aube'));

/** L'heure du réveil après `nuits` nuits de sommeil commencées à `from` : la première court jusqu'à
 *  l'aube suivante (un jour plein si l'on y est), chacune des autres dure un jour. */
export function aubeApresNuits(from: number, nuits: number): number {
  const premiere = minutesUntilNext(from, dawnMinute()) || MINUTES_PER_DAY;
  return from + premiere + (Math.max(1, Math.floor(nuits)) - 1) * MINUTES_PER_DAY;
}

/** Heure du crépuscule (minutes-de-jour) — fin d'une journée de voyage AVANT la halte de nuit : le
 *  jour de navigation (fluvial/maritime) s'arrête ici, puis la nuit de sommeil enjambe minuit jusqu'à
 *  l'aube — un seul franchissement de jour par cycle voyage+nuit (aligné sur le voyage terrestre). */
export const duskMinute = memoParVersion('calendarPhases', () => ancreDePhase(DAY_PHASES, 'crepuscule'));

/** Créneau de DÉPART d'un voyage terrestre/fluvial : de l'aube au crépuscule (`[dawnMinute, duskMinute)`). Sert à
 *  la porte de départ maison (canon muet — arbitrage #340) : partir de nuit propose « Attendre l'aube ». */
export function isTravelDaylight(minutes: number): boolean {
  const m = minuteOfDay(minutes);
  return m >= dawnMinute() && m < duskMinute();
}

/** Jour courant de l'horloge (index de jour absolu depuis l'époque). */
export function dayIndex(gameTime: number): number { return Math.floor(gameTime / MINUTES_PER_DAY); }

/** Spécification d'échéance d'un effet/objectif programmé — RÉSOLUE en minute absolue par `scheduleAt`.
 *  Priorité : atDate > afterDays > afterMinutes > (atHour/atMinute seuls = prochaine occurrence). */
export interface ScheduleSpec {
  afterMinutes?: number;
  /** Dans N jours (à partir d'AUJOURD'HUI), à l'heure `atHour:atMinute` (défaut minuit). */
  afterDays?: number;
  /** Date impériale ABSOLUE (année défaut = année courante de la partie). */
  atDate?: { year?: number; month: number; day: number; hour?: number; minute?: number };
  atHour?: number;
  atMinute?: number;
}

/** Résout une `ScheduleSpec` en minute absolue `gameTime`. Source UNIQUE (delayedEffect ET setObjective). */
export function scheduleAt(now: number, spec: ScheduleSpec): number {
  if (spec.atDate) {
    const y = spec.atDate.year ?? toDate(now).year;
    return fromDate({ year: y, mois: spec.atDate.month, day: spec.atDate.day, hour: spec.atDate.hour ?? 0, minute: spec.atDate.minute ?? 0 });
  }
  if (spec.afterDays != null) return (dayIndex(now) + spec.afterDays) * MINUTES_PER_DAY + (spec.atHour ?? 0) * 60 + (spec.atMinute ?? 0);
  if (spec.afterMinutes != null) return now + Math.max(0, spec.afterMinutes);
  return now + minutesUntilNext(now, (spec.atHour ?? 0) * 60 + (spec.atMinute ?? 0));
}
