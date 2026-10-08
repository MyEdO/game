import { buildScene } from '../../state/mapSpec';
import { flowFromEffects } from '../../state/flow';
import { pregen, PREGEN } from '../../data/pregens';
import type { TestScenario } from './_shared';
import type { Scene } from '../../state/scene';

/**
 * MÉTAMORPHOSE — un Enfant d'Ulric (lycanthrope, Middenheim p.116) commence en forme HUMAINE et adopte sa
 * forme HYBRIDE (à tête de loup) au combat, pour le prix de DEUX Actions (op `transform` : delta de profil
 * RAW + Traits hybrides + apparence, persistant et réversible). Deux Enfants d'Ulric humains attendent
 * dans la clairière : dès l'engagement, l'IA les fait se transformer (le buff de combat vaut le coût), et
 * le rig affiche la tête de loup. Vitrine du verbe « se transformer » (données + moteur + IA + rendu).
 */
const W = 18, H = 12;

const construireScene = (): Scene => buildScene({
  id: 'clairiere-ulric',
  label: "Clairière des Enfants d'Ulric",
  desc: 'Une clairière cernée de bois où rôdent des lycanthropes.',
  size: [W, H],
  terrain: 'herbe',
  ambientLight: 'jour',
  heroStart: [2, 6],
  // Franchir la bande (x=6) déclenche l'affrontement au contact.
  triggers: [
    {
      id: 'entrer-clairiere',
      rect: { x: 6, y: 1, w: 1, h: 10 },
      once: true,
      flow: flowFromEffects([
        { type: 'journal', desc: "Deux villageois se dressent en grondant — leurs traits se déforment. En garde !" },
        { type: 'startCombat', encounter: 'enc-ulric' },
      ]),
    },
  ],
  encounters: [
    {
      id: 'enc-ulric',
      enemies: [
        { ref: 'enfant-d-ulric-humain', pos: { x: 12, y: 4 } }, // forme humaine → l'IA se métamorphose
        { ref: 'enfant-d-ulric-humain', pos: { x: 13, y: 8 } }, // idem : tête de loup à la transformation
      ],
    },
  ],
  startMessage:
    { texte: "Clairière des Enfants d'Ulric. Deux lycanthropes vous attendent sous forme HUMAINE. Avancez vers l'EST " +
    "pour les engager : à leur tour, ils prendront leur forme hybride à tête de loup (deux Actions), gagnant " +
    "les Caractéristiques et Traits du fauve. Observez la bascule d'apparence et de profil, puis abattez-les." },
});

export const scenario: TestScenario = {
  id: 'metamorphose-ulric',
  order: 17,
  category: 'creatures',
  icon: 'scenario/bestiary',
  title: "Métamorphose — Enfant d'Ulric",
  tests:
    "Verbe de transformation volontaire (op transform) : un Enfant d'Ulric humain adopte sa forme hybride " +
    "(delta de profil RAW + Traits + apparence tête-de-loup, persistant, réversible) au prix de deux Actions ; " +
    "auto-transformation de l'IA (self-buff valorisé data-driven), rendu du rig hybride.",
  partyNote: 'Groupe standard (Soldat · Sorcière · Tueur nain · Répurgateur) face à deux lycanthropes.',
  construire: () => ({
    party: [pregen(PREGEN.soldat), pregen(PREGEN.sorcier), pregen(PREGEN.tueur), pregen(PREGEN.repurgateur)],
    scene: construireScene(),
  }),
};
