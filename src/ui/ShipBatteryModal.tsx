import { useGame } from '../state/store';
import { useOwns } from './ownership';
import { maneuverCrewTotal } from '../noyau/shipManeuver';
import { RollShell, type RollAction } from './RollShell';
import type { BuiltRollRow } from './rollRowBuild';
import { buildParticipantRows, rollAllUnrolledRows, crewRoleRow } from './buildParticipantRows';
import { Icon } from './Icon';
import { t } from '../i18n';
import { useGesteDeJet } from './useGesteDeJet';

/**
 * Modale du TIR DE BATTERIE (« bordée », MDG 14 l.128) — JUMEAU de `ShipManeuverModal` (flux MULTI,
 * `RollShell` + `RollRow`). Chaque Artilleur tenu = une rangée (PJ influençable / marin témoin) ;
 * le bandeau somme les DR (essentiel ×2) + Moral → le **DR PARTAGÉ** qui s'applique à TOUTES les pièces du bord
 * (l.128). Pas de virage : `extra` montre la cible + les pièces qui tirent. « Feu ! » résout la volée (`jetValider('tirDeBatterie')`).
 */
export function ShipBatteryModal() {
  const p = useGame((s) => s.pendingShipBattery);
  const battle = useGame((s) => s.battle);
  const owns = useOwns(); // possession locale à l'affichage (#1262) — hook : AVANT tout retour anticipé
  const roll = useGesteDeJet('jetLancer', 'tirDeBatterie');
  const reroll = useGesteDeJet('jetRelancer', 'tirDeBatterie');
  const bonus = useGesteDeJet('jetAjouterUnDR', 'tirDeBatterie');
  const darkPact = useGesteDeJet('jetPactiser', 'tirDeBatterie');
  const force = useGesteDeJet('jetForcerLaReussite', 'tirDeBatterie');
  const confirm = useGesteDeJet('jetValider', 'tirDeBatterie');
  const cancel = useGesteDeJet('jetAnnuler', 'tirDeBatterie');
  if (!p || !battle) return null;
  const ship = battle.combatants.find((c) => c.id === p.shipId);
  const target = battle.combatants.find((c) => c.id === p.targetId);
  if (!ship || !target) return null;

  const allRolled = p.participants.every((x) => x.result);
  const rollAll = rollAllUnrolledRows(p.participants, roll, (x) => !!x.interactive && owns(x.id));
  const dr = maneuverCrewTotal(p.participants, p.essentialRoleId, p.moraleScore, p.undercrew, p.extraDR); // DR PARTAGÉ (essentiel ×2 + Moral + Manque de bras + sabotage)
  const postes = (ship.postes ?? []).filter((pp) => pp.side === p.side);
  const plural = (n: number) => (n > 1 ? 's' : '');
  const sign = (n: number) => (n >= 0 ? `+${n}` : `${n}`);

  // Rangées via le builder mutualisé (#328) — présentation crew-roles ici, éligibilité dans le builder.
  const rows: BuiltRollRow[] = buildParticipantRows(p.participants, battle.combatants, {
    onRoll: roll, onReroll: reroll, onBonusSL: bonus, onDarkPact: darkPact, onForce: force,
    interactiveOf: (part) => !!part.interactive && owns(part.id),
    row: crewRoleRow,
    note: (part, _actor, res) => <div className="cs-outcome ok-text">{part.essential ? `${sign(res.sl)} DR ×2` : `${sign(res.sl)} DR`}</div>,
  });

  const actions: RollAction[] = [
    { key: 'abandonner', label: t('verbe.annuler'), onClick: cancel, verbe: 'annuler' },
    ...(rollAll ? [{ key: 'lancerLesRangees' as const, label: <><Icon id="navigation/des" size="sm" /> Tout lancer</>, onClick: rollAll, verbe: 'lancer' as const }] : []),
    { key: 'valider', label: <><Icon id="feu/flamme" size="sm" /> Feu !</>, onClick: confirm, verbe: 'valider' },
  ];

  return (
    <RollShell
      flowKey="tirDeBatterie"
      title={<><Icon id="action/viser" size="sm" /> Tir de batterie — Test d’équipage</>}
      subtitle={<><strong>{ship.label}</strong> — bordée {p.side} sur <strong>{target.label}</strong> ({postes.length} pièce{plural(postes.length)})</>}
      extra={
        <div className="rm-note" data-ton="menace">
          <Icon id="action/viser" size="sm" /> {target.label} — Coque {target.wounds.current}/{target.wounds.max}. {postes.length} pièce{plural(postes.length)} : {postes.map((pp) => pp.item.label).join(' · ')}.
        </div>
      }
      rows={rows}
      rolled={allRolled}
      summary={allRolled
        ? <>DR PARTAGÉ <b>{sign(dr)}</b> → chaque pièce inflige (Dégâts {sign(dr)}) ; volée de {postes.length} pièce{plural(postes.length)} (l.128).</>
        : undefined}
      actions={actions}
      onCancel={cancel}
    />
  );
}
