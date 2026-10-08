import { pregen, PREGEN } from '../../data/pregens';
import { itemFromTrappingById, recomputeLoadout } from '../../engine/items';
import { buildScene } from '../../state/mapSpec';
import { setEncounters } from './_shared';
import type { TestScenario } from './_shared';
import type { Combatant } from '../../engine/types';
import type { Scene } from '../../state/scene';

/**
 * PISTOLETS JUMELÉS (#1678 P4) — le porteur tient DEUX armes à Recharge (LDB 62 l.335), chacune avec SON
 * registre de charge (`engine/weaponLoad.ts`, `loadRegister`). La scène les AUTHORE vides
 * (`ItemInstance.loaded: false`) : l'entrée en combat ne les recharge pas, la case « Recharger » de la
 * console (`src/ui/CombatConsole.tsx`) s'allume dès le premier tour et, à deux armes, ouvre son
 * `PanneauParametre` (« Quelle arme recharger ? ») au lieu de dispatcher. Deux munitions compatibles en
 * besace : chaque chip de munition de l'en-tête ouvre aussi le sien, pour SON arme.
 */
function pistolier(): Combatant {
  const h = pregen(PREGEN.chasseur);
  const p1 = Object.assign(itemFromTrappingById('pistolet')!, { uid: 'pist-droit', loaded: false, reloadProgress: 0 });
  const p2 = Object.assign(itemFromTrappingById('pistolet')!, { uid: 'pist-gauche', loaded: false, reloadProgress: 0 });
  const balles = Object.assign(itemFromTrappingById('balle-et-poudre')!, { uid: 'mun-balles' });
  const petites = Object.assign(itemFromTrappingById('petites-munitions-et-poudre')!, { uid: 'mun-petites' });
  h.items = [...(h.items ?? []), p1, p2, balles, petites];
  h.loadouts = [{ id: 'lo-pistolets', main: p1.uid, off: p2.uid }];
  h.activeLoadoutId = 'lo-pistolets';
  recomputeLoadout(h);
  return h;
}

function construireScene(): Scene {
  const scene = buildScene({
    id: 'pistolets-jumeles',
    label: 'Pistolets jumelés — deux cycles de charge',
    desc: 'Une arène dégagée ; deux mutants à portée de pistolet.',
    size: [16, 10],
    terrain: 'herbe',
    heroStart: [3, 5],
    startMessage:
      { texte: 'Deux pistolets au poing, tous deux DÉCHARGÉS, et deux munitions en besace. « Recharger » ne sait ' +
      'pas laquelle des deux armes vous voulez : la case ouvre son panneau et vous la choisissez. Chaque chip ' +
      'de munition de l’en-tête ouvre le sien, pour SON arme.' },
  });
  setEncounters(scene, [
    {
      id: 'enc-pistolets',
      enemies: [
        { ref: 'mutant', pos: { x: 12, y: 4 }, facing: 'O' },
        { ref: 'mutant', pos: { x: 12, y: 7 }, facing: 'O' },
      ],
    },
  ]);
  return scene;
}

export const scenario: TestScenario = {
  id: 'pistolets-jumeles',
  order: 44,
  category: 'combat',
  icon: 'scenario/ambush',
  title: 'Pistolets jumelés — paramètre borné du rechargement',
  tests:
    'Un état de charge AUTHORÉ tient à l’entrée en combat (#1678 P4) : deux pistolets déclarés vides entrent ' +
    'vides. La case « Recharger » s’allume et, à deux armes à Recharge tenues au même set, ouvre son ' +
    'panneau-paramètre (« Quelle arme recharger ? », état de charge par candidat) au lieu de dispatcher ; ' +
    'l’élection joue le Test étendu sur l’arme choisie, Échap annule sans coût. Couvre aussi les DEUX chips ' +
    'de munition de l’en-tête (une par arme, deux munitions compatibles en besace).',
  partyNote: 'Chasseur seul, deux pistolets au poing (déchargés) + Balle et Poudre et Petites munitions en besace.',
  construire: () => ({ party: [pistolier()], scene: construireScene() }),
  autoCombat: 'enc-pistolets',
};
