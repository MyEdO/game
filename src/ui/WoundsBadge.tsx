import { CodexRef } from './compendium/CodexRef';

/**
 * Rendu UNIQUE de la VALEUR des Blessures (LOT 5 — composants de donnée unifiés) : « courant/max »
 * avec ses tons, popover Codex de la caractéristique Blessure. TOUT écran qui affiche des PB passe
 * par ici (fiche, inspection, cartes) ; TOUJOURS « courant/max » — l'unité EST le composant, plus de
 * « max seul » ni de « N/M PB » divergents.
 *
 * Le badge N'EMBARQUE PAS d'icône : l'icône `ressource/blessures` est le choix DÉLIBÉRÉ du site d'appel
 * (motif icône + valeur là où le contexte le veut, jamais deux — directive user 2026-07-13).
 */
export function WoundsBadge({ wounds }: { wounds: { current: number; max: number } }) {
  return (
    <CodexRef category="characteristics" id="blessure" label="Blessure" className="wounds-badge">
      <b>{wounds.current}/{wounds.max}</b>
    </CodexRef>
  );
}
