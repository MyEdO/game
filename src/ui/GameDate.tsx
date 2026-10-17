import { dayPhase, formatImperial, toDate } from '../engine/clock';
import { Icon } from './Icon';

/** Le TEXTE d'un instant de jeu — jour de semaine puis date impériale — tel que `GameDate` le rend. */
export function gameDateText(time: number): string {
  const d = toDate(time);
  return `${d.weekday ? `${d.weekday} · ` : ''}${formatImperial(time)}`;
}

/**
 * Rendu UNIQUE d'un instant de jeu (LOT 5 — composants de donnée unifiés) : icône de la phase du
 * jour (registre `time/*` via `dayPhase().icon`, libellé de phase en tooltip) + jour de semaine
 * (absent des jours intercalaires, canon) + date impériale complète (`formatImperial`). Tout écran
 * qui affiche l'horloge de campagne passe par ici (menu ☰, repos, voyage, sauvegardes, interlude).
 */
export function GameDate({ time }: { time: number }) {
  const phase = dayPhase(time);
  return (
    <span className="game-date" title={phase.label}>
      <Icon id={phase.icon} size="sm" />
      <span>{gameDateText(time)}</span>
    </span>
  );
}
