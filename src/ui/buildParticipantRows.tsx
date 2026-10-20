import type { ReactNode } from 'react';
import { Stack } from './Layout';
import type { Combatant } from '../engine/types';
import { refLabel, findCrewRoleById } from '../data';
import type { PanelRowData } from './RollPanel';
import { participantRow, type BuiltRollRow } from './rollRowBuild';
import { refusSansJet, easeDifficulty, type EchecSansJet } from '../engine/tests';
import type { PlayerText } from '../i18n/playerText';
import type { ShipManeuverParticipant } from '../noyau/pendings';
import { crewRoleValue, crewRoleTestMods } from '../engine/crewMorale';
import { testBreakdown, testPending } from './breakdown';

/**
 * SOURCE UNIQUE des rangées-participants d'une modale MULTI (#328) : `CascadeModal` batch,
 * `CrewTestModal`, `ShipBatteryModal`, `ShipManeuverModal`, `ForceDoorModal`, `DisengageModal`.
 * Chaque modale ne fournit QUE la PRÉSENTATION de sa rangée (`row`, propre à son vocabulaire de
 * données) + son bundle d'actions de flux.
 *
 * Aucune éligibilité d'influence n'est montée ici : les fenêtres de la Chance, du Sombre Pacte et de
 * la Résilience sont des prédicats purs du seam (`noyau/rollFlowFactory.ts`), appliqués au rendu à
 * partir de la ligne posée et de `rerolled`.
 */
export interface ParticipantRow {
  id: string;
  /** Compétence RÉELLEMENT lancée (paire id + spécialisation) — le libellé de ligne s'en DÉRIVE. */
  skillId?: string;
  spec?: string;
  interactive?: boolean;
  rerolled?: boolean;
  /** `EchecSansJet` : ligne non tentable, résolue sans dé (LDB 09 l.30) — la rangée rend son `refus`. */
  result: { roll: number; target: number; sl: number; success?: boolean } | EchecSansJet | null;
  refus?: PlayerText;
}

/** Issue d'une rangée dont le dé est TOMBÉ (ou pas encore) — jamais la ligne non tentable. */
type ResultatJete<P extends ParticipantRow> = Exclude<P['result'], EchecSansJet>;

export interface ParticipantRowBundle<P extends ParticipantRow> {
  /** Actions de flux du domaine (routées par id de participant). */
  onRoll: (id: string) => void;
  onReroll: (id: string) => void;
  onBonusSL: (id: string) => void;
  onDarkPact: (id: string) => void;
  onForce: (id: string) => void;
  /** PRÉSENTATION de la rangée (pré-jet en attente puis résultat) — propre au vocabulaire de la modale. */
  row: (part: P, actor: Combatant, res: ResultatJete<P>) => PanelRowData;
  /** Rangée INTERACTIVE ? (défaut : `part.interactive !== false`). Le naval y greffe le gate `owns`. */
  interactiveOf?: (part: P, actor: Combatant) => boolean;
  /** Issue courte sous la ligne (DR ×2 essentiel…) — rendue APRÈS le jet seulement, dans le CANAL
   *  UNIQUE de sous-ligne (`PanelRowData.note`, `.rr-note`). */
  note?: (part: P, actor: Combatant, res: NonNullable<ResultatJete<P>>) => ReactNode;
  /** ISSUES de la rangée (#1117) — les deux branches annoncées AVANT le jet, la branche réalisée APRÈS :
   *  rendue aux DEUX phases (c'est ce qui la distingue de `note`, qui ne dit que la conséquence subie).
   *  Elle occupe la MÊME sous-ligne, en tête ; un site qui fournit les deux les empile dans cet ordre. */
  issues?: (part: P, actor: Combatant, res: ResultatJete<P>) => ReactNode;
  /** DONNÉE de Test ÉTENDU d'une rangée (cartographie de voyage…) : la barre est rendue par `RollRow`
   *  (site UNIQUE), visible avant/après le jet et persistante. Le bundle ne pose que la donnée. */
  extendedDrOf?: (part: P, actor: Combatant) => { cum: number; target: number } | undefined;
  /** Libellé du bouton « Lancer » de rangée (ex. « Frapper » pour l'enfoncement de porte). */
  rollLabel?: ReactNode;
}

/** Action « Tout lancer » PAR RANGÉES (mutualisée #328) : lance d'un coup toutes les rangées
 *  INTERACTIVES non encore lancées — renvoyée seulement s'il en reste ≥ 2 (en deçà, le bouton « Lancer »
 *  par rangée suffit). `null` sinon. Consommée par les modales MULTI (batch cascade + naval). */
export function rollAllUnrolledRows<P extends ParticipantRow>(
  participants: P[],
  roll: (id: string) => void,
  isInteractive: (p: P) => boolean = (p) => p.interactive !== false,
): (() => void) | null {
  const unrolled = participants.filter((p) => isInteractive(p) && !p.result);
  return unrolled.length >= 2 ? () => unrolled.forEach((p) => roll(p.id)) : null;
}

