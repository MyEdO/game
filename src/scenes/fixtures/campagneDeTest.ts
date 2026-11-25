/** Le contenu de test du commun (#4936) : la campagne de test, le paquet de test (`defs-scenes/paquet-de-test.ts`) lu
 *  par `campagneDuPaquet`, une fiche de dossier de test, et le contenu d'un jeu qui les remet seules à l'affichage
 *  (`ContenuDUnJeu`, `src/hote/contenu.ts`). */
import { campagneDuPaquet, type BuiltinCampaign } from '../../noyau/index';
import { file } from '../../data/schemas/defs-scenes/paquet-de-test';
import { lireLesFiches } from '../../data/dossiers';
import paquetDeTest from './paquet-de-test.json';

export const campagneDeTest: BuiltinCampaign = campagneDuPaquet(paquetDeTest, file);

/** La fiche de dossier de test : un beat et un indice, que l'éditeur sert à ce qu'un paquet couvre ou écarte. */
const ficheDeTest = {
  lecture: { date: '2026-11-24', commit: '0000000000000000000000000000000000000000' },
  imperatifs: [],
  beats: [{ id: 'b1', titre: 'Beat de test', statut: 'non-qualifie', preuveDuStatut: 'Fixture de test.', mediasCandidats: ['scene-jouee'], ref: ['fixture de test'] }],
  pointsAuMJ: [],
  indices: [{ id: 'ind1', texte: 'Indice de test.', ref: ['fixture de test'] }],
  secrets: [],
  declencheurs: [],
  pnj: [],
  lieux: [],
  textes: [],
  tests: [],
  rencontres: [],
  recompenses: [],
  etats: [],
  dureeEtDifficulte: [],
  matiereCompagnons: [],
};

/** Le contenu d'un jeu qui ne remet que la campagne de test, aucun scénario hors du catalogue commun, et la fiche de
 *  test. */
export const contenuDeTest = { campagnes: [campagneDeTest], scenarios: [], dossiers: lireLesFiches({ 'TEST/01.json': ficheDeTest }) };
