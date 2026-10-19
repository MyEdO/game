/**
 * CAPSULE ÉCRAN d'un acteur — le volume pieds→tête qu'il occupe une fois projeté : la caméra en tire
 * sa visée du sujet (`stage/MondeDeCampagne`) et la découpe locale son verdict d'occultation (`verdictPercage`,
 * `stage/percage.ts`). Rien ici ne connaît le peintre : c'est de la géométrie de scène.
 */
import { Dims, tileCenter, depth, type ActorCapsule } from '../../geometry/iso';
import { metricToLift } from '../../noyau/monde/relief';
import { ISO_PX_PER_M } from '../iso';
import { billboardHeightM } from '../backends/webgl/billboardMath';

/** CARRURE d'un corps, en fraction de sa TOISE — la forme MÉTRIQUE du rayon de capsule.
 *
 *  PROVENANCE, dite telle quelle : cette valeur n'est PAS une remesure du rig. Elle a été RÉSOLUE À
 *  L'ENVERS pour conserver le rayon déjà calibré de la voie SVG (`TW × 0,37 = 23,68 px`, #907) une fois
 *  celui-ci rapporté à la toise du corps dessiné : `23,68 / (BB_H × 0,58) = 0,27218…`, arrondi au
 *  millième. Le geste de C6 déplace donc l'UNITÉ (un rayon de corps se pose en mètres, pas en fraction
 *  de losange de grille), pas le réglage : l'écart résiduel est de 0,016 px. La REMESURE au rig — faire
 *  descendre ce rapport de la carrure réellement dessinée plutôt que de l'ancien calibrage — est le
 *  geste de #1324, avec le passage de l'occlusion 2D au raycast.
 *
 *  Ce que le calibrage doit tenir, lui, est MESURÉ à chaque run par `actorCapsule.test.ts` : couvrir la
 *  carrure la plus large qu'un héros puisse présenter (gabarit `courtaud` du Nain, `build` au maximum)
 *  sans la doubler. Sous-couvrir manquerait les occulteurs posés sur les épaules (le défaut d'origine,
 *  #907) ; sur-couvrir dégagerait des masses qui ne cachent rien. */
const CARRURE_PAR_TOISE = 0.272;

/** RAYON MONDE (m) de la capsule d'un acteur : sa carrure × la toise du corps DESSINÉ sur la scène
 *  (`billboardHeightM`, convention de la voie SVG). Le remplacement de l'occlusion 2D par un raycast
 *  (#1324) consommera CE rayon-là, sans conversion. */
export const ACTOR_CAPSULE_R_M = CARRURE_PAR_TOISE * billboardHeightM('heroique', 'personnage');

/** Le même rayon en pixels de la scène SVG — la seule frontière où la géométrie d'occlusion 2D le
 *  consomme (`ISO_PX_PER_M`, cadence unique px↔m de la projection). */
const TOKEN_HALF_WIDTH = ACTOR_CAPSULE_R_M * ISO_PX_PER_M;

export function actorCapsuleOf(
  actor: { x: number; y: number; h: number },
  dims: Dims,
): ActorCapsule {
  const base = metricToLift(actor.h);
  const top = base + 1;
  const foot = tileCenter(actor.x, actor.y, dims, base);
  const head = tileCenter(actor.x, actor.y, dims, top);
  return {
    segment: [{ x: foot.cx, y: foot.cy }, { x: head.cx, y: head.cy }],
    radius: TOKEN_HALF_WIDTH,
    depth: depth(actor.x, actor.y, dims, base),
    vertical: [base, top],
  };
}