/** Rangée TÉMOIN d'une ligne née sans jet (`refusSansJet`) : ni dé ni influence, son refus NOMMÉ en note.
 *  `undefined` pour une ligne tentable. Rendu UNIQUE des rangées multi et de l'étape mono (`CascadeModal`). */
export function rangeeSansJet(key: string, actor: Combatant | undefined, ligne: { result?: object | null; refus?: PlayerText }): BuiltRollRow | undefined {
  const refus = refusSansJet(ligne);
  return refus == null ? undefined : participantRow({ key, actor, row: { combatant: actor, note: refus }, interactive: false });
}

export function buildParticipantRows<P extends ParticipantRow>(
  participants: P[],
  pool: Combatant[],
  bundle: ParticipantRowBundle<P>,
): BuiltRollRow[] {
  return participants.flatMap((part) => {
    const actor = pool.find((c) => c.id === part.id);
    if (!actor) return [];
    const temoin = rangeeSansJet(part.id, actor, part);
    if (temoin) return [temoin];
    const res = part.result as ResultatJete<P>;
    const extendedDr = bundle.extendedDrOf?.(part, actor);
    // Z5 (docs/charte-ui.md) — SOURCE UNIQUE du libellé de LIGNE d'une rangée-participant : la
    // Compétence lancée, DÉRIVÉE de la paire `{skillId, spec}` par le résolveur canonique (« Voile
    // (Chaland) »). Le producteur ne fournit plus de libellé libre : un `part.label` ne peut plus
    // faire passer un RÔLE (« Timonier ») pour la Compétence (#1117).
    const skillLabel = part.skillId ? refLabel('skills', { id: part.skillId, spec: part.spec }) : undefined;
    const panelRow0 = bundle.row(part, actor, res);
    const panelRow = skillLabel
      ? {
          ...panelRow0,
          ...(panelRow0.d ? { d: { ...panelRow0.d, label: skillLabel } } : {}),
          ...(panelRow0.pending ? { pending: { ...panelRow0.pending, label: skillLabel } } : {}),
        }
      : panelRow0;
    const note = bundle.note && res ? bundle.note(part, actor, res) : undefined;
    const issues = bundle.issues ? bundle.issues(part, actor, res) : undefined;
    // Sous-ligne UNIQUE de la rangée : les issues (avant/après le jet) puis la conséquence subie.
    const sub = issues != null && note != null
      ? <Stack gap="xs">{issues}<div>{note}</div></Stack>
      : issues ?? note ?? undefined;
    // La rangée naît de la PORTE (#1262) — `rolled` y est dérivé de la donnée affichée (`row.d`),
    // définition unique du socle : le multi ne la recalcule plus depuis `part.result`.
    return [participantRow({
      key: part.id,
      actor,
      row: sub != null ? { ...panelRow, note: sub } : panelRow,
      interactive: bundle.interactiveOf ? bundle.interactiveOf(part, actor) : part.interactive !== false,
      ...(bundle.rollLabel != null ? { rollLabel: bundle.rollLabel } : {}),
      onRoll: () => bundle.onRoll(part.id),
      rerolled: !!part.rerolled,
      onReroll: () => bundle.onReroll(part.id),
      onBonusSL: () => bundle.onBonusSL(part.id),
      onDarkPact: () => bundle.onDarkPact(part.id),
      onForce: () => bundle.onForce(part.id),
      ...(extendedDr ? { extendedDr } : {}),
    })];
  });
}

/** PRÉSENTATION d'une rangée de Test d'équipage par rôle (MDG 14) — les trois modales navales
 *  (`CrewTestModal`, `ShipBatteryModal`, `ShipManeuverModal`). Une rangée dont le rôle est non tentable
 *  (`crewRoleValue`, la source que lit `rollCrewRole`) MONTRE son refus, dé jeté ou non : `CrewRoleValue`
 *  interdit sa valeur, il n'y a donc ni valeur 0 ni dé contre une cible (LDB 09 l.30 ; #2588 Q1). Sinon,
 *  un dé déjà JETÉ s'affiche tel qu'il est tombé, contre sa cible. Manque de bras : MDG 14 l.53. */
export function crewRoleRow(part: ShipManeuverParticipant, actor: Combatant, res: { roll: number; target: number; clamped?: number; sl: number } | null): PanelRowData {
  const role = findCrewRoleById(part.roleId);
  if (!role) return { combatant: actor };
  const rv = crewRoleValue(actor, role, part.navigation, part.sense);
  const label = `${role.label}${part.essential ? ' ★' : ''}`;
  const difficulty = part.cumul ? easeDifficulty('intermediaire', -2) : undefined;
  if (rv.refus != null) return { combatant: actor, note: rv.refus };
  const mods = crewRoleTestMods(actor, role, part.navigation, part.sense);
  return res
    ? { combatant: actor, d: testBreakdown(label, rv.value, res, difficulty, mods) }
    : { combatant: actor, pending: testPending(label, rv.value, undefined, difficulty, mods) };
}
