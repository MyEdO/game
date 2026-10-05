import { makeShowcaseParty } from '../../data/pregens';
import { itemFromTrappingById } from '../../engine/items';
import { areneCampaign, paquetDuJeu } from '../campaign';
import type { TestScenario } from './_shared';

/**
 * Arène 2.0 — recette de la campagne vitrine : on démarre AU BOURG (et non en zone 1) avec le
 * groupe pré-tiré, des rations et de quoi marchander. Tout le projet est chargé (ses scènes +
 * carte du monde) : échelle des 13 portes via le Maître, taverne/chapelle/forge, contrats et
 * voyage (#T2). Point d'entrée Playwright de la recette navigateur.
 */
function groupe() {
  const party = makeShowcaseParty();
  // De quoi tester voyage (rations) et marchands sans grinder la zone 1.
  for (const h of party) {
    const ration = itemFromTrappingById('ration');
    if (ration) h.items = [...(h.items ?? []), ration];
  }
  return party;
}

export const scenario: TestScenario = {
  id: 'arene',
  order: 8,
  category: 'scenarios',
  icon: 'scenario/arena',
  title: 'Arène 2.0 — le Bourg',
  tests: 'campagne vitrine complète : Bourg (bâtiments/intérieurs), échelle des 13 zones, contrats, carte du monde, marchands, fouilles',
  partyNote: 'Groupe d’arène pré-tiré (+1 ration chacun)',
  construire: () => {
    const { scenes, worldMap, narratif } = paquetDuJeu(areneCampaign);
    return {
      party: groupe(),
      scene: scenes.find((s) => s.id === 'arene-hub')!,
      extraScenes: scenes.filter((s) => s.id !== 'arene-hub'),
      worldMap,
      narratif,
    };
  },
};
