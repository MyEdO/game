import type { JSX } from 'react';
/**
 * MATIÈRE DU PLAN (#1176, P3-4) — le canevas 2D qui porte l'instantané volumique du plan de station,
 * sous la surcouche SVG de `gameIso/TopoScene` (même conteneur, même boîte à 100 %×100 %, donc le
 * même letterbox `meet` pour les deux).
 *
 * RÉTENTION PAR CONTENU : l'instantané se reprend au changement du read-set réel de la cuisson
 * (`worldBakeDeps`), de l'étage planifié, ou de la BOÎTE DE PIXELS où il est cuit — jamais sur la
 * référence de l'objet scène, qu'un hôte reforge à chaque tick (le store en jeu) et qui repayerait une
 * cuisson complète par rendu. La boîte entre dans la clé parce qu'une image cuite pour une autre boîte
 * n'est plus le plan : la CSS l'étirerait, et le `meet` du SVG posé dessus cesserait d'être le sien.
 * Patron canonique du dépôt (`state/sceneMemo.ts`), un slot par INSTANCE de plan.
 *
 * ÉCHEC : `onMatière(false)` remonte l'absence de matière à l'hôte, qui rend alors ses sols en SVG —
 * sans quoi un contexte GL refusé laisserait des murs flottant sur un fond transparent.
 */
import { useEffect, useRef, useState } from 'react';
import { worldBakeDeps } from '../backends/webgl/sceneMeshes';
import { memoByRefDeps } from '../../state/sceneMemo';
import { planPixels, renderPlanSnapshot } from './planSnapshot';
import { sceneMetresPerTile, type Scene } from '../../state/scene';
import type { Dims } from '../../geometry/iso';

const instantanéRetenu = memoByRefDeps<object, number>();

export function PlanWorldCanvas({ scene, z, onMatière }: {
  scene: Scene;
  /** Étage PLANIFIÉ — le même que celui de la surcouche SVG. */
  z: number;
  /** Verdict du dernier instantané : `false` = aucune matière peinte, l'hôte reprend ses sols en SVG. */
  onMatière?: (peinte: boolean) => void;
}): JSX.Element {
  const ref = useRef<HTMLCanvasElement | null>(null);
  const jeton = useRef({}).current;
  const [prises, setPrises] = useState(0);
  // BOÎTE MESURÉE du canevas : un état, parce qu'un redimensionnement n'est pas un rendu React — sans
  // lui, l'image resterait cuite pour la boîte du premier effet et la CSS l'étirerait.
  const [boîte, setBoîte] = useState({ w: 0, h: 0 });
  const mpt = sceneMetresPerTile(scene);
  const deps = worldBakeDeps(scene, mpt);
  useEffect(() => {
    const cible = ref.current;
    if (!cible || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => {
      setBoîte((p) => (p.w === cible.clientWidth && p.h === cible.clientHeight ? p : { w: cible.clientWidth, h: cible.clientHeight }));
    });
    ro.observe(cible);
    return () => ro.disconnect();
  }, []);
  useEffect(() => {
    const cible = ref.current;
    if (!cible) return;
    const mesuré = { w: cible.clientWidth, h: cible.clientHeight };
    const px = planPixels(dims(scene), mesuré);
    // `mesuré.w > 0` entre dans la clé : un instantané cuit HORS MESURE (avant mise en page) ne doit
    // jamais être retenu comme s'il valait pour la boîte réelle — la première mesure le refait.
    const n = instantanéRetenu(jeton, [...deps, z, px.w, px.h, mesuré.w > 0 && mesuré.h > 0], () => {
      const peinte = renderPlanSnapshot({ scene, mpt, z, cible, px });
      onMatière?.(peinte);
      return peinte ? prises + 1 : prises;
    });
    if (n !== prises) setPrises(n);
  });
  // `data-plan` : le nombre d'INSTANTANÉS réellement payés depuis le montage — un canevas n'a pas
  // d'arbre à interroger, et c'est la seule trace par laquelle la rétention se lit, à l'écran comme
  // au banc. C'est un ÉTAT, donc l'attribut vaut le compte de CE rendu, jamais celui d'avant.
  // Le canevas ne reçoit aucun pointeur : les clics restent au SVG posé par-dessus.
  return (
    <canvas
      ref={ref}
      className="topo-monde"
      aria-hidden="true"
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}
      data-plan={prises}
      data-boite={boîte.w > 0 ? `${boîte.w}x${boîte.h}` : undefined}
    />
  );
}

/** Grille du plan, en vue du dessus — la même que celle de la surcouche SVG. PUR. */
function dims(scene: Scene): Dims {
  return { w: scene.dimensions.w, h: scene.dimensions.h, view: 'top' };
}
