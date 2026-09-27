import { describe, expect, it } from 'vitest';
import { emptyScene, type Scene } from '../../state/scene';
import { aretesUtilisables, type AreteUtilisable, type ContexteAretes } from '../../state/aretes';
import type { RoomPortal } from '../../state/roomPortals';
import type { BattleState } from '../../state/store';
import type { Combatant } from '../../engine/types';
import type { Dims } from '../../geometry/iso';
import { projeterAretes } from './aretesProjetees';

/**
 * CE QUE LA PROJECTION REFUSE (#1687, lot 1b-2) — `projeterAretes` écarte en silence l'arête qu'elle
 * ne sait pas poser (côté non cardinal). Ce banc dit QUI tombe là : PERSONNE. Une arête utilisable que
 * la projection refuserait serait un geste offert sans pixel qui l'atteigne — c'est ici que ça rougit,
 * et non dans un journal de dev. Il mesure AUSSI que chaque offre se pose au LIFT MÉTRIQUE de son
 * ancrage, relief de la couche 0 compris (lot 1b-5).
 */

const dims: Dims = { w: 5, h: 4, rot: 0, view: 'iso' };

/** Une scène qui porte les QUATRE capacités à la fois : une paroi grimpable en (1,1,E) avec la case
 *  d'en face 4 m plus haut (donc aussi des chutes depuis cette case haute), une fortification en
 *  (3,3,E), et un accès de pièce en (0,1,E). */
function scèneAuxQuatreCapacités(): Scene {
  const s = emptyScene(dims.w, dims.h);
  const h = new Array(dims.w * dims.h).fill(0) as number[];
  h[1 * dims.w + 2] = 4;
  s.layers[0].height = h;
  s.walls = [
    { x: 1, y: 1, side: 'E', climb: { kind: 'surface' } },
    { x: 3, y: 3, side: 'E', structure: 'mur-a-ossature-en-bois' },
  ];
  return s;
}

const passage: RoomPortal = {
  id: '0,1,E,0:room-a:room-b',
  z: 0,
  edge: { x: 0, y: 1, side: 'E' },
  fromZoneId: 'room-a',
  toZoneId: 'room-b',
  kind: 'passage',
  exterior: false,
  from: { x: 0, y: 1 },
  to: { x: 1, y: 1 },
};

const bataille: BattleState = ({
  combatants: [{ id: 'structure-3-3-E-0', label: 'Mur à ossature en bois' } as unknown as Combatant],
  order: [],
  turn: 0,
} as unknown as BattleState);

const toutVu = (): Set<string> => {
  const vu = new Set<string>();
  for (let x = 0; x < dims.w; x += 1) for (let y = 0; y < dims.h; y += 1) vu.add(`${x},${y},0`);
  return vu;
};

const contexte = (controleur: ContexteAretes['controleur']): ContexteAretes => ({
  scene: scèneAuxQuatreCapacités(),
  visible: toutVu(),
  controleur,
  activeZ: 0,
  battle: bataille,
  portails: [passage],
});

/** Les arêtes des trois postures de contrôleur qui font parler les quatre dériveurs : au pied de la
 *  paroi (escalade + porte + structure), sur la case haute (chutes), et sans contrôleur (aucune offre
 *  — hors de mon tour, rien ne se joue). */
const parPosture = (): { posture: string; aretes: AreteUtilisable[] }[] => [
  { posture: 'au pied de la paroi', aretes: aretesUtilisables(contexte({ x: 1, y: 1, z: 0 })) },
  { posture: 'sur la case haute', aretes: aretesUtilisables(contexte({ x: 2, y: 1, z: 0 })) },
  { posture: 'sans contrôleur', aretes: aretesUtilisables(contexte(null)) },
];

describe('projeterAretes — ce que la projection écarte, et rien d’autre', () => {
  it('le dériveur fait bien parler les quatre capacités (sans quoi rien n’est mesuré)', () => {
    const capacites = new Set(parPosture().flatMap(({ aretes }) => aretes.map((a) => a.capacite)));
    expect([...capacites].sort()).toEqual(['chute', 'escalade', 'porte', 'structure']);
  });

  it('aucune arête utilisable n’a de côté DIAGONAL : le refus par côté est inatteignable', () => {
    const diagonales = parPosture().flatMap(({ posture, aretes }) => aretes
      .filter((a) => a.side !== 'N' && a.side !== 'E')
      .map((a) => `${posture} : ${a.capacite} ${a.cle} (${a.side})`));
    expect(diagonales).toEqual([]);
  });

  it('AUCUNE arête offerte n’est écartée : tout ce que le dériveur rend est atteignable au pixel', () => {
    const ecartees = parPosture().flatMap(({ posture, aretes }) => {
      const projetees = new Set(projeterAretes(aretes, dims, () => 0).map((p) => p.arete));
      return aretes.filter((a) => !projetees.has(a)).map((a) => `${posture} : ${a.capacite} ${a.cle} (côté ${a.side})`);
    });
    expect(ecartees).toEqual([]);
  });
});
