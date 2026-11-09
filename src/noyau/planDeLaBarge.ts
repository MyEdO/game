/**
 * Les ponts de la barge fluviale en `MapSpec` que `buildScene` compile (#3772), lus dans `ponts` de sa fiche
 * (`pontsDeLaFiche`) : `z0` cale, `z1` pont principal, cabines du rouf et plates-formes de proue et de poupe, `z2` toits
 * du rouf et passerelle. Ce qui s'écrit ici : son décor (`DECOR`), que la scène garde ou retire, et le sol du pont sous
 * la cargaison (`SOLS`).
 */
import type { MapSpec, ReliefSpec } from './mapSpec';
import type { SceneEntity } from './monde/scene';
import type { Dir4 } from '../geometry/dir8';
import type { Calage } from '../data/props.types';
import { garanti } from '../lib/garanti';
import { pontsDeLaFiche } from './pontsDeLaFiche';

const { hauteurs: HAUTEURS, plan: PONTS_DE_LA_BARGE } = pontsDeLaFiche('barge-fluviale');

/** Le glyphe du pont principal dans la source. */
const PONT = 'p';

/** Le sol du pont principal aux deux bords du pont avant, sous la cargaison : hors des cases du plan, le bordé n'y
 *  laissant pas un occupant debout, il porte la cargaison et le fanal de bâbord (`SceneEntity` au pied de sa case). */
const SOLS: ReliefSpec[] = [0, 2].map((y): ReliefSpec => ({ rect: [1, y, 2, y], height: garanti(HAUTEURS[PONT], PONT, 'hauteur du pont'), z: 1 }));

/** Le décor de la barge, valeur d'adaptation relevée sur la planche du Bérébéli (profil, plan « Main Deck ») : le décor
 *  (`decor`, id de `props.json`), la case du coin nord-ouest de son emprise, son pont, son cap et son calage dans le jeu libre
 *  de sa case (`SceneEntity.calage`, centré sans lui). Fanaux : deux sur la plate-forme de proue, un au pont avant, un
 *  au flanc du rouf, un sur le toit du bloc avant, deux sur celui de la maison ; la pile de tonneaux sur le toit du bloc,
 *  à bâbord du mât ; la cargaison bâchée de part et d'autre de l'allée du pont avant. */
const DECOR: readonly (readonly [ref: string, x: number, y: number, z: number, facing: Dir4, calage: Calage])[] = [
  ['fanal', 0, 1, 1, 'S', { x: -0.57, y: -0.91 }], ['fanal', 0, 1, 1, 'S', { x: -0.57, y: 0.91 }],
  ['fanal', 1, 2, 1, 'S', { x: -0.86, y: -0.34 }], ['fanal', 5, 2, 1, 'S', { x: -0.11, y: -0.02 }],
  ['fanal', 3, 0, 2, 'S', { x: -0.91, y: 0.51 }], ['fanal', 4, 2, 2, 'S', { x: -0.34, y: -0.39 }], ['fanal', 5, 0, 2, 'S', { x: 0, y: 0.39 }],
  ['tonneaux-pile', 3, 1, 2, 'E', { x: 0.96, y: 1 }],
  ['cargaison-bachee', 1, 0, 1, 'S', { x: 0.89, y: 1 }], ['cargaison-bachee', 1, 2, 1, 'S', { x: 0.89, y: -1 }],
];

/** Les décors de `DECOR`, chacun sous l'id de son décor suivi de son rang. */
const DECORS: SceneEntity[] = DECOR.map(([ref, x, y, z, facing, calage], i): SceneEntity => ({
  id: `${ref}-${DECOR.slice(0, i + 1).filter(([r]) => r === ref).length}`,
  kind: 'prop',
  decor: { id: ref },
  pos: { x, y },
  z,
  facing,
  calage,
}));

/** La barge fluviale en `MapSpec`. */
export const PLAN_DE_LA_BARGE: MapSpec = { ...PONTS_DE_LA_BARGE, relief: SOLS, entities: DECORS };
