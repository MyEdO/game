import { groupeVitrineDeScenario } from './_heros';
import { diligenceCampaign, paquetDuJeu } from '../campaign';
import type { TestScenario } from './_shared';

export const scenario: TestScenario = {
  id: 'diligence',
  order: 60,
  category: 'rendu',
  icon: 'scenario/village',
  title: 'La Diligence — exploration',
  tests: 'Exploration libre des deux niveaux : zones, portes/fenêtres, et les deux rampes qui montent à l’étage.',
  partyNote: 'Groupe vitrine (Soldat / Tueur / Sorcier / Chasseur) — exploration libre, aucun combat.',
  construire: (idNeuf) => ({ party: groupeVitrineDeScenario(idNeuf), scene: paquetDuJeu(diligenceCampaign).scenes[0] }),
};
