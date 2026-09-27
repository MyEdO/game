import { DEFAULT_RELIEF_DEFAULTS, DEFAULT_ROOF_DEFAULTS, Scene, Terrain } from '../state/scene';
import { buildEncounter } from '../state/encounterAuthoring';

const W = 22;
const H = 16;

/**
 * Scène de FIXTURE pour les tests de combat (neutre, sans contenu de campagne), construite à l'appel
 * (#1692). Grille d'herbe praticable + un point de départ héros. Dimensions et `heroStart` fixés pour
 * rester un drop-in (les tests qui se déplacent relativement à (6,10) restent valides). Rencontre
 * `enc-mutants` (3 Mutants) : les tests de combat font `startCombat('enc-mutants')` puis adaptent les
 * combattants à leur cas (Taille, États…).
 */
export function testScene(): Scene {
  const enc = buildEncounter({
    id: 'enc-mutants',
    enemies: [
      { ref: 'mutant', pos: { x: 16, y: 11 } },
      { ref: 'mutant', pos: { x: 18, y: 12 } },
      { ref: 'mutant', pos: { x: 17, y: 13 } },
    ],
  });
  return {
    type: 'scene',
    reliefDefaults: { ...DEFAULT_RELIEF_DEFAULTS }, roofDefaults: { ...DEFAULT_ROOF_DEFAULTS },
    id: 'test-fixture',
    label: 'Terrain de test',
    desc: 'Scène neutre pour les tests de combat.',
    dimensions: { w: W, h: H },
    ambiance: 'exterieur',
    layers: [{ z: 0, tiles: new Array(W * H).fill('herbe') as Terrain[] }],
    entities: [{ id: 'start', kind: 'heroStart', pos: { x: 6, y: 10 } }, ...enc.entities],
    dialogues: [],
    triggers: [],
    encounters: [enc.encounter],
    flags: {},
  };
}
