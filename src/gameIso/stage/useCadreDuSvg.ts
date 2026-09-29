import { useEffect, useState } from 'react';
import type { StageCanvas } from './stageCam';

/** CADRE MESURÉ (px CSS) du SVG qui porte le groupe `porteur` — le cadre de rendu dont une échelle
 *  écran se déduit (`viewBoxUnitPx` sous la caméra du jeu, `viewBoxMeetScale` au plan de station).
 *  Suivi par `ResizeObserver` ; `repli` tant que l'élément n'est pas mesuré (montage, environnement
 *  sans mise en page). */
export function useCadreDuSvg(porteur: { current: SVGGElement | null }, repli: StageCanvas): StageCanvas {
  const [canvas, setCanvas] = useState<StageCanvas>(repli);
  useEffect(() => {
    const svg = porteur.current?.ownerSVGElement;
    if (!svg) return;
    const mesurer = () => {
      const w = svg.clientWidth;
      const h = svg.clientHeight;
      if (!w || !h) return;
      setCanvas((p) => (p.w === w && p.h === h ? p : { w, h }));
    };
    mesurer();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(mesurer);
    ro.observe(svg);
    return () => ro.disconnect();
  }, [porteur]);
  return canvas;
}
