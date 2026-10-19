import { useEffect, useRef, useState } from 'react';
import { diamondCorners, type Dims } from '../../geometry/iso';
import { publierEditeur } from '../../state/editeurBridge';

/** Boîte visée, en PIXELS du contenu défilable (repère du conteneur, défilement inclus). */
export type ScrollBox = { left: number; top: number; right: number; bottom: number };
/** Fenêtre de défilement — les seules mesures lues sur le conteneur (un `HTMLElement` les porte toutes). */
export type ScrollPort = {
  scrollLeft: number;
  scrollTop: number;
  clientWidth: number;
  clientHeight: number;
  scrollWidth: number;
  scrollHeight: number;
};

const clampScroll = (v: number, max: number) => Math.max(0, Math.min(v, Math.max(0, max)));

/** Défilement HORIZONTAL qui centre `box` dans `port`, borné au contenu. */
const centeredLeft = (box: ScrollBox, port: ScrollPort) =>
  clampScroll((box.left + box.right) / 2 - port.clientWidth / 2, port.scrollWidth - port.clientWidth);

/**
 * Défilement qui CENTRE `box` dans la bande dégagée `[insetTop, clientHeight - insetBottom]`, borné au
 * contenu. Ne porte AUCUN prédicat : « faut-il bouger ? » appartient aux lois qui l'appellent.
 */
function centeredScroll(
  box: ScrollBox,
  port: ScrollPort,
  insetTop: number,
  insetBottom: number,
): { left: number; top: number } {
  const usableHeight = Math.max(0, port.clientHeight - insetTop - insetBottom);
  return {
    left: centeredLeft(box, port),
    top: clampScroll((box.top + box.bottom) / 2 - insetTop - usableHeight / 2, port.scrollHeight - port.clientHeight),
  };
}

/**
 * Défilement à appliquer pour CENTRER `box` dans `port`, borné au contenu — `null` quand la boîte y est
 * DÉJÀ entièrement visible : on n'amène au centre que ce qui manque au champ, jamais la vue en cours.
 * `insetTop`/`insetBottom` = bandes HAUTE/BASSE du conteneur réservées, PLEINE LARGEUR : la loi de
 * cadrage d'un conteneur dont tout le haut (ou tout le bas) est pris. Une surcouche flottante n'est PAS
 * une bande — elle a une boîte : voir `centerScrollForClear`.
 * PURE (aucun DOM) : c'est la loi de cadrage, testable telle quelle.
 */
export function centerScrollFor(
  box: ScrollBox,
  port: ScrollPort,
  insetTop = 0,
  insetBottom = 0,
): { left: number; top: number } | null {
  const seen =
    box.left >= port.scrollLeft &&
    box.right <= port.scrollLeft + port.clientWidth &&
    box.top >= port.scrollTop + insetTop &&
    box.bottom <= port.scrollTop + port.clientHeight - insetBottom;
  if (seen) return null;
  return centeredScroll(box, port, insetTop, insetBottom);
}

const overlaps = (a: ScrollBox, b: ScrollBox) =>
  a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;

/**
 * Ce qui reste de `rect` une fois `holes` retirés (découpe en guillotine, récursive) — liste vide quand
 * tout est recouvert. Sert à savoir s'il reste du champ CLIQUABLE sous une boîte visée : une surcouche
 * étroite n'ampute qu'un pan du rectangle, pas toute sa bande. PURE.
 */
export function clearParts(rect: ScrollBox, holes: readonly ScrollBox[]): ScrollBox[] {
  if (rect.right - rect.left <= 0 || rect.bottom - rect.top <= 0) return [];
  for (let i = 0; i < holes.length; i++) {
    const h = holes[i];
    if (!overlaps(rect, h)) continue;
    const rest = holes.slice(i + 1); // les précédents ne croisaient pas `rect`, ni donc ses morceaux
    const out: ScrollBox[] = [];
    const keep = (b: ScrollBox) => out.push(...clearParts(b, rest));
    if (h.top > rect.top) keep({ ...rect, bottom: h.top });
    if (h.bottom < rect.bottom) keep({ ...rect, top: h.bottom });
    const top = Math.max(rect.top, h.top),
      bottom = Math.min(rect.bottom, h.bottom);
    if (h.left > rect.left) keep({ left: rect.left, right: h.left, top, bottom });
    if (h.right < rect.right) keep({ left: h.right, right: rect.right, top, bottom });
    return out;
  }
  return [rect];
}

/**
 * MÊME loi que `centerScrollFor`, mais le champ est amputé par des SURCOUCHES flottantes données par
 * leur BOÎTE RÉELLE (`overlays`, en pixels CLIENT du conteneur : elles ne défilent pas avec le contenu).
 * Une surcouche ancrée bas-GAUCHE ne masque donc rien en bas-DROITE — le modèle « bande » y déclarait
 * « non vue » une case parfaitement cliquable et recadrait pour rien.
 *
 * `need` règle le seuil de recadrage :
 *  - `whole` : la boîte doit être entière dans le champ dégagé (amener un défaut sous les yeux) ;
 *  - `reachable` : il suffit qu'il en reste un pan cliquable (aucun mouvement de vue tant que l'auteur
 *    peut atteindre sa cible — la vue ne se dérobe pas sous le pinceau).
 * PURE (aucun DOM).
 */
