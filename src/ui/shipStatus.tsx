import { moraleBand, weeklyCrewWageBrass } from '../engine/crewMorale';
import { fromBrass } from '../engine/money';
import { crewRoles } from '../data';
import { Coins } from './Coins';
import type { GaugeTone } from './NotchGauge';
import type { CampaignVessel } from '../noyau/etat';
import { modificateursAuCarenage } from '../engine/seaVoyage';
import { foulingEffects } from '../engine/seaNavigation';

/** Bande de Moral d'équipage (MDG 14) → ton de jauge : canailles = danger, satisfait = warn,
 *  excellent/mené de main de maître = ok. Keyé par l'id STABLE de bande, jamais le libellé.
 *  Source UNIQUE du mapping — le dossier de navire et l'écran de port le partagent. */
export const moraleTone = (score: number): GaugeTone => {
  switch (moraleBand(score).id) {
    case 'canailles': return 'danger';
    case 'equipage-satisfait': return 'warn';
    default: return 'ok';
  }
};

/** Libellé d'un rôle d'équipage salarié (crew-roles.json) — lookup par id STABLE, AFFICHAGE du label. */
export const crewRoleLabel = (roleId: string): string => crewRoles.find((r) => r.id === roleId)?.label ?? roleId;

/** Résumé de l'équipage SALARIÉ (#216) : roster (rôle × compte), solde hebdomadaire due, dette cumulée.
 *  Barème `crew-roles.json` via `weeklyCrewWageBrass`. Source UNIQUE partagée par PortView et le dossier
 *  de navire. `null` si aucun équipage salarié ni dette. */
/** Salissures de la coque (MDG 13 l.144-159) et ce que seul le carénage lèvera (MDG 15 l.185). */
export function SalissuresDeLaCoque({ vessel }: { vessel: CampaignVessel }) {
  const niveau = vessel.fouling?.level ?? 0;
  const aRacler = modificateursAuCarenage(vessel.modificateurs).map((m) => ` · ${m.label}`).join('');
  return <p className="port-hint">Salissures : niveau <b>{niveau}</b>{aRacler}{niveau > 0 ? ` — ${foulingEffects(niveau).desc}` : ''}</p>;
}

export function ShipCrewWages({ vessel }: { vessel: CampaignVessel }) {
  const weeklyWageBrass = weeklyCrewWageBrass(vessel.crew);
  if (!(vessel.crew?.length || weeklyWageBrass > 0 || vessel.wagesOwed)) return null;
  return (
    <p className="port-hint">
      Équipage salarié : {vessel.crew?.length
        ? vessel.crew.map((h) => `${h.count} ${crewRoleLabel(h.roleId)}`).join(', ')
        : '—'}
      {' · solde hebdomadaire '}<b><Coins money={fromBrass(weeklyWageBrass)} /></b>
      {vessel.wagesOwed ? <> · dette <b><Coins money={fromBrass(vessel.wagesOwed)} /></b></> : null}
    </p>
  );
}
