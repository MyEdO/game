/**
 * Couture d'ÉDITION des champs à choix (#1473, E7) : le régime d'un champ à choix est celui de la famille
 * mécanique (`mecaniqueDe`) que porte le champ de document édité. Le rendu générique du champ la pose UNE
 * fois (`FamilleDuChamp`) ; la branche d'op la lit (`useRegimeDuChamp`). Une op imbriquée dans une op est
 * rendue sous `FamilleFermee`, comme le schéma la parse.
 */
import { createContext, useContext, type ReactNode } from 'react';
import { regimesDuChamp, type ChampAChoix, type Regimes } from '../../data/schemas/grammaire/mecanique';
import type { RegimeDePorteur } from '../../data/schemas/grammaire/ref';

const FERMEE: Regimes = {};
const RegimesDeFamille = createContext<Regimes>(FERMEE);

/** Pose les régimes de la famille que porte le nœud de ce champ de document (famille fermée à défaut). */
export function FamilleDuChamp({ noeud, children }: { noeud: unknown; children: ReactNode }) {
  return <RegimesDeFamille.Provider value={regimesDuChamp(noeud) ?? FERMEE}>{children}</RegimesDeFamille.Provider>;
}

/** Rend ses enfants dans la famille FERMÉE : une op imbriquée dans une op. */
export function FamilleFermee({ children }: { children: ReactNode }) {
  return <RegimesDeFamille.Provider value={FERMEE}>{children}</RegimesDeFamille.Provider>;
}

/** Régime du champ à choix dans la famille courante. */
export function useRegimeDuChamp(champ: ChampAChoix): RegimeDePorteur {
  return useContext(RegimesDeFamille)[champ] ?? 'specSeule';
}
