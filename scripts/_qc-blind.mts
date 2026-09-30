/** QC AVEUGLE — planche de bipèdes monstrueux SANS étiquette de nom (seulement un n° de case).
 *  Les agents-vision identifient chaque case à l'aveugle ; on score vs la vérité (écrite à part,
 *  que les agents ne voient pas).
 *    npx tsx scripts/_qc-blind.mts <dossier-de-sortie>   → _blind-sheet.png + _blind-truth.json */
import { type CaseAveugle, type GrillePlanche, dossierDeSortie, ecrirePlanche } from './qc/aveugle.mjs';

// Record de créature + arme du catalogue, par id. L'ordre est mélangé pour ne pas suggérer un regroupement.
export const TRUTH: CaseAveugle[] = [
  { id: 'squelette', arme: 'lance' },
  { id: 'orc', arme: 'arme-simple' },
  { id: 'troll' },
  { id: 'gobelin', arme: 'lance' },
  { id: 'sanguinaire-de-khorne', arme: 'arme-simple' },
  { id: 'goule-de-crypte' },
  { id: 'minotaure', arme: 'grande-hache' },
  { id: 'snotling', arme: 'massue' },
  { id: 'vampire' },
  { id: 'zombie' },
  { id: 'ogre', arme: 'massue' },
  { id: 'gor', arme: 'grande-hache' },
  { id: 'skaven', arme: 'dague' },
];
// Pour chaque case : face + profil côte à côte (aide l'identification 3D).
export const GRILLE: GrillePlanche = {
  titre: 'Identifie chaque creature (face + profil par case)',
  vues: ['front', 'profile'], cols: 4, cw: 300, ch: 340, pieds: 285, echelle: () => 1.95,
};

if (import.meta.main) {
  const sortie = dossierDeSortie(process.argv[2], 'npx tsx scripts/_qc-blind.mts <dossier-de-sortie>');
  const png = ecrirePlanche(sortie, { png: '_blind-sheet.png', verite: '_blind-truth.json' }, TRUTH, GRILLE);
  console.log(`OK ${png} (${TRUTH.length} cases)`);
}
