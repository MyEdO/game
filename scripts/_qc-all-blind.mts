/** QC AVEUGLE de TOUS les modèles (bipèdes + quadrupèdes + ailés), mélangés, sans label.
 *    npx tsx scripts/_qc-all-blind.mts <dossier-de-sortie>   → _qc-all-blind.png + _qc-all-truth.json (vérité privée) */
import { type CaseAveugle, type GrillePlanche, dossierDeSortie, ecrirePlanche } from './qc/aveugle.mjs';

// Def non bipède, ou record bipède + arme du catalogue, par id. Ordre MÉLANGÉ (pas de regroupement par gabarit).
export const ENTRIES: CaseAveugle[] = [
  { id: 'squelette', arme: 'lance' },
  { id: 'loup' },
  { id: 'dragon' },
  { id: 'orc', arme: 'arme-simple' },
  { id: 'cheval' },
  { id: 'goule-de-crypte' },
  { id: 'pegase' },
  { id: 'gobelin', arme: 'lance' },
  { id: 'sanglier' },
  { id: 'sanguinaire-de-khorne', arme: 'arme-simple' },
  { id: 'minotaure', arme: 'grande-hache' },
  { id: 'griffon' },
  { id: 'ours' },
  { id: 'vampire' },
  { id: 'zombie' },
  { id: 'rat-geant' },
  { id: 'snotling', arme: 'massue' },
  { id: 'hippogriffe' },
  { id: 'ogre', arme: 'massue' },
  { id: 'gor', arme: 'grande-hache' },
  { id: 'troll' },
  { id: 'chien' },
  { id: 'skaven', arme: 'dague' },
];
export const GRILLE: GrillePlanche = {
  titre: 'Identifie chaque creature (profil gauche + face droite par case)',
  vues: ['profile', 'front'], cols: 6, cw: 300, ch: 330, pieds: 280, echelle: (sl) => 1.35 * sl,
};

if (import.meta.main) {
  const sortie = dossierDeSortie(process.argv[2], 'npx tsx scripts/_qc-all-blind.mts <dossier-de-sortie>');
  const png = ecrirePlanche(sortie, { png: '_qc-all-blind.png', verite: '_qc-all-truth.json' }, ENTRIES, GRILLE, 1900);
  console.log(`OK ${png} (${ENTRIES.length} creatures)`);
}