export function centerScrollForClear(
  box: ScrollBox,
  port: ScrollPort,
  overlays: readonly ScrollBox[] = [],
  need: 'whole' | 'reachable' = 'whole',
): { left: number; top: number } | null {
  const shown: ScrollBox = {
    left: box.left - port.scrollLeft,
    right: box.right - port.scrollLeft,
    top: box.top - port.scrollTop,
    bottom: box.bottom - port.scrollTop,
  };
  const inField =
    shown.left >= 0 && shown.top >= 0 && shown.right <= port.clientWidth && shown.bottom <= port.clientHeight;
  const ok =
    need === 'whole'
      ? inField && !overlays.some((o) => overlaps(shown, o))
      : clearParts(
          {
            left: Math.max(shown.left, 0),
            right: Math.min(shown.right, port.clientWidth),
            top: Math.max(shown.top, 0),
            bottom: Math.min(shown.bottom, port.clientHeight),
          },
          overlays,
        ).length > 0;
  if (ok) return null;
  // Seules les surcouches que la boîte CROISERA en X une fois centrée réduisent le champ vertical.
  const left = centeredLeft(box, port);
  let insetTop = 0,
    insetBottom = 0;
  for (const o of overlays) {
    if (o.right <= box.left - left || box.right - left <= o.left) continue;
    if (o.top + o.bottom <= port.clientHeight) insetTop = Math.max(insetTop, Math.min(port.clientHeight, o.bottom));
    else insetBottom = Math.max(insetBottom, Math.min(port.clientHeight, port.clientHeight - o.top));
  }
  return centeredScroll(box, port, Math.max(0, insetTop), Math.max(0, insetBottom));
}

/** Amène `el` dans le champ de son conteneur défilable `port` — MÊME loi de cadrage que la carte
 *  (`centerScrollFor`), bornée à ce conteneur : rien d'autre ne défile. */
export function scrollElementIntoPort(el: HTMLElement, port: HTMLElement) {
  const b = el.getBoundingClientRect(),
    p = port.getBoundingClientRect();
  const left = b.left - p.left + port.scrollLeft,
    top = b.top - p.top + port.scrollTop;
  const next = centerScrollFor({ left, right: left + b.width, top, bottom: top + b.height }, port);
  if (!next) return;
  port.scrollLeft = next.left;
  port.scrollTop = next.top;
}

/**
 * Caméra de l'ÉDITEUR : rotation 90° et mode panoramique, commandés par le REGISTRE de raccourcis via
 * le pont `editeurBridge` ; zoom/pan via le `viewBox` (molette ancrée au curseur, clic-milieu / glisser).
 * `getScreenCTM` tient compte du viewBox → le picking est inchangé (zéro modif du placement).
 */
