/** L'IDENTITÉ D'UN ÉCART ENTRE DEUX ÉVALUATIONS (#4338) : ce que `godot:evaluer --temoin` compare d'un rapport à l'autre. */
import type { Ecart } from './ecart.ts';

/** Un libellé de mesh dans un détail (`libellesDesMeshes`), gardé tel quel : ses nombres nomment, ils ne mesurent pas. */
const LIBELLE = /((?:base|élément \d+)\/[^,;:]+?#\d+)/u;
/** Un nombre isolé, hors d'un nom (`gabarit_head_plus`, `spine_01`, `Cube.001`) : une grandeur mesurée. */
const GRANDEUR = /(?<![\p{L}\d_.])-?\d+(?:\.\d+)?(?![\p{L}\d_])/gu;

/** L'identité de l'écart `e` : son code, son mesh, son clip, sa `valeur` si c'est un nom (l'endroit d'un écart de la garde
 *  `manifeste`, `evaluer.ts`) et la nature de son détail, chaque grandeur mesurée du détail remplacée par `n` hors des
 *  libellés de mesh qu'il cite. Deux runs qui rendent le même défaut, mesuré autrement, rendent la même identité. */
export function identiteDEcart(e: Pick<Ecart, 'code' | 'mesh' | 'clip' | 'valeur' | 'detail'>): string {
  const nature = e.detail.split(LIBELLE).map((morceau, i) => (i % 2 ? morceau : morceau.replace(GRANDEUR, 'n'))).join('');
  return [e.code, e.mesh ?? '', e.clip ?? '', typeof e.valeur === 'string' ? e.valeur : '', nature].join('\u0000');
}

/** Vrai si l'écart `e` est de la portée de libellés `portee` (#4814) : son mesh, ou un libellé de mesh que cite son
 *  détail, en est. */
export const deLaPortee = (e: Pick<Ecart, 'mesh' | 'detail'>, portee: ReadonlySet<string>): boolean =>
  (e.mesh !== undefined && portee.has(e.mesh)) || e.detail.split(LIBELLE).some((morceau, i) => i % 2 === 1 && portee.has(morceau));
