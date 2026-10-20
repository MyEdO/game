import type { ReactNode } from 'react';
import type { Combatant } from '../engine/types';
import { actorInfluenceView, forceAvailable, type RollInfluenceView } from '../noyau/rollFlowFactory';
import { ChanceButtons } from './ChanceButtons';
import { ResilienceButton } from './ResilienceButton';

/**
 * Rangée « influencer le jet » PARTAGÉE (Chance · Relance gratuite · +1 DR · Pacte · Résilience).
 *
 * L'acteur est passé UNE fois : ses ressources en sont dérivées (`actorInfluenceView`), et les
 * FENÊTRES de chaque verbe viennent des prédicats du seam (`noyau/rollFlowFactory.ts`). Ce qu'un
 * appelant fournit, ce sont des FAITS (l'acteur, l'état du jet `roll`) et l'OFFRE de chaque verbe
 * (la présence de `onReroll`/`onDarkPact`/`onForce`) — jamais une éligibilité recomposée.
 * `children` : boutons contextuels supplémentaires (Détermination, actions de chirurgie…).
 */
export function InfluenceRow({
  actor,
  fortune,
  resilience,
  roll,
  onReroll,
  onBonusSL,
  onDarkPact,
  onForce,
  children,
}: {
  /** Le héros qui jette : Chance/relance gratuite/Résilience en sont DÉRIVÉES (passé une fois, plus
   *  d'oubli). Les vues présentationnelles `*View` passent plutôt les primitives
   *  ci-dessous (testables sans `Combatant`). */
  actor?: Combatant | null;
  /** Primitives — PRIORITAIRES sur `actor` quand fournies (vues sans `Combatant`). */
  fortune?: number;
  resilience?: number;
  /** État du jet de la rangée (lancé ? propre échec ? déjà relancé ?). */
  roll: RollInfluenceView;
  onReroll: () => void;
  /** Absent → Test binaire : pas de « +1 DR ». */
  onBonusSL?: () => void;
  /** Absent → ce flux n'offre pas le Sombre Pacte. */
  onDarkPact?: () => void;
  /** Absent → pas de Résilience sur ce flux. */
  onForce?: () => void;
  children?: ReactNode;
}) {
  const av = actorInfluenceView(actor, { fortune, resilience });
  return (
    <div className="rm-influence">
      <ChanceButtons
        actorView={av}
        roll={roll}
        onReroll={onReroll}
        onBonusSL={onBonusSL}
        onDarkPact={onDarkPact}
      />
      {onForce && <ResilienceButton resilience={av.resilience} show={forceAvailable(av, roll)} onForce={onForce} />}
      {children}
    </div>
  );
}
