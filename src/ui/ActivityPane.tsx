import type { IconId } from '../data/icons';
import type { ReactNode } from 'react';
import { Icon } from './Icon';
import { Prose } from './Prose';
import { PendingRollLine, type PendingRoll } from './RollLine';
import { StakeNote } from './StakeNote';
import type { Porteur } from '../noyau/codex/porteur';

/**
 * Gabarit UNIQUE d'un panneau d'Activité/Service (#371) : en-tête (icône du registre + titre),
 * description VERBATIM `<Prose>` (règle 5), corps DÉFILABLE (`children`), et PIED FIXE — pré-jet
 * (`PendingRollLine`), coût `<Coins>`, complément, bouton(s) d'action jamais cachés par le scroll.
 * Slots GÉNÉRIQUES `ReactNode` : composé par `InterludeScreen` (volets d'Activité) et
 * `CityHubScreen` (détail de service) — aucun métier de l'un ou l'autre ne vit ici.
 */
/**
 * Id de la BANNIÈRE de blocage d'un volet — cible d'`aria-describedby` pour les actions du pied. Une
 * raison se dit UNE fois : quand le volet l'affiche en tête (raison STRUCTURANTE de l'écran), ses
 * boutons s'y LIENT (`GatedAction` forme `reasonId`) au lieu d'ouvrir une bulle qui la répèterait.
 */
export const idBlocage = (paneId: string) => `${paneId}-blocked`;

export function ActivityPane({ id, icon, title, lead, desc, porteur, blocked, prejet, cost, note, actions, children }: {
  /** Id STABLE du volet — ancre de la bannière de blocage (cf. `idBlocage`). */
  id: string;
  icon: IconId;
  title: ReactNode;
  /** Bandeau d'ouverture du corps, AVANT la description (ex. `SpeakerBanner` de l'hôte du service). */
  lead?: ReactNode;
  /** Description VERBATIM (Markdown) de la source — rendue par `<Prose>` (règle 5). */
  desc?: string;
  /** Champ d'où sort `desc` (`{ type, id, chemin }`) — sans lui, aucune mention n'est liée (#1392). */
  porteur?: Porteur;
  /** Raison d'indisponibilité (gate d'affordance) — l'action du pied est alors désactivée. */
  blocked?: ReactNode;
  /** Ligne de test AVANT d'entreprendre (compétence en chip + Difficulté + cible). */
  prejet?: PendingRoll;
  /** Coût de l'Activité (rendu `<Coins>`/PX) — affiché dans le pied. */
  cost?: ReactNode;
  /** Formule/complément du pied (activités SANS jet : tirage direct, taux, livraison…). */
  note?: ReactNode;
  /** Bouton(s) du pied. */
  actions?: ReactNode;
  children?: ReactNode;
}) {
  const hasFoot = prejet != null || cost != null || note != null || actions != null;
  return (
    <div className="activity-pane">
      <header className="activity-pane-head"><Icon id={icon} /> <b>{title}</b></header>
      <div className="activity-pane-body">
        {lead}
        {desc && <div className="activity-pane-desc"><Prose md={desc} porteur={porteur} /></div>}
        {blocked && <p className="activity-pane-blocked" id={idBlocage(id)}>{blocked}</p>}
        {children}
      </div>
      {hasFoot && (
        <footer className="activity-pane-foot">
          <div className="activity-pane-terms">
            {/* Z3b : l'enjeu vient de l'ENTRÉE de jet (`PendingRoll.stake`) — rien à rendre tant
                qu'aucune donnée ne le porte (jamais de zone muette). */}
            {prejet?.stake && <StakeNote stake={prejet.stake} />}
            {prejet && <PendingRollLine p={prejet} />}
            {(cost != null || note != null) && (
              <p className="activity-pane-detail">
                {cost != null && <>Coût : <b>{cost}</b>{note != null ? ' · ' : ''}</>}
                {note}
              </p>
            )}
          </div>
          <div className="activity-pane-actions">{actions}</div>
        </footer>
      )}
    </div>
  );
}
