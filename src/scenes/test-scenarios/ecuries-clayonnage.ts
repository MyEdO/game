import { itemFromTrappingById, loadoutCreate, loadoutSetSlot, recomputeLoadout } from '../../engine/items';
import type { Combatant } from '../../engine/types';
import { pregen, PREGEN } from '../../data/pregens';
import { diligenceCampaign } from '../campaign';
import type { Scene } from '../../state/scene';
import { setEncounters } from './_shared';
import type { TestScenario } from './_shared';

/**
 * ÉCURIES DE LA DILIGENCE — banc de recette de l'OPACITÉ DÉCLARÉE PAR STRUCTURE (#1680) : une arête
 * `cloture-en-clayonnage` (`structures.json`, `occulte: false`) barre le pas SANS couper la Ligne de
 * Vue, là où un `mur-a-ossature-en-bois` coupe les deux.
 *
 * Tout se joue dans les stalles du rez-de-chaussée (zone `zone-e-z0`, « Écuries & remise ») : les 6
 * séparations de box sont 6 des 25 arêtes de clayonnage AUTHORÉES de la scène (les 19 autres ferment les
 * enclos et le jardin) — (21,29)E, (21,30)E,
 * (23,29)E, (23,30)E, (19,31)E, (19,32)E — jamais des arêtes posées pour le test.
 *
 * Le groupe arrive dans l'allée de la stalle EST : `startCombat` pose les héros en (24,31) et (24,32)
 * (`partyPos.x - 1`, `partyPos.y + i`).
 */

/** Départ du groupe : allée EST des écuries — cale les héros en (24,31)/(24,32) au démarrage du combat. */
const DEPART = { x: 25, y: 31 };

/** Le groupe entre dans les écuries, pas sur la route au nord de l'auberge. */
function poserDepart(base: Scene): Scene {
  return {
    ...base,
    entities: base.entities.map((e) => (e.kind === 'heroStart' ? { ...e, pos: { ...DEPART } } : e)),
  };
}

/** Aelindra (Chasseur) l'arc EN MAIN et son carquois — le pré-tiré ne porte qu'une fronde rangée, et
 *  le set d'armes par défaut (`ensureDefaultLoadout`) tient sa mêlée : on rend ACTIF un set à l'arc. */
function chasseurArme(): Combatant {
  const h = pregen(PREGEN.chasseur);
  const arc = itemFromTrappingById('arc')!;
  arc.equipped = true;
  const fleches = itemFromTrappingById('fleche')!;
  h.items = [...(h.items ?? []), arc, fleches];
  loadoutSetSlot(h, loadoutCreate(h), 'main', arc.uid);
  recomputeLoadout(h);
  return h;
}

const scene = poserDepart(structuredClone(diligenceCampaign.scenes[0]));
setEncounters(scene, [
  {
    id: 'enc-clayonnage',
    // Aucune mort n'est requise : la recette porte sur la LIGNE DE VUE. Le combat reste ouvert le
    // temps de viser les trois adversaires.
    victoryCondition: { type: 'surviveRounds', rounds: 3 },
    enemies: [
      // PREUVE (c) — tir PAR-DESSUS le clayonnage : posté contre l'arête (23,29)E, il est vu depuis
      // (24,31)/(24,32) et le tir part (couvert d'arête « Intermédiaire », +0).
      { ref: 'gobelin', pos: { x: 23, y: 29 }, facing: 'E' },
      // PREUVE (d) — le tireur ADVERSE voit et tire à travers SA cloison : posté contre (19,32)E,
      // dans la stalle du sud-ouest, l'arc à la main, à 5 cases du groupe.
      { ref: 'archer-gobelin', pos: { x: 19, y: 32 }, facing: 'E', weapon: 'arc' },
      // CONTRE-ÉPREUVE (c) — même distance, mur d'habitation PLEIN : derrière l'arête (25,31)E
      // (`mur-a-ossature-en-bois`, sans fenêtre), le tir est REFUSÉ faute de Ligne de Vue.
      { ref: 'gobelin', pos: { x: 26, y: 31 }, facing: 'O' },
    ],
  },
]);

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
  makeParty: () => [chasseurArme(), pregen(PREGEN.soldat)],
  scene,
  autoCombat: 'enc-clayonnage',
};
