import { makeShowcaseParty } from '../../data/pregens';
import { addItemToHero } from '../../engine/items';
import { parseProject } from '../../state/worldMap';
import areneProjet from '../arene/arene-projet.json';
import type { TestScenario } from './_shared';

/**
 * Arène 2.0 — recette de la campagne vitrine : on démarre AU BOURG (et non en zone 1) avec le
 * groupe pré-tiré, des rations et de quoi marchander. Tout le projet est chargé (20 scènes +
 * carte du monde) : échelle des 13 portes via le Maître, taverne/chapelle/forge, contrats et
 * voyage (#T2). Point d'entrée Playwright de la recette navigateur.
 */
const { scenes, worldMap } = parseProject(areneProjet);
const hub = scenes.find((s) => s.id === 'arene-hub')!;

function groupe() {
  // De quoi tester voyage (rations) et marchands sans grinder la zone 1.
  return makeShowcaseParty().map((h) => addItemToHero(h, 'ration'));
}

export const scenario: TestScenario = {
  id: 'arene',
  order: 8,
  category: 'scenarios',
  icon: 'scenario/arena',
  title: 'Arène 2.0 — le Bourg',
  tests: 'campagne vitrine complète : Bourg (bâtiments/intérieurs), échelle des 13 zones, contrats, carte du monde, marchands, fouilles',
  partyNote: 'Groupe d’arène pré-tiré (+1 ration chacun)',
  makeParty: groupe,
  scene: hub,
  extraScenes: scenes.filter((s) => s.id !== 'arene-hub'),
  worldMap,
};
