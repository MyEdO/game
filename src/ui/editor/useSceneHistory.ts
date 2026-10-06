import { useCallback, useRef, useState } from 'react';
import type { Scene } from '../../state/scene';

/**
 * Historique d'édition (annuler/rétablir) : chaque `setScene` empile un instantané
 * de la scène ; `resetScene` (Nouveau / Charger / Importer) vide l'historique.
 * Les instantanés sont des objets `Scene` complets (les éditions clonent déjà).
 */
export function useSceneHistory(initial: Scene | (() => Scene)) {
  const [scene, setSceneState] = useState<Scene>(initial);
  const sceneRef = useRef(scene);
  sceneRef.current = scene; // toujours synchronisé, pour des callbacks stables
  const past = useRef<Scene[]>([]);
  const future = useRef<Scene[]>([]);

  const setScene = useCallback((next: Scene) => {
    past.current.push(sceneRef.current);
    if (past.current.length > 200) past.current.shift(); // borne mémoire
    future.current = [];
    setSceneState(next);
  }, []);
  /** Push manuel de l'état COURANT (avant un geste coalescé : peinture / glisser). */
  const pushSnapshot = useCallback(() => {
    past.current.push(sceneRef.current);
    if (past.current.length > 200) past.current.shift();
    future.current = [];
  }, []);
  /** Mutation SANS snapshot (pendant un geste) → 1 seul cran d'undo pour tout le geste. */
  const setSceneNoHistory = useCallback((next: Scene) => setSceneState(next), []);
  /** Réécrit TOUT l'historique (passé et futur) par `f`, sans instantané : un renommage propagé reste
   *  vrai dans chaque état qu'annuler/rétablir peut ramener. */
  const reecrireHistorique = useCallback((f: (s: Scene) => Scene) => {
    past.current = past.current.map(f);
    future.current = future.current.map(f);
  }, []);
  const undo = useCallback(() => {
    if (!past.current.length) return;
    future.current.push(sceneRef.current);
    setSceneState(past.current.pop()!);
  }, []);
  const redo = useCallback(() => {
    if (!future.current.length) return;
    past.current.push(sceneRef.current);
    setSceneState(future.current.pop()!);
  }, []);
  const resetScene = useCallback((s: Scene) => {
    past.current = [];
    future.current = [];
    setSceneState(s);
  }, []);

  return { scene, setScene, setSceneNoHistory, pushSnapshot, reecrireHistorique, undo, redo, resetScene, canUndo: past.current.length > 0, canRedo: future.current.length > 0 };
}
