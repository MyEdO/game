import { useEffect, useMemo, useRef, useState } from 'react';
import { planById } from '../gameIso/rig/bodyPlan';
import { bonesToSvg } from '../gameIso/rig/renderBones';
import { useVersionDesDatasets } from './useVersionDesDatasets';

/**
 * Silhouette RENDUE d'une coque depuis son id de véhicule — MÊME chemin que le jeu (gabarit `navire`
 * `composeShip`, art de coque par id) → la silhouette reflète EXACTEMENT ce qu'affiche l'arène. Vue de
 * PROFIL (broadside, lecture navale canonique de l'art de coque). L'état RÉEL de la coque est reflété :
 * un navire à Blessures épuisées (`sunk`) prend la gîte de fin que `composeShip` sait rendre (`deathPose`),
 * sinon la pose de repos. Le cadre s'ajuste à la coque mesurée (`getBBox`) au montage ; repli SSR/test =
 * `SHIP_FALLBACK_BOX` (repère de corps 120×150, base au sol en (60,150)).
 */
const SHIP_FALLBACK_BOX = '0 30 124 132';

export function ShipPreview({ vehicleId, sunk = false, label, className }: { vehicleId: string; sunk?: boolean; label?: string; className?: string }) {
  const version = useVersionDesDatasets();
  const svg = useMemo(() => {
    const plan = planById('navire');
    if (!plan) return '';
    const pose = sunk ? plan.deathPose() : plan.restPose();
    return bonesToSvg(plan.resolve(vehicleId, 'profile', pose, {}));
  }, [vehicleId, sunk, version]);

  const gRef = useRef<SVGGElement>(null);
  const [box, setBox] = useState(SHIP_FALLBACK_BOX);
  useEffect(() => {
    const g = gRef.current;
    if (!g || typeof g.getBBox !== 'function') return;
    const b = g.getBBox();
    if (b.width <= 0 || b.height <= 0) return;
    const pad = Math.max(b.width, b.height) * 0.08;
    setBox(`${b.x - pad} ${b.y - pad} ${b.width + pad * 2} ${b.height + pad * 2}`);
  }, [svg]);

  if (!svg) return null;
  return (
    <svg className={className} viewBox={box} preserveAspectRatio="xMidYMid meet" role="img" aria-label={label ? `Silhouette — ${label}` : 'Silhouette du navire'}>
      <g ref={gRef} dangerouslySetInnerHTML={{ __html: svg }} />
    </svg>
  );
}