export function useEditorView() {
  const [rot, setRot] = useState<0 | 1 | 2 | 3>(0); // rotation caméra éditeur (snap, local)
  const [viewMode, setViewMode] = useState<'iso' | 'top'>('top'); // projection éditeur (bascule, local) — plan par défaut : l'éditeur travaille le PLAN, l'iso juge le rendu (arbitrage user 2026-07-25)
  const [view, setView] = useState({ zoom: 1, x: 0, y: 0 }); // x,y = origine viewBox (coords contenu)
  const spaceRef = useRef(false); // barre Espace maintenue → pan au glisser
  const panRef = useRef<{ sx: number; sy: number; vx: number; vy: number } | null>(null);
  const canvasRef = useRef<SVGSVGElement>(null);
  /** Conteneur DÉFILABLE du canevas (`.editor-canvas-wrap`) : la carte y est plus haute que la fenêtre. */
  const wrapRef = useRef<HTMLElement>(null);
  /** Taille du canvas (dépend de la scène ET de `rot`) — synchronisée par le composant à chaque rendu. */
  const stageRef = useRef({ w: 0, h: 0 });
  /** Surcouche FLOTTANTE posée en haut du conteneur (barre de couche) : elle recouvre le champ sans
   *  le réduire. Le composant l'attache ; sa géométrie RÉELLE donne la marge de sécurité du cadrage. */
  const topOverlayRef = useRef<HTMLElement | null>(null);
  /** Même discipline, posée en BAS (panneau de calque de référence) — une 2e surcouche flottante que
   *  le cadrage doit éviter tout autant (sans elle, une case fautive proche du bas se recadre dessous). */
  const bottomOverlayRef = useRef<HTMLElement | null>(null);

  // Rotation et panoramique au clavier : publiés au PONT de l'éditeur, le registre de raccourcis
  // (`state/clavier/keybindings`, section `editeur`) porte les touches et leur remap.
  useEffect(
    () =>
      publierEditeur({
        tourner: (dir) => setRot((r) => (((r + (dir === 1 ? 1 : 3)) % 4) as 0 | 1 | 2 | 3)),
        pan: (on) => {
          spaceRef.current = on;
        },
      }),
    [],
  );

  // Borne BASSE sous 1 : une carte plus haute que la fenêtre (32×38 cases) doit pouvoir tenir à l'écran
  // d'un bloc — à 1, « Zoom arrière » n'avait aucun effet depuis l'état initial.
  const ZE_MIN = 0.25,
    ZE_MAX = 6;
  // Zoom centré sur un point contenu (curseur pour la molette, centre pour les boutons).
  const zoomAt = (factor: number, ax?: number, ay?: number) =>
    setView((v) => {
      const nz = Math.min(ZE_MAX, Math.max(ZE_MIN, v.zoom * factor));
      const s = stageRef.current;
      const ovw = s.w / v.zoom,
        ovh = s.h / v.zoom;
      const nvw = s.w / nz,
        nvh = s.h / nz;
      const cx = ax ?? v.x + ovw / 2,
        cy = ay ?? v.y + ovh / 2;
      const fx = (cx - v.x) / ovw,
        fy = (cy - v.y) / ovh;
      return { zoom: nz, x: cx - fx * nvw, y: cy - fy * nvh };
    });

  // Molette = zoom ancré sur le curseur (listener non-passif pour preventDefault).
  useEffect(() => {
    const svg = canvasRef.current;
    if (!svg) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const pt = svg.createSVGPoint();
      pt.x = e.clientX;
      pt.y = e.clientY;
      const loc = pt.matrixTransform(svg.getScreenCTM()!.inverse());
      zoomAt(e.deltaY < 0 ? 1.15 : 1 / 1.15, loc.x, loc.y);
    };
    svg.addEventListener('wheel', onWheel, { passive: false });
    return () => svg.removeEventListener('wheel', onWheel);
  }, []);

  /**
   * Amène les cases visées AU CENTRE du conteneur défilable (mise en évidence d'un défaut de plan) —
   * sans rien bouger si elles y sont déjà dégagées (`centerScrollForClear`). La boîte se calcule par la
   * géométrie PARTAGÉE (`diamondCorners`) : correcte en plan comme en iso, quelle que soit la rotation.
   * `need='reachable'` (édition en cours) : on ne bouge que si la cible devient INATTEIGNABLE.
   */
  const scrollTilesIntoView = (
    tiles: readonly { x: number; y: number; z: number }[],
    dims: Dims,
    need: 'whole' | 'reachable' = 'whole',
  ) => {
    const svg = canvasRef.current,
      wrap = wrapRef.current;
    if (!svg || !wrap || !tiles.length) return;
    let minX = Infinity,
      minY = Infinity,
      maxX = -Infinity,
      maxY = -Infinity;
    for (const t of tiles) {
      const c = diamondCorners(t.x, t.y, dims, t.z);
      for (const [px, py] of [c.top, c.right, c.bot, c.left]) {
        minX = Math.min(minX, px);
        maxX = Math.max(maxX, px);
        minY = Math.min(minY, py);
        maxY = Math.max(maxY, py);
      }
    }
    const vbw = stageRef.current.w / view.zoom,
      vbh = stageRef.current.h / view.zoom;
    if (!vbw || !vbh) return;
    // Facteur contenu→pixel MESURÉ sur le rendu : le SVG est en plus mis à l'échelle par la CSS
    // (`.editor-iso { max-width: 100% }`), le zoom seul ne le donne pas.
    const svgBox = svg.getBoundingClientRect(),
      wrapBox = wrap.getBoundingClientRect();
    const sx = svgBox.width / vbw,
      sy = svgBox.height / vbh;
    const ox = svgBox.left - wrapBox.left + wrap.scrollLeft,
      oy = svgBox.top - wrapBox.top + wrap.scrollTop;
    // Surcouches flottantes (barre d'étages, panneau de calque) ramenées au repère CLIENT du conteneur
    // et prises sur leur BOÎTE mesurée : ancrées à un ancêtre qui ne défile pas, elles avalent le clic
    // là où elles sont, et NULLE PART ailleurs sur leur ligne.
    const overlays = [topOverlayRef.current, bottomOverlayRef.current]
      .map((el) => el?.getBoundingClientRect())
      .filter((r): r is DOMRect => !!r)
      .map((r) => ({
        left: r.left - wrapBox.left,
        right: r.right - wrapBox.left,
        top: r.top - wrapBox.top,
        bottom: r.bottom - wrapBox.top,
      }));
    const next = centerScrollForClear(
      {
        left: ox + (minX - view.x) * sx,
        right: ox + (maxX - view.x) * sx,
        top: oy + (minY - view.y) * sy,
        bottom: oy + (maxY - view.y) * sy,
      },
      wrap,
      overlays,
      need,
    );
    if (!next) return;
    wrap.scrollLeft = next.left;
    wrap.scrollTop = next.top;
  };

  return { rot, setRot, viewMode, setViewMode, view, setView, zoomAt, scrollTilesIntoView, spaceRef, panRef, canvasRef, wrapRef, stageRef, topOverlayRef, bottomOverlayRef };
}
