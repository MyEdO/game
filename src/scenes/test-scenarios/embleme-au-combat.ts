import type { FabriqueDId } from '../../engine/fabriqueDId';
import { createHero } from '../../engine/character';
import { itemFromTrappingById, recomputeLoadout } from '../../engine/items';
import { especeDApparence } from '../../data';
import { herosDeScenario } from './_heros';
import type { Combatant } from '../../engine/types';
import { arena, setEncounters } from './_shared';
import type { TestScenario } from './_shared';
import type { Scene } from '../../noyau/monde/scene';

/**
 * EMBLÈME AU COMBAT (#3253) — le corps d'un combattant porte, posé au combat, l'emblème que nomme sa donnée.
 *
 * Le Porte-écu tient l'arme simple (forme épée) en main principale et le bouclier en main secondaire ; son apparence d'auteur nomme
 * l'emblème `taureau-rouge` de la garde-robe (`appearanceOverride.embleme`, lu par `emblemeDe`). L'hôte compose son
 * corps sur la base servie et pose l'emblème sur la surface `blason` de l'élément qui monte le bouclier, par la même
 * primitive que l'atelier (`MontageDeComposition`). Le Chasseur, puis l'orc, au contact après la charge, jouent le
 * tour d'un combat court.
 */

const HERO_START = { x: 3, y: 4 };
export const EMBLEME = 'taureau-rouge';

/** Le Porte-écu : épée et bouclier tenus, l'emblème de sa donnée. */
function porteEcu(idNeuf: FabriqueDId): Combatant {
  const h = createHero({ idNeuf, speciesId: 'humains-reiklander', careerId: 'soldat', label: 'Porte-écu', motivation: 'Test', seed: 3253, id: 'porte-ecu' });
  const tenu = (id: string) => {
    const it = itemFromTrappingById(id, idNeuf)!;
    it.equipped = true;
    return it;
  };
  h.items = [tenu('arme-simple'), tenu('bouclier')];
  h.loadouts = undefined;
  h.activeLoadoutId = undefined;
  recomputeLoadout(h);
  h.appearance = { species: especeDApparence('humains-reiklander'), sex: 'M' };
  h.appearanceOverride = { embleme: { id: EMBLEME } };
  return h;
}

function construireScene(): Scene {
  const scene = arena({ id: 'test-embleme-au-combat', label: 'Emblème au combat', w: 12, h: 8, heroStart: HERO_START });
  setEncounters(scene, [{ id: 'enc-embleme', enemies: [{ creature: { id: 'orc' }, pos: { x: 7, y: 4 }, facing: 'O' }] }]);
  return scene;
}

export const scenario: TestScenario = {
  id: 'embleme-au-combat',
  order: 62,
  category: 'rendu',
  icon: 'scenario/embuscade',
  title: 'Emblème au combat — le bouclier porte l’emblème de la donnée',
  tests:
    'Le corps de chaque combattant se compose sur la base servie (#3253) : le Porte-écu tient l’épée en main '
    + 'principale et le bouclier en main secondaire, et son apparence d’auteur nomme l’emblème « Tête de taureau rouge », '
    + 'posé sur la surface `blason` de l’élément qui monte le bouclier, comme à l’atelier. L’orc se compose sur la même base.',
  partyNote: 'Porte-écu (Soldat, épée et bouclier, emblème Tête de taureau rouge) · Chasseur',
  construire: (idNeuf) => ({ party: [porteEcu(idNeuf), herosDeScenario(idNeuf, 'chasseur')], scene: construireScene() }),
  autoCombat: 'enc-embleme',
};
