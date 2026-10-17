import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { PointerEvent as ReactPointerEvent, MouseEvent as ReactMouseEvent } from 'react';
import { VB_W, VB_H, Z_MIN, Z_MAX, type Viewport, clampViewport } from './worldMapViewport';

/**
 * Primitive de CARTE SVG panoramable/zoomable (#343-C) — mini-moteur partagé, consommé par
 * `WorldMapView` : la
 * caméra (pan à 1 doigt/souris, zoom molette-vers-le-curseur, pinch tactile), le fond, les TRACÉS et
 * les MARQUEURS cliquables, plus les commandes de zoom. Aucune logique de voyage/lieu ici : le
 * consommateur fournit son contenu en DONNÉE (`paths`/`markers`/`overlay`) et son habillage
 * (`chrome`). Cibles de clic FIABLES : le fond et le chrome n'interceptent jamais le pointeur, chaque
 * tracé porte une zone de clic invisible large (`hitWidth`), chaque marqueur reste en taille écran
 * constante (`scale(1/z)`) avec son propre hit-target. Premier consommateur : la carte du monde ; le
 * futur plan de ville (#343-B) est le second, sur la MÊME primitive.
 */

/** Un marqueur ponctuel (lieu, station…) posé en unités du viewBox (x 0..100, y 0..64). Le contenu
 *  est rendu en TAILLE ÉCRAN CONSTANTE (la position suit le zoom, pas la taille). */
export interface MapMarker {
  id: string;
  x: number;
  y: number;
  /** Contenu SVG du marqueur — nœud, ou fonction de l'état (sélection/survol). DOIT inclure sa propre
   *  cible de clic/survol (ex. un cercle `fillOpacity=0`) pour un hit-target généreux. */
  children: ReactNode | ((state: { selected: boolean; hovered: boolean }) => ReactNode);
  selected?: boolean;
  onClick?: () => void;
  onHover?: (hovered: boolean) => void;
  cursor?: string;
  opacity?: number;
  /** Nom accessible — requis pour un clavier/lecteur d'écran quand `onClick` est fourni
   *  (rendu en `role="button"`/`aria-label`, cf. recette a11y #343). */
  label?: string;
}

/** Un tracé (route, contour…) en données de path SVG (unités viewBox). Quand `onClick` est fourni, une
 *  zone de clic invisible large (`hitWidth`, non-scaling) double le tracé visible — les traits fins
 *  restent cliquables. Le contenu VISIBLE (`children`) doit porter `pointerEvents="none"`. */
export interface MapPath {
  id: string;
  d: string;
  /** Contenu VISIBLE du tracé — nœud, ou fonction de la vue (pour les éléments à taille écran
   *  constante, ex. une étiquette de distance en `scale(1/z)`). */
  children?: ReactNode | ((view: Viewport) => ReactNode);
  onClick?: () => void;
  cursor?: string;
  /** Largeur de la zone de clic invisible (défaut 18 unités viewBox). */
  hitWidth?: number;
}

export interface MapCanvasProps {
  /** Cadrage initial + cible du bouton « recentrer » (recalculé à chaque clic, valeurs courantes). */
  computeFit: () => Viewport;
  /** Image de fond rendue DANS le repère zoomable, en cover (n'intercepte jamais le pointeur). */
  background?: string;
  /** Habillage FIXE plein-cadre (parchemin, cadre orné, `<defs>`) — sous le contenu zoomable, jamais
   *  cliquable. */
  chrome?: ReactNode;
  paths?: MapPath[];
  markers?: MapMarker[];
  /** Contenu zoomable peint APRÈS les marqueurs (étiquettes au-dessus de tous les médaillons, rose des
   *  vents…) — reçoit la vue courante pour les `scale(1/z)`. */
  overlay?: (view: Viewport) => ReactNode;
  className?: string;
  ariaLabel?: string;
  /** Clic sur le FOND (hors tracé/marqueur) en coordonnées logiques du viewBox — placement d'auteur
   *  (éditeur, #345 : positionner un POI). Absent = fond non cliquable (comportement historique). */
  onBackgroundClick?: (p: { x: number; y: number }) => void;
  /** Jeton de RECADRAGE : dès qu'il AUGMENTE (l'appelant vient d'ouvrir du contenu — un lieu révélé),
   *  la vue rejoue `computeFit`, exactement comme le bouton « Recentrer ». Jamais à chaque rendu : sans
   *  ça, le contenu neuf peut naître HORS du cadre courant, présent au DOM et incliquable. */
  refitAt?: number;
}

