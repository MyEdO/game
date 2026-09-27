import { useGame, type BattleState } from '../state/store';
import { useOwns } from './ownership';
import { easeDifficulty } from '../engine/tests';
import { findCrewRoleById, findCrewTestTypeById, flowStakeRef } from '../data';
import { crewRoleValue, rudeEpreuveMoraleDelta, crewTestSuccess } from '../engine/crewMorale';
import { maneuverCrewTotal } from '../state/shipManeuver';
import type { PendingCrewTest } from '../state/pendings';
import type { Combatant } from '../engine/types';
import { RollShell, type RollAction } from './RollShell';
import type { BuiltRollRow } from './rollRowBuild';
import { buildParticipantRows, rollAllUnrolledRows } from './buildParticipantRows';
import { Icon } from './Icon';
import { testBreakdown, testPending } from './breakdown';
import { resultLine, freeCons } from '../state/rollSeam';

/**
 * Modale du TEST D'ÉQUIPAGE GÉNÉRIQUE en COMBAT (MDG 14, « Types de Test d'équipage ») — JUMEAU de
 * `ShipBatteryModal`/`ShipManeuverModal` (flux MULTI, `RollShell` + `RollRow`), paramétrée par le
 * TYPE (`pendingCrewTest.testTypeId`). Chaque rôle tenu = une rangée ; le bandeau somme les DR (essentiel ×2)
 * + Moral + Manque de bras + sabotage. **Rude épreuve** (l.106-114) : un total NÉGATIF réduit le Moral d'autant
 * (l.110) — la perte est prévisualisée dans le bandeau avant « Appliquer ». Les Tests d'équipage de VOYAGE
 * (hors combat) sont désormais des étapes de la cascade du jour (#275 Ronde 2 cran 3, `CascadeModal`) —
 * CETTE modale sert au SEUL combat.
 */
export function CrewTestModal() {
  const p = useGame((s) => s.pendingCrewTest);
  const battle = useGame((s) => s.battle);
  const party = useGame((s) => s.party);
  const owns = useOwns(); // possession locale à l'affichage (#1262) — hook : AVANT tout retour anticipé
  const roll = useGame((s) => s.crewTestRoll);
  const reroll = useGame((s) => s.crewTestReroll);
  const bonus = useGame((s) => s.crewTestBonusSL);
  const darkPact = useGame((s) => s.crewTestDarkPact);
  const force = useGame((s) => s.crewTestForceSuccess);
  const confirm = useGame((s) => s.crewTestConfirm);
  const cancel = useGame((s) => s.crewTestCancel);
  if (!p) return null;
  return (
    <CrewTestModalView
      p={p} battle={battle} party={party} owns={owns}
      roll={roll} reroll={reroll} bonus={bonus} darkPact={darkPact} force={force}
      confirm={confirm} cancel={cancel}
    />
  );
}

/** Corps PUR (props) — testable en rendu statique sans mocker le store (l'environnement de test est
 *  `node`, sans DOM : les sélecteurs de store ne s'hydratent pas sous `renderToStaticMarkup`). */
export function CrewTestModalView({ p, battle, party, owns, roll, reroll, bonus, darkPact, force, confirm, cancel }: {
  p: PendingCrewTest;
  battle: BattleState | null;
  party: Combatant[];
  owns: (id: string) => boolean;
  roll: (id: string) => void;
  reroll: (id: string) => void;
  bonus: (id: string) => void;
  darkPact: (id: string) => void;
  force: (id: string) => void;
  confirm: () => void;
  cancel: () => void;
}) {
  const pool = battle?.combatants ?? party;
  const ship = battle?.combatants.find((c) => c.id === p.shipId);
  const testType = findCrewTestTypeById(p.testTypeId);
  if (!ship || !testType) return null;

  const allRolled = p.participants.every((x) => x.result);
  const rollAll = rollAllUnrolledRows(p.participants, roll, (x) => !!x.interactive && owns(x.id));
  const total = maneuverCrewTotal(p.participants, p.essentialRoleId, p.moraleScore, p.undercrew, p.extraDR);
  const moraleLoss = testType.moraleOnNegativeDR ? rudeEpreuveMoraleDelta(total) : 0;
  const sign = (n: number) => (n >= 0 ? `+${n}` : `${n}`);

  // Rangées via le builder mutualisé (#328) : la modale ne fournit QUE la PRÉSENTATION (crew-roles) + ses
  // actions ; les fenêtres d'influence sont dérivées au rendu par les prédicats du seam.
  const rows: BuiltRollRow[] = buildParticipantRows(p.participants, pool, {
    onRoll: roll, onReroll: reroll, onBonusSL: bonus, onDarkPact: darkPact, onForce: force,
    interactiveOf: (part) => !!part.interactive && owns(part.id),
    row: (part, actor, res) => {
      const role = findCrewRoleById(part.roleId);
      const val = role ? crewRoleValue(actor, role, part.sense).value : 0;
      const label = `${role?.label ?? part.roleId}${part.essential ? ' ★' : ''}`;
      // Manque de bras (MDG 14 l.53) : marin déjà engagé ce Round → +2 crans de Difficulté (−20), itemisé.
      const difficulty = part.cumul ? easeDifficulty('intermediaire', -2) : undefined;
      return res
        ? { combatant: actor, d: testBreakdown(label, val, { roll: res.roll, target: res.target, sl: res.sl }, difficulty) }
        : { combatant: actor, pending: testPending(label, val, undefined, difficulty) };
    },
    note: (part, _actor, res) => <div className="cs-outcome ok-text">{resultLine(freeCons([part.essential ? `${sign(res.sl)} DR ×2` : `${sign(res.sl)} DR`]))}</div>,
  });

  const actions: RollAction[] = [
    { key: 'cancel', label: 'Annuler', onClick: cancel, when: 'always' },
    ...(rollAll ? [{ key: 'rollAll', label: <><Icon id="nav/dice" size="sm" /> Tout lancer</>, onClick: rollAll, when: 'pre' as const }] : []),
    { key: 'confirm', label: 'Appliquer', onClick: confirm, when: 'always', disabled: !allRolled },
  ];

  return (
    <RollShell
      flowKey="crewTest"
      stake={flowStakeRef('crew-test-roll', { entryId: p.testTypeId })}
      title={<><Icon id="travel/anchor" size="sm" /> {testType.label} — Test d’équipage</>}
      subtitle={<><strong>{ship.label}</strong> — Moral {p.moraleScore}{p.extraDR ? ` · sabotage ${sign(p.extraDR)} DR` : ''}</>}
      extra={p.extraDR
        ? <div className="rm-note" data-ton="menace"><Icon id="ui/warning" size="sm" /> Le Test d’équipage est perturbé : {sign(p.extraDR)} DR (sabotage).</div>
        : undefined}
      rows={rows}
      rolled={allRolled}
      summary={allRolled
        ? <>DR total <b>{sign(total)}</b> — {crewTestSuccess(total) ? 'succès' : 'échec'} (l.13).{moraleLoss ? <> Rude épreuve : <b>{moraleLoss}</b> Moral (l.110).</> : null}</>
        : undefined}
      actions={actions}
      onCancel={cancel}
    />
  );
}
