import { groupeVitrineDeScenario } from './_heros';
import type { AuthoredShipPoste, FireArc } from '../../engine/types';
import type { Scene, SceneEntity } from '../../noyau/monde/scene';
import { buildScene } from '../../noyau/mapSpec';
import type { TestScenario } from './_shared';

// Banc de RENDU de la caraque (#2987) : une coque `caraque` de vehicles.json, ses postes armés de canons moyens
// sur chaque bord, des Améliorations d'instance, ses sabords compris, et l'emblème de son apparence d'auteur, que
// l'hôte pose sur les surfaces `blason` de son élément 3D. La cogue adverse ouvre le combat.

const CARAQUE = 'caraque-rendu';
const AMELIORATIONS = ['sabord', 'figure-de-proue', 'ancre', 'nid-de-pie', 'clinfoc', 'fourquines', 'embarcation-de-bord', 'safran'];
const POSTES: readonly [FireArc, number][] = [['tribord', 3], ['babord', 3], ['proue', 1], ['poupe', 1]];

/** Un canon moyen au bord `side`. */
const canon = (side: FireArc): AuthoredShipPoste => ({ trappingId: 'canon-moyen', side });

const construireScene = (): Scene => buildScene({
  id: 'test-caraque',
  label: 'Caraque',
  desc: 'Une caraque armée et améliorée en mer ouverte (échelle MER 10 m/case).',
  size: [24, 12],
  terrain: 'eau',
  metresPerTile: 10, // MDG 13 l.362
  heroStart: [7, 5],
  entities: [
    { id: CARAQUE, kind: 'personnage', vehicule: { id: 'caraque' }, pos: { x: 6, y: 4 }, facing: 'E', label: 'La caraque',
      postes: POSTES.flatMap(([bord, n]) => Array.from({ length: n }, () => canon(bord))),
      upgrades: AMELIORATIONS.map((id) => ({ id })),
      appearance: { embleme: { id: 'taureau-rouge' } } } as SceneEntity,
    { id: 'cogue-rendu', kind: 'personnage', vehicule: { id: 'cogue' }, pos: { x: 20, y: 5 }, facing: 'O', label: 'La cogue pirate' } as SceneEntity,
  ],
  encounters: [
    { id: 'caraque', members: [{ entityId: CARAQUE, side: 'allie' }, { entityId: 'cogue-rendu', side: 'ennemi' }] },
  ],
});

export const scenario: TestScenario = {
  id: 'caraque',
  order: 64,
  category: 'naval',
  icon: 'scenario/naval',
  title: 'Caraque — coque, postes et Améliorations au rendu',
  tests:
    'Le corps d’une caraque (#2987) : l’hôte pose son élément 3D sur son empreinte, un canon à chaque poste de ses bords, '
    + 'ses sabords compris, la pièce de chaque Amélioration montée, et l’emblème « Tête de taureau rouge » sur ses voiles.',
  partyNote: 'Groupe d’arène embarqué (passagers de la caraque)',
  construire: (idNeuf) => ({ party: groupeVitrineDeScenario(idNeuf), scene: construireScene() }),
  autoCombat: 'caraque',
};
