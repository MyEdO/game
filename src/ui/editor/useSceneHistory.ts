import { useCallback, useState } from 'react';
import type { Scene } from '../../noyau/monde/scene';
import { annuler, historiqueDe, poser, reecrire, retablir } from '../../noyau/edition/historique';

/**
 * L'historique d'édition de la scène (`noyau/edition/historique`) en état React : `setScene` ouvre un cran,
 * `setSceneNoHistory` prolonge le cran du geste en cours, `resetScene` (Nouveau / Charger / Importer) repart sans cran.
 */
export function useSceneHistory(initial: Scene | (() => Scene)) {
  const [h, setH] = useState(() => historiqueDe(typeof initial === 'function' ? initial() : initial));

  const setScene = useCallback((next: Scene) => setH((x) => poser(x, next, true)), []);
  const setSceneNoHistory = useCallback((next: Scene) => setH((x) => poser(x, next, false)), []);
  const reecrireHistorique = useCallback((f: (s: Scene) => Scene) => setH((x) => reecrire(x, f)), []);
  const undo = useCallback(() => setH(annuler), []);
  const redo = useCallback(() => setH(retablir), []);
  const resetScene = useCallback((s: Scene) => setH(historiqueDe(s)), []);

  return { scene: h.present, setScene, setSceneNoHistory, reecrireHistorique, undo, redo, resetScene, canUndo: h.passe.length > 0, canRedo: h.futur.length > 0 };
}
