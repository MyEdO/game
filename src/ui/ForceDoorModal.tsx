import { useGame } from '../state/store';
import { useOwns } from './ownership';
import { testValue } from '../engine/skills';
import { RollShell, type RollAction } from './RollShell';
import type { BuiltRollRow } from './rollRowBuild';
import { buildParticipantRows } from './buildParticipantRows';
import { testBreakdown, testPending } from './breakdown';
import { Icon } from './Icon';
import { resultLine, freeCons } from '../noyau/rollSeam';
import { libelleDeTest } from '../noyau/jetsEnVue';

/**
 * Modale « Enfoncer une porte à PLUSIEURS » (EDO Appendice 2) — flux MULTI PARALLÈLE, pendant exact
 * du Contre-sort mais métier = DÉGÂTS sur objet. La porte est un objet (BE / B) ; chaque héros frappe
 * INDÉPENDAMMENT (Test de Corps à corps (Bagarre), dégâts = DR + BF − BE, pas de min 1) avec son
 * propre cycle Chance/+1 DR/Pacte/Résilience. À l'« Appliquer », la somme des dégâts ronge les
 * Blessures ; la porte cède à ≤ 0, sinon un nouveau Round s'ouvre. COOP : chacun ne pilote QUE ses héros.
 */
export function ForceDoorModal() {
  const battle = useGame((s) => s.battle);
  const party = useGame((s) => s.party);
  const owns = useOwns(); // possession locale à l'affichage (#1262) — hook : AVANT tout retour anticipé
  const p = useGame((s) => s.pendingForceDoor);
  const roll = useGame((s) => s.forceDoorRoll);
  const reroll = useGame((s) => s.forceDoorReroll);
  const bonusSL = useGame((s) => s.forceDoorBonusSL);
  const darkPact = useGame((s) => s.forceDoorDarkPact);
  const force = useGame((s) => s.forceDoorForceSuccess);
  const confirm = useGame((s) => s.forceDoorConfirm);
  const cancel = useGame((s) => s.forceDoorCancel);
  if (!p) return null;
  const pool = battle?.combatants ?? party;
  const roundDmg = p.participants.reduce((s, x) => s + (x.result?.damage ?? 0), 0);
  const allRolled = p.participants.every((x) => x.result);
  const cede = roundDmg >= p.doorB;

  // Rangées via le builder mutualisé (#328) — présentation « Bagarre » ici, éligibilité dans le builder.
  const rows: BuiltRollRow[] = buildParticipantRows(p.participants, pool, {
    onRoll: roll, onReroll: reroll, onBonusSL: bonusSL, onDarkPact: darkPact, onForce: force,
    interactiveOf: (part) => owns(part.id),
    rollLabel: <><Icon id="action/attack" size="sm" /> Frapper</>,
    row: (_part, actor, res) => {
      const val = testValue(actor, 'corps-a-corps');
      return res
        ? { combatant: actor, d: testBreakdown(libelleDeTest('bagarre'), val, { roll: res.roll, target: res.target, sl: res.sl }) }
        : { combatant: actor, pending: testPending(libelleDeTest('bagarre'), val) };
    },
    note: (_part, _actor, res) => <div className={`cs-outcome ${res.damage > 0 ? 'ok-text' : 'muted'}`}>{resultLine(freeCons([res.damage > 0 ? `−${res.damage} Blessure${res.damage > 1 ? 's' : ''}` : 'Rebondit (0 dégât)']))}</div>,
  });

  const actions: RollAction[] = [
    { key: 'cancel', label: 'Renoncer', onClick: cancel, verbe: 'cancel' },
    { key: 'confirm', label: cede ? 'Enfoncer !' : 'Appliquer le Round', onClick: confirm, verbe: 'apply' },
  ];

  return (
    <RollShell
      flowKey="forceDoor"
      title={<><Icon id="map-tool/door" size="sm" /> Enfoncer la porte</>}
      subtitle={<><strong>{p.label}</strong> — Endurance {p.doorBE} · Blessures {p.doorB}/{p.doorBmax}</>}
      instruction="Chacun frappe — Corps à corps (Bagarre), dégâts = DR + Bonus de Force − BE"
      rows={rows}
      rolled={allRolled}
      summary={allRolled ? <>Ce Round : <b>{roundDmg}</b> dégât{roundDmg > 1 ? 's' : ''}{cede ? ' → la porte cède !' : ` (reste ${p.doorB - roundDmg})`}</> : undefined}
      actions={actions}
      onCancel={cancel}
    />
  );
}
