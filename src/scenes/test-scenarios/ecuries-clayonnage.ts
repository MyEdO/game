import type { FabriqueDId } from '../../engine/fabriqueDId';
import { contexteDeNaissanceDObjet, itemFromTrappingById, loadoutCreate, loadoutSetSlot, recomputeLoadout } from '../../engine/items';
import type { Combatant } from '../../engine/types';
import { herosDeScenario } from './_heros';
import { diligenceCampaign } from '../campaign';
import { paquetDuJeu } from '../../noyau/index';
import type { Scene } from '../../noyau/monde/scene';
import { setEncounters } from './_shared';
import type { TestScenario } from './_shared';

/**
 * ÉCURIES DE LA DILIGENCE — banc de recette de l'OPACITÉ DÉCLARÉE PAR STRUCTURE (#1680) : une arête
 * `cloture-en-clayonnage` (`structures.json`, `occulte: false`) barre le pas SANS couper la Ligne de
 * Vue, là où un `mur-a-ossature-en-bois` coupe les deux.
 *
 * Tout se joue dans les stalles du rez-de-chaussée (zone `zone-e-z0`, « Écuries & remise ») : les 6
 * séparations de box sont 6 des 25 arêtes de clayonnage AUTHORÉES de la scène (les 19 autres ferment les
 * enclos et le jardin) — (29,35)E, (29,36)E,
 * (31,35)E, (31,36)E, (27,37)E, (27,38)E — jamais des arêtes posées pour le test.
 *
 * Le groupe arrive dans l'allée de la stalle EST : `lancerLeCombat` pose les héros en (32,37) et (32,38)
 * (`partyPos.x - 1`, `partyPos.y + i`).
 */

/** Départ du groupe : allée EST des écuries — cale les héros en (32,37)/(32,38) au démarrage du combat. */
const DEPART = { x: 33, y: 37 };

/** Le groupe entre dans les écuries, pas sur la route au nord de l'auberge. */
function poserDepart(base: Scene): Scene {
  return {
    ...base,
    entities: base.entities.map((e) => (e.kind === 'heroStart' ? { ...e, pos: { ...DEPART } } : e)),
  };
}

/** Le Chasseur l'arc EN MAIN et son carquois — le pré-tiré ne porte qu'une fronde rangée, et
 *  le set d'armes par défaut (`ensureDefaultLoadout`) tient sa mêlée : on rend ACTIF un set à l'arc. */
function chasseurArme(idNeuf: FabriqueDId): Combatant {
  const h = herosDeScenario(idNeuf, 'chasseur');
  const arc = itemFromTrappingById('arc', idNeuf, undefined, contexteDeNaissanceDObjet(h))!;
  const fleches = itemFromTrappingById('fleche', idNeuf, undefined, contexteDeNaissanceDObjet(h))!;
  h.items = [...(h.items ?? []), arc, fleches];
  loadoutSetSlot(h, loadoutCreate(h), 'main', arc.uid);
  recomputeLoadout(h);
  return h;
}

function construireScene(): Scene {
  const scene = poserDepart(structuredClone(paquetDuJeu(diligenceCampaign).scenes[0]));
  setEncounters(scene, [
    {
      id: 'enc-clayonnage',
      // Aucune mort n'est requise : la recette porte sur la LIGNE DE VUE. Le combat reste ouvert le
      // temps de viser les trois adversaires.
      victoryCondition: { type: 'surviveRounds', rounds: 3 },
      enemies: [
        // PREUVE (c) — tir PAR-DESSUS le clayonnage : posté contre l'arête (31,35)E, il est vu depuis
        // (32,37)/(32,38) et le tir part (couvert d'arête « Intermédiaire », +0).
        { creature: { id: 'gobelin' }, pos: { x: 31, y: 35 }, facing: 'E' },
        // PREUVE (d) — le tireur ADVERSE voit et tire à travers SA cloison : posté contre (27,38)E,
        // dans la stalle du sud-ouest, l'arc à la main, à 5 cases du groupe.
        { creature: { id: 'gobelin' }, pos: { x: 27, y: 38 }, facing: 'E', inventaire: { arc: false } },
        // CONTRE-ÉPREUVE (c) — même distance, mur d'habitation PLEIN : derrière l'arête (33,37)E
        // (`mur-a-ossature-en-bois`, sans fenêtre), le tir est REFUSÉ faute de Ligne de Vue.
        { creature: { id: 'gobelin' }, pos: { x: 34, y: 37 }, facing: 'O' },
      ],
    },
  ]);
  return scene;
}

export const scenario: TestScenario = {
  id: 'ecuries-clayonnage',
  order: 44,
  category: 'combat',
  icon: 'scenario/village',
  title: 'Écuries de la Diligence — voir par-dessus le clayonnage',
  tests:
    'Opacité déclarée par STRUCTURE (#1680) dans les écuries de La Diligence : un tir par-dessus une ' +
    'séparation de box en clayonnage (`occulte: false`) PART, avec le couvert d’arête « Intermédiaire » ' +
    '(+0) et jamais « pas de Ligne de Vue » ; un tireur adverse posté derrière une autre cloison de box ' +
    'voit le groupe et tire ; à distance comparable, un ennemi derrière un mur à ossature en bois est ' +
    'REFUSÉ (pas de Ligne de Vue) — l’arête de clayonnage restant INFRANCHISSABLE au déplacement.',
  partyNote: 'Chasseur (arc en main) + Soldat — départ dans l’allée est des écuries.',
  construire: (idNeuf) => ({ party: [chasseurArme(idNeuf), herosDeScenario(idNeuf, 'soldat')], scene: construireScene() }),
  autoCombat: 'enc-clayonnage',
};
