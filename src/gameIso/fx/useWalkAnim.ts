/**
 * Marche visuelle : le token GLISSE le long du chemin (ANIM_MOVE) au lieu
 * de se téléporter à la destination. `walksRef` = id → {path, start} ; rAF tant qu'actif.
 *
 * Le rAF ne fait que purger les marches finies et BATTRE la frame du stage (`stage/stageFrames`, le
 * rythme que partagent la marche, le glisser-caméra et l'adoucissement de focale). Qui PEINT
 * décide du reste (#1176, P2-4) — le monde volumique lit `walksRef` depuis sa propre boucle de rendu
 * et ne re-rend rien ; seule l'ARRIVÉE y re-synchronise React, en un rendu, pour
 * que les vérités dérivées de l'état de marche (aperçu de chemin) reprennent la
 * main sur la pose committée du store.
 */
import { useEffect, useRef, useState } from 'react';
import { bus, EVT } from '../../noyau/bus';
import { walkDuration, STEP_MS } from '../../geometry/walk';
import { battreStageFrames } from '../stage/stageFrames';
import type { WalkTrack } from './walkPose';

/** `repaint` : la voie qui peint a-t-elle besoin d'un rendu React par frame ? (SVG oui, volumique non.) */
export function useWalkAnim(repaint: boolean) {
  const [, setWalkTick] = useState(0);
  const walksRef = useRef<Record<string, WalkTrack>>({});
  const walkRaf = useRef(0);
  const repaintRef = useRef(repaint);
  useEffect(() => {
    repaintRef.current = repaint;
  }, [repaint]);
  useEffect(() => {
    const tick = () => {
      const now = performance.now();
      let any = false;
      for (const id of Object.keys(walksRef.current)) {
        const w = walksRef.current[id];
        if (now - w.start >= walkDuration(w.path, STEP_MS)) delete walksRef.current[id];
        else any = true;
      }
      battreStageFrames();
      if (repaintRef.current || !any) setWalkTick((t) => t + 1);
      walkRaf.current = any ? requestAnimationFrame(tick) : 0;
    };
    const off = bus.on(EVT.ANIM_MOVE, (d: any) => {
      if (!d?.path || d.path.length < 2) return;
      walksRef.current[d.id] = { path: d.path, start: performance.now() };
      if (!walkRaf.current) walkRaf.current = requestAnimationFrame(tick);
    });
    return () => { off(); if (walkRaf.current) cancelAnimationFrame(walkRaf.current); walkRaf.current = 0; };
  }, []);
  return walksRef;
}
