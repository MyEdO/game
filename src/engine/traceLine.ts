/**
 * DÉRIVEUR de la LIGNE DE DÉ du journal (#1262 V3 Lj) — la ligne se DÉRIVE de la structure de jet
 * (porteur, libellé, dé/cible, DR, issue), elle ne s'écrit pas au site.
 *
 * Un jet dont AUCUNE surface n'a montré le dé (rangée résolue d'office d'une bande, étape mono d'un
 * pilote immédiat, repli sans pilote humain, sous-jet interne) a le journal pour SEULE surface : la
 * ligne y porte donc le dé, la cible, l'issue et le DR — au PATRON UNIQUE (`casc.autoRowTrace` et ses
 * variantes sans porteur / sans DR), jamais à la main.
 *
 * DEUX FORMES, un seul dériveur :
 *  - SIMPLE (`TraceRow`) : un jet, une ligne ;
 *  - OPPOSÉE (`TraceOpposed`, #1294) : les DEUX jets d'une même opposition sur UNE ligne
 *    (`casc.opposedTrace`) — Test opposé résolu inline, où ni l'attaquant ni le défenseur n'a de rangée.
 *
 * `issue` : le domaine peut fournir son verdict en clair (« il tient bon », « le Sort est DISSIPÉ ») ;
 * à défaut, réussi/échec (simple) ou, pour l'opposée, l'une des TROIS issues de `resolveOpposed` —
 * résiste / l'emporte / égalité parfaite (statu quo, `LDB 12 l.160`). Le patron ne lui appartient pas.
 */
import { t, deElide } from '../i18n';
import { DIFFICULTY_LABELS, type Difficulty } from './types';
import type { VainqueurOppose } from './tests';
import type { PlayerText } from '../i18n/playerText';

/** Structure LUE par le dériveur — celle qu'une rangée/étape porte déjà (`CascadeRoll`, `TestResult`). */
export interface TraceRow {
  /** Porteur du jet, nommé par `nomDe` (#4017). Absent → le libellé nomme déjà qui lance. */
  who?: PlayerText;
  /** Libellé du jet (Compétence/Caractéristique testée, avec sa situation). Défaut : « Test ». */
  label?: string;
  roll: number;
  target: number;
  /** Degré de Réussite. Absent → le jet n'en porte pas (tirage de disponibilité…). */
  sl?: number;
  /** DR ACCORDÉ en sus, affiché tel quel — Piège-lame (LDB 62 l.280). */
  slBonus?: number;
  success: boolean;
  /** Verdict en clair du domaine. Défaut : réussi/échec. */
  issue?: string;
}

/** Un CAMP d'un Test opposé — même anatomie qu'une `TraceRow`, sans issue propre (elle est commune). */
export type TraceSide = Omit<TraceRow, 'success' | 'issue' | 'who' | 'label' | 'sl'>
  & { who: PlayerText; label: string; sl: number };

/** Les DEUX jets d'une même opposition, sur UNE ligne. */
export interface TraceOpposed {
  attacker: TraceSide;
  defender: TraceSide;
  /** Verdict de `resolveOpposed` — TROIS issues (LDB 12 l.160) : le défenseur RÉSISTE, l'attaquant
   *  L'EMPORTE, ou ÉGALITÉ parfaite (même DR ET même valeur nue) → statu quo, rien ne se passe. */
  winner: VainqueurOppose;
  /** Verdict en clair du domaine. Défaut : résiste / l'emporte / égalité — statu quo. */
  issue?: string;
}

/** DR affiché : signé, suivi du bonus ACCORDÉ quand il y en a un. `null` = le jet n'en porte pas. */
function drOf(sl: number | undefined, slBonus?: number): string | null {
  if (sl == null) return null;
  return `${sl >= 0 ? '+' : ''}${sl}${slBonus ? `+${slBonus}` : ''}`;
}

/** LA ligne de dé d'un jet — ou d'une opposition —, au patron unique. */
export function traceLineOf(row: TraceRow | TraceOpposed): string {
  if ('attacker' in row) return opposedLine(row);
  const dr = drOf(row.sl, row.slBonus);
  const key = row.who
    ? (dr != null ? 'casc.autoRowTrace' : 'casc.rowTraceNoDr')
    : (dr != null ? 'casc.rowTraceAnon' : 'casc.rowTraceAnonNoDr');
  return t(key, {
    ...(row.who != null ? { who: row.who } : {}),
    label: row.label ?? t('casc.autoRowFallbackLabel'),
    roll: row.roll,
    target: row.target,
    issue: row.issue ?? t(row.success ? 'casc.autoRowHit' : 'casc.autoRowMiss'),
    ...(dr != null ? { dr } : {}),
  });
}

/** Structure LUE par le dériveur d'un DÉ NU (#1508) — celle qu'une étape à dé porte déjà
 *  (`CascadeDeDecl` + `CascadeDeResult`). Ni cible ni DR : un dé nu ne se réussit pas, son TOTAL
 *  EST la conséquence. */
export interface TraceDie {
  /** Porteur du dé, nommé par `nomDe` (#4017). Absent → le monde tire, le libellé suffit. */
  who?: PlayerText;
  /** Ce qui se tire (« Hauteur de chute »). Défaut : « Tirage ». */
  label?: string;
  roll: number;
  total: number;
  /** Unité du total (« m », « jours ») — accolée au total, absente = total nu. */
  unite?: string;
}

/** LA ligne de journal d'un DÉ NU résolu sans fenêtre (#1508) — même patron unique que `traceLineOf`
 *  pour les jets : le socle la DÉRIVE de la structure, aucun site ne l'écrit. */
export function traceDieLineOf(d: TraceDie): string {
  return t(d.who ? 'casc.dieTrace' : 'casc.dieTraceAnon', {
    ...(d.who != null ? { who: d.who } : {}),
    label: d.label ?? t('casc.dieTraceLabel'),
    roll: d.roll,
    total: d.unite ? `${d.total} ${d.unite}` : d.total,
  });
}

/** Issue par DÉFAUT d'une opposition, vue du DÉFENSEUR (le jeteur) — table TOTALE sur les trois
 *  verdicts de `resolveOpposed` : aucun `winner` ne peut sortir sans phrase. */
const OPPOSED_ISSUE_KEY: Record<TraceOpposed['winner'], 'casc.opposedResists' | 'casc.opposedPrevails' | 'casc.opposedTie'> = {
  defenseur: 'casc.opposedResists',
  attaquant: 'casc.opposedPrevails',
  egalite: 'casc.opposedTie',
};

function opposedLine(o: TraceOpposed): string {
  return t('casc.opposedTrace', {
    who: o.attacker.who, label: o.attacker.label, roll: o.attacker.roll, target: o.attacker.target,
    dr: drOf(o.attacker.sl, o.attacker.slBonus)!,
    who2: o.defender.who, label2: o.defender.label, roll2: o.defender.roll, target2: o.defender.target,
    dr2: drOf(o.defender.sl, o.defender.slBonus)!,
    issue: o.issue ?? t(OPPOSED_ISSUE_KEY[o.winner]),
  });
}

/** Libellé de ligne d'un Test résolu SANS fenêtre : la Compétence/Caractéristique lancée AVEC sa
 *  Difficulté — aucune rangée ne s'étant ouverte, la ligne est le seul endroit où elle se lit. */
export function testTraceLabel(what: string, difficulty: Difficulty): string {
  return t('casc.traceTestLabel', { sujet: deElide(what), diff: DIFFICULTY_LABELS[difficulty] });
}
