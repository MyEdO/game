/* La compagnie du voyage, images d'intention (#3935) : la feuille de chaque héros (`HEROS`) ; leurs bustes sont ceux de
   `../gestes.js`. Ne dépend d'aucun socle ; se charge avant `commun.js`. */
const HEROS = [
  { id: 'bjorn', nom: 'Bjorn', car: 'Chasseur', pv: 16, max: 16, bourse: '14/–', chance: 3, resilience: 1, determination: 1 },
  { id: 'mira', nom: 'Mira', car: 'Éclaireuse', pv: 11, max: 11, bourse: '9/– 4 sc', chance: 2, resilience: 2, determination: 2 },
  { id: 'aldric', nom: 'Aldric', car: 'Érudit', pv: 12, max: 12, bourse: '2 CO 6/–', chance: 2, resilience: 1, determination: 1 },
  { id: 'greta', nom: 'Greta Hartmann', car: 'Soldate', pv: 8, max: 14, bourse: '1 CO 3/–', chance: 1, resilience: 2, determination: 2 },
];
// Partagé avec les scripts de page chargés après celui-ci.
Object.assign(globalThis, { HEROS });