export function MapCanvas({ computeFit, background, chrome, paths = [], markers = [], overlay, className, ariaLabel, onBackgroundClick, refitAt }: MapCanvasProps) {
  const [view, setView] = useState<Viewport>(computeFit);
  // computeFit change à chaque rendu (capture la sélection/les routes courantes) : on lit la DERNIÈRE
  // version au clic « recentrer », sans re-cadrer à chaque rendu.
  const fitRef = useRef(computeFit);
  fitRef.current = computeFit;

  // Recadrage sur CROISSANCE du jeton (`refitAt`) : même cible que « Recentrer », jouée toute seule.
  const refitRef = useRef(refitAt ?? 0);
  useEffect(() => {
    const avant = refitRef.current;
    refitRef.current = refitAt ?? 0;
    if ((refitAt ?? 0) > avant) setView(fitRef.current());
  }, [refitAt]);

  const svgRef = useRef<SVGSVGElement | null>(null);
  const ptrs = useRef(new Map<number, { x: number; y: number }>());
  const pinchRef = useRef<{ dist: number; cx: number; cy: number } | null>(null);
  const draggedRef = useRef(false);

  /** Point ÉCRAN (clientX/Y) → coordonnées logiques du viewBox (avant transform), letterboxing compris. */
  const screenToVb = (clientX: number, clientY: number) => {
    const el = svgRef.current;
    if (!el) return { x: 0, y: 0 };
    const r = el.getBoundingClientRect();
    const s = Math.min(r.width / VB_W, r.height / VB_H);
    const offX = (r.width - VB_W * s) / 2, offY = (r.height - VB_H * s) / 2;
    return { x: (clientX - r.left - offX) / s, y: (clientY - r.top - offY) / s };
  };

  // Molette : listener natif NON PASSIF (React pose `onWheel` en passif → `preventDefault` invalide),
  // pour bloquer le défilement de la page pendant le zoom-vers-le-curseur.
  useEffect(() => {
    const el = svgRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const p = screenToVb(e.clientX, e.clientY);
      setView((v) => {
        const z = Math.min(Z_MAX, Math.max(Z_MIN, v.z * (e.deltaY < 0 ? 1.15 : 1 / 1.15)));
        const wx = (p.x - v.panX) / v.z, wy = (p.y - v.panY) / v.z;
        return clampViewport({ z, panX: p.x - wx * z, panY: p.y - wy * z });
      });
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  const onPointerDown = (e: ReactPointerEvent<SVGSVGElement>) => {
    try { (e.target as Element).setPointerCapture?.(e.pointerId); } catch { /* pas de pointeur actif */ }
    ptrs.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    draggedRef.current = false;
    if (ptrs.current.size === 2) {
      const [a, b] = [...ptrs.current.values()];
      pinchRef.current = { dist: Math.hypot(b.x - a.x, b.y - a.y), cx: (a.x + b.x) / 2, cy: (a.y + b.y) / 2 };
    }
  };
  const onPointerMove = (e: ReactPointerEvent<SVGSVGElement>) => {
    const prev = ptrs.current.get(e.pointerId);
    if (!prev) return;
    ptrs.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const el = svgRef.current;
    const r = el?.getBoundingClientRect();
    const s = r ? Math.min(r.width / VB_W, r.height / VB_H) : 1;
    if (ptrs.current.size === 2 && pinchRef.current) {
      // Pinch : le rapport des écarts entre doigts pilote le zoom, centré sur le milieu des doigts.
      // `pinch` capturé en variable LOCALE avant `setView` : le callback différé de `setState` ne
      // doit JAMAIS déréférencer `pinchRef.current` (peut retomber à `null` entre-temps via
      // `onPointerUp` — même classe de bug que EditorCanvas.tsx `panRef`).
      const pinch = pinchRef.current;
      const [a, b] = [...ptrs.current.values()];
      const dist = Math.hypot(b.x - a.x, b.y - a.y) || 1;
      const p = screenToVb((a.x + b.x) / 2, (b.y + a.y) / 2);
      setView((v) => {
        const z = Math.min(Z_MAX, Math.max(Z_MIN, v.z * (dist / (pinch.dist || dist))));
        const wx = (p.x - v.panX) / v.z, wy = (p.y - v.panY) / v.z;
        return clampViewport({ z, panX: p.x - wx * z, panY: p.y - wy * z });
      });
      pinch.dist = dist;
      draggedRef.current = true;
    } else if (ptrs.current.size === 1) {
      // Glisser : déplacer la vue de la même distance logique que le doigt/souris.
      const dx = (e.clientX - prev.x) / (s || 1), dy = (e.clientY - prev.y) / (s || 1);
      if (Math.abs(e.clientX - prev.x) + Math.abs(e.clientY - prev.y) > 2) draggedRef.current = true;
      setView((v) => clampViewport({ ...v, panX: v.panX + dx, panY: v.panY + dy }));
    }
  };
  const onPointerUp = (e: ReactPointerEvent<SVGSVGElement>) => {
    ptrs.current.delete(e.pointerId);
    if (ptrs.current.size < 2) pinchRef.current = null;
  };
  // Après un glisser réel, absorber le clic « fantôme » qui suit (sinon on sélectionnerait un marqueur).
  const swallowClickAfterDrag = (e: ReactMouseEvent) => {
    if (draggedRef.current) { e.stopPropagation(); draggedRef.current = false; }
  };
  // Clic sur le fond (bulle APRÈS les handlers de tracé/marqueur, capturés par `swallowClickAfterDrag`
  // qui a déjà stoppé la propagation d'un clic post-glisser) : placement d'auteur.
  const onBgClick = (e: ReactMouseEvent<SVGSVGElement>) => {
    if (!onBackgroundClick) return;
    const p = screenToVb(e.clientX, e.clientY);
    onBackgroundClick({ x: Math.max(0, Math.min(VB_W, p.x)), y: Math.max(0, Math.min(VB_H, p.y)) });
  };

  const zoomBy = (factor: number) =>
    setView((v) => {
      const z = Math.min(Z_MAX, Math.max(Z_MIN, v.z * factor));
      const wx = (VB_W / 2 - v.panX) / v.z, wy = (VB_H / 2 - v.panY) / v.z;
      return clampViewport({ z, panX: VB_W / 2 - wx * z, panY: VB_H / 2 - wy * z });
    });
  const recenter = () => setView(fitRef.current());

  return (
    // Cadre au ratio EXACT du viewBox (`map-canvas-frame`) : les commandes de zoom s'ancrent à CE
    // cadre (pas au conteneur englobant, souvent plus grand — lettrboxing) → toujours DANS le cadre,
    // à toutes les largeurs (#360, débordement 360px partagé WorldMapView/CityHubScreen).
    <div className="map-canvas-frame">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${VB_W} ${VB_H}`}
        preserveAspectRatio="xMidYMid meet"
        className={className}
        role="group"
        aria-label={ariaLabel}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onClickCapture={swallowClickAfterDrag}
        onClick={onBgClick}
        style={{ touchAction: 'none', cursor: ptrs.current.size ? 'grabbing' : (onBackgroundClick ? 'crosshair' : 'grab') }}
      >
        {chrome}
        <g transform={`translate(${view.panX} ${view.panY}) scale(${view.z})`}>
          {background && (
            <image href={background} x="0" y="0" width={VB_W} height={VB_H} preserveAspectRatio="xMidYMid slice" clipPath="url(#wm-frame-clip)" style={{ pointerEvents: 'none' }} />
          )}
          {paths.map((p) => (
            <g key={p.id} onClick={p.onClick} style={p.onClick ? { cursor: p.cursor ?? 'pointer' } : undefined}>
              {p.onClick && <path d={p.d} fill="none" stroke="transparent" strokeWidth={p.hitWidth ?? 18} pointerEvents="stroke" data-path-id={p.id} />}
              {typeof p.children === 'function' ? p.children(view) : p.children}
            </g>
          ))}
          {markers.map((mk) => {
            const state = { selected: !!mk.selected, hovered: false };
            return (
              <g
                key={mk.id}
                transform={`translate(${mk.x} ${mk.y}) scale(${1 / view.z})`}
                onClick={mk.onClick}
                onPointerEnter={mk.onHover ? () => mk.onHover!(true) : undefined}
                onPointerLeave={mk.onHover ? () => mk.onHover!(false) : undefined}
                style={mk.cursor ? { cursor: mk.cursor } : undefined}
                opacity={mk.opacity}
                role={mk.onClick ? 'button' : undefined}
                aria-label={mk.onClick ? mk.label : undefined}
                tabIndex={mk.onClick ? 0 : undefined}
                onKeyDown={mk.onClick ? (e) => {
                  if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); mk.onClick!(); }
                } : undefined}
              >
                {typeof mk.children === 'function' ? mk.children(state) : mk.children}
                {/* Anneau de focus CLAVIER maison (#372) — opacité pilotée par `:focus-visible` en
                   CSS (world-meta.css), jamais affiché au clic souris. */}
                {mk.onClick && (
                  <circle
                    className="map-marker-focus-ring"
                    r="2.6"
                    fill="none"
                    stroke="var(--gold)"
                    strokeWidth="0.35"
                    pointerEvents="none"
                  />
                )}
              </g>
            );
          })}
          {overlay?.(view)}
        </g>
      </svg>
      <div className="wm-zoom" role="group" aria-label="Zoom de la carte">
        <button type="button" className="wm-zoom-btn" onClick={() => zoomBy(1.3)} title="Zoomer" aria-label="Zoomer">＋</button>
        <button type="button" className="wm-zoom-btn" onClick={() => zoomBy(1 / 1.3)} title="Dézoomer" aria-label="Dézoomer">－</button>
        <button type="button" className="wm-zoom-btn" onClick={recenter} title="Recentrer" aria-label="Recentrer">✦</button>
      </div>
    </div>
  );
}
