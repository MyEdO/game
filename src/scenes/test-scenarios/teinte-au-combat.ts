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
 * TEINTE ET ARMURE AU COMBAT (#3456) — le corps d'un combattant porte, posées au combat, la teinte de son arme et les
 * pièces de son armure.
 *
 * La Lame aethyrique tient l'arme simple (forme épée) teinte `aethyrique` (`ItemInstance.teinte`, la teinte de l'Arme
 * aethyrique de `spells.json`) et porte des brassards, armure dont les localisations revêtent la pièce `brassards`
 * (`piecesDeLObjet`). L'orc, dont l'apparence déclare son armure de statbloc portée (`armurePortee`), en revêt les pièces
 * des localisations à PA. L'hôte pose la palette de la teinte sur les surfaces de l'élément qui monte l'arme.
 */

const HERO_START = { x: 3, y: 4 };
export const TEINTE = 'aethyrique';

/** La Lame aethyrique : l'épée teinte tenue, les brassards portés. */
function lameAethyrique(idNeuf: FabriqueDId): Combatant {
  const h = createHero({ idNeuf, speciesId: 'humains-reiklander', careerId: 'agitateur', label: 'Lame aethyrique', motivation: 'Test', seed: 3456, id: 'lame-aethyrique' });
  const porte = (id: string) => {
    const it = itemFromTrappingById(id, idNeuf)!;
    it.equipped = true;
    return it;
  };
  h.items = [{ ...porte('arme-simple'), teinte: TEINTE }, porte('brassards')];
  h.loadouts = undefined;
  h.activeLoadoutId = undefined;
  recomputeLoadout(h);
  h.appearance = { species: especeDApparence('humains-reiklander'), sex: 'M' };
  return h;
}

function construireScene(): Scene {
  const scene = arena({ id: 'test-teinte-au-combat', label: 'Teinte au combat', w: 12, h: 8, heroStart: HERO_START });
  setEncounters(scene, [{ id: 'enc-teinte', enemies: [{ creature: { id: 'orc' }, pos: { x: 7, y: 4 }, facing: 'O' }] }]);
  return scene;
}

export const scenario: TestScenario = {
  id: 'teinte-au-combat',
  order: 63,
  category: 'rendu',
  icon: 'scenario/embuscade',
  title: 'Teinte et armure au combat — l’arme teinte, les pièces de l’armure portée',
  tests:
    'Le corps de chaque combattant porte ce que sa donnée lui donne (#3456) : la Lame aethyrique tient l’épée teinte '
    + '« Aethyrique », dont la palette colore l’élément qui la monte, et porte des brassards, revêtus de la pièce qui couvre '
    + 'leurs localisations ; l’orc, son armure de statbloc déclarée portée, revêt les pièces de ses localisations à PA.',
  partyNote: 'Lame aethyrique (épée teinte, brassards) · Chasseur',
  construire: (idNeuf) => ({ party: [lameAethyrique(idNeuf), herosDeScenario(idNeuf, 'chasseur')], scene: construireScene() }),
  autoCombat: 'enc-teinte',
};
