/**
 * Les PRÉFÉRENCES du web (#3041) : la couture d'écriture JOUEUR sur la table du noyau (`noyau/preferences.ts`),
 * persistée par la procédure de l'hôte (`hote/preferences.ts`) dans le `localStorage`, puis l'effet que le web
 * déclare pour chaque entrée sur son store (`EFFETS`, exhaustif par `IdDePreference`).
 */
import { useGame } from './store';
import { reglerUnePreference } from '../hote/preferences';
import { preferenceDef, type IdDePreference, type PrefValue } from '../noyau/preferences';
import { stockageWeb } from '../web/stockageWeb';

/** L'effet d'un changement JOUEUR sur le store, par préférence (jamais au chargement). */
const EFFETS: Record<IdDePreference, () => void> = {
  // Basculer en Rapide/Auto EN PLEIN COMBAT ne traverse pas la boucle de tours : sans reprise explicite, le tour
  // courant reste figé.
  'combat-cadence': () => useGame.getState().resumeCadence(),
  // La valeur vit hors du store (module feuille) : une modale de jet DÉJÀ ouverte ne se re-rendrait pas. On touche
  // la tranche `net`, celle à laquelle `RollShell` s'abonne pour son sélecteur de dé.
  'des-fixes': () => useGame.setState((s) => ({ net: { ...s.net } })),
};

/** COUTURE UNIQUE d'écriture JOUEUR : écrit, persiste, puis joue l'effet déclaré pour l'entrée. */
export function setPreference(id: string, value: PrefValue): void {
  const def = reglerUnePreference(stockageWeb('localStorage'), id, value);
  if (def) EFFETS[def.id]();
}

/** Réinitialise une préférence à son défaut (même couture que `setPreference`). */
export function resetPreference(id: string): void {
  const def = preferenceDef(id);
  if (def) setPreference(id, def.default);
}
