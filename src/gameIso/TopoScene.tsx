/**
 * TopoScene — vue TOP-DOWN d'une scène (plan de niveau / minimap). N'est PAS un 2ᵉ moteur
 * d'affichage : le monde lui vient du MÊME pipeline que le stage de jeu — la MATIÈRE (les sols de
 * l'étage) en instantané volumique posé SOUS le SVG (`stage/PlanWorldCanvas`), la STRUCTURE (les murs)
 * au trait SVG (`stage/layers.wallTraitObjs`, la couche de la vue du dessus de JEU) : la coiffe d'un mur
 * volumique tombe sous le pixel à l'échelle d'un plan (mesure au JSDoc de `stage/planSnapshot.ts`), là
 * où le trait, COUPE HORIZONTALE du volume à son épaisseur monde, tient un PLANCHER en px écran (lu sur
 * l'échelle `meet` du plan, `viewBoxMeetScale`, posée sur le groupe des murs).
 * En `view:'top'` le mur se rend en trait ; LOD 0 = silhouette plate. La minimap sélectionne
 * DÉLIBÉRÉMENT la sous-couche STRUCTURELLE — pas de toits/props/tokens/fx/highlights (game-only).
 * La COUCHE DE TRAIT est celle de la vue du dessus de JEU (`stage/layers.wallTraitObjs`) : une seule
 * loi de composition pour les deux plans du dessus (`stage/viewPolicy`).
 * Par-dessus : une couche de MARQUEURS de station + des pastilles de combattants optionnelles —
 * affordances cliquables et symboles d'état restent en SVG.
 * SANS CONTEXTE VOLUMIQUE, le plan n'a plus de matière : il le DIT (`stage/SansWebgl`) au lieu de
 * laisser flotter des murs sur un fond transparent (#1176 P3-4, commit C5a — la reprise des sols en
 * SVG est morte avec la voie affine).
 */
import { useRef, useState, type CSSProperties } from 'react';
import { wallTraitObjs } from './stage/layers';
import { PlanWorldCanvas } from './stage/PlanWorldCanvas';
import { SansWebgl } from './stage/SansWebgl';
import { styleDEchelleEcran, viewBoxMeetScale } from './stage/stageCam';
import { useCadreDuSvg } from './stage/useCadreDuSvg';
import { stageSize, tileCenter, type Dims } from '../geometry/iso';
import { IconG } from '../ui/Icon';
import { MARKER_R, stationMarker, colocationOffsets } from './topoMarkers';
import { relationColor } from './teamColors';
import type { Scene } from '../state/scene';
import type { Station } from '../state/stations';
import type { Combatant } from '../engine/types';

/** Rayon écran (px) d'une pastille de combattant. */
const DOT_R = 7;
/** Anneau de sélection (px au-delà du disque). */
const RING_GAP = 4;

export interface TopoSceneProps {
  scene: Scene;
  stations: Station[];
  /** Pastilles de repérage (localiser un héros / un servant) — optionnel. */
  combatants?: Combatant[];
  selectedStationId?: string;
  /** Étage à PLANIFIER (défaut : le rez). Le plan n'en montre qu'UN — cf. `wallTraitObjs`. */
  z?: number;
  viewport?: { w: number; h: number };
  onSelectStation?: (s: Station) => void;
  onSelectEntity?: (combatantId: string) => void;
}

