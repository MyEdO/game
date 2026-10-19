/**
 * Faune d'ambiance du stage : les mouches qui tournoient au-dessus des cadavres, DANS le groupe caméra.
 *
 * Les voiles fixes par-dessus la scène (lueur chaude, corbeau, vignette, rideau de nuit) sont morts
 * avec la voie affine (#1176 P3-4, commit C5a) : le canevas volumique porte toute la luminosité de la
 * scène (`stage/stageLights.ts`, dosée sur la MÊME donnée `nightVeilMax`), et un voile par-dessus lui
 * appliquerait le palier de nuit une seconde fois.
 */
import { Scene } from '../../noyau/monde/scene';
import { Dims, tileCenter } from '../../geometry/iso';

/** Mouches qui tournoient au-dessus de chaque cadavre (faune d'ambiance) — dans le groupe caméra. */
export function Flies({ scene, dims }: { scene: Scene; dims: Dims }) {
  return (
    <>
      {scene.entities
        .filter((e) => e.kind === 'prop' && e.ref === 'cadavre')
        .map((e) => {
          const { cx, cy } = tileCenter(e.pos.x, e.pos.y, dims);
          return (
            <g key={`flies-${e.id}`} transform={`translate(${cx},${cy - 14})`} pointerEvents="none">
              {['f1', 'f2', 'f3'].map((f) => (
                <circle key={f} className={`fly ${f}`} r={1.5} fill="var(--iso-fauna)" />
              ))}
            </g>
          );
        })}
    </>
  );
}