export function TopoScene({ scene, stations, combatants, selectedStationId, z = 0, viewport, onSelectStation, onSelectEntity }: TopoSceneProps) {
  // MATIÈRE PEINTE par le canevas volumique ? Un contexte GL refusé (machine sans accélération, budget
  // de contextes épuisé) laisserait des murs flottant sur un fond transparent : le plan DIT alors qu'il
  // ne peut pas être dessiné. Vrai tant que rien n'a échoué.
  const [matièreVolumique, setMatièreVolumique] = useState(true);
  const dims: Dims = { w: scene.dimensions.w, h: scene.dimensions.h, view: 'top' };
  const { w, h } = stageSize(dims);
  const murs = useRef<SVGGElement>(null);
  const cadre = useCadreDuSvg(murs, { w, h });
  return (
    // Le canevas de matière et le SVG partagent EXACTEMENT la même boîte (100 %×100 % de ce conteneur) :
    // c'est la condition du `meet` commun — deux boîtes différentes se letterboxeraient différemment, et
    // les marqueurs quitteraient leurs cases.
    <div
      style={viewport
        ? { position: 'relative', width: viewport.w, height: viewport.h }
        : { position: 'relative', width: '100%', height: '100%' }}
    >
    <PlanWorldCanvas scene={scene} z={z} onMatière={setMatièreVolumique} />
    {!matièreVolumique && <SansWebgl compact />}

    <svg
      className="topo-scene"
      viewBox={`0 0 ${w} ${h}`}
      width={viewport?.w ?? '100%'}
      height={viewport?.h}
      preserveAspectRatio="xMidYMid meet"
      // Sans viewport imposé : REMPLIT son conteneur (100 %×100 %) et se letterbox via `meet` → tout le
      // plan tient dans la boîte bornée du consommateur, sans scroll ni effondrement à 0. Le conteneur
      // porte la hauteur définie (cf. `.topo-panel`).
      style={viewport
        ? { display: 'block', position: 'relative' }
        : { width: '100%', height: '100%', display: 'block', position: 'relative' }}
    >
      <g ref={murs} style={styleDEchelleEcran(viewBoxMeetScale({ w, h }, cadre)) as CSSProperties}>{wallTraitObjs(scene, dims, z).map((o) => o.el)}</g>
      {(() => {
        // Les marqueurs suivent l'étage PLANIFIÉ comme la structure : pointer une station d'un autre
        // niveau sur ce plan la placerait dans des murs qui n'y sont pas.
        const here = stations.filter((s) => (s.pos.z ?? 0) === z);
        const offsets = colocationOffsets(here, dims);
        return here.map((s) => {
        const m = stationMarker(s, dims, selectedStationId, offsets.get(s.id));
        return (
          <g
            key={s.id}
            className="topo-station"
            role={onSelectStation ? 'button' : undefined}
            onClick={onSelectStation ? () => onSelectStation(s) : undefined}
            style={onSelectStation ? { cursor: 'pointer' } : undefined}
          >
            {m.wedge && <path d={m.wedge} fill={m.tint} opacity={0.45} />}
            {m.ring && <circle cx={m.cx} cy={m.cy} r={MARKER_R + RING_GAP} fill="none" stroke="var(--gold)" strokeWidth={2.5} />}
            <circle cx={m.cx} cy={m.cy} r={MARKER_R} fill={m.tint} stroke="#0009" strokeWidth={1.5} opacity={s.manned ? 1 : 0.55} />
            <g color="#0d0d0d">
              <IconG id={s.icon} x={m.cx - MARKER_R * 0.65} y={m.cy - MARKER_R * 0.65} size={MARKER_R * 1.3} />
            </g>
            {m.badge != null && (
              <>
                <circle cx={m.cx + MARKER_R * 0.8} cy={m.cy - MARKER_R * 0.8} r={7} fill="#111" stroke={m.tint} strokeWidth={1.5} />
                <text x={m.cx + MARKER_R * 0.8} y={m.cy - MARKER_R * 0.8} fill="#fff" fontSize={9} textAnchor="middle" dominantBaseline="central">
                  {m.badge}
                </text>
              </>
            )}
          </g>
        );
        });
      })()}
      {combatants?.map((c) => {
        if (!c.pos || (c.pos.z ?? 0) !== z) return null; // un plan d'étage ne pointe pas les corps d'un autre
        const { cx, cy } = tileCenter(c.pos.x, c.pos.y, dims, c.pos.z ?? 0);
        return (
          <circle
            key={c.id}
            className="topo-entity"
            cx={cx}
            cy={cy}
            r={DOT_R}
            fill={relationColor(c.kind)}
            stroke="#000"
            strokeWidth={1.5}
            role={onSelectEntity ? 'button' : undefined}
            onClick={onSelectEntity ? () => onSelectEntity(c.id) : undefined}
            style={onSelectEntity ? { cursor: 'pointer' } : undefined}
          />
        );
      })}
    </svg>
    </div>
  );
}
