/* La compagnie du voyage, images d'intention (#3935) : le buste de base, celui de chaque héros et leur feuille (`HEROS`). Ne dépend d'aucun socle :
   `commun.js` le charge avant lui, le combat naval aussi (`../voyage/navale.js`, sur `../combat/socle.js`). */
const BASE = '<path d="M14 90c0-18 8-26 20-28l-2-8c-6-5-8-16-4-24 4-7 18-7 22 0 4 8 2 19-4 24l-2 8c12 2 20 10 20 28z"/>';
const COMPAGNIE = {
  bjorn: BASE + '<path d="M24 31c0-12 7-19 15-19s15 7 15 19c-10-5-20-5-30 0z" fill="#1c1410"/>',
  mira: BASE + '<path d="M22 40c-3-17 5-29 17-29s20 12 17 29c4 10 4 22 2 33l-8-6c2-10 1-20-3-27-4-5-12-5-16 0-4 7-5 17-3 27l-8 6c-2-11-2-23 2-33z" fill="#1c1410"/>',
  aldric: BASE + '<path d="M25 30c0-11 6-18 14-18s14 7 14 18c-9-4-19-4-28 0z" fill="#1c1410"/><path d="M25 27c9-4 19-4 28 0v5c-9-4-19-4-28 0z" fill="#e9dcc0"/>',
  greta: BASE + '<circle cx="39" cy="8" r="6.500" fill="#1c1410"/><path d="M24 33c-1-13 6-21 15-21s16 8 15 21c-4-7-9-10-15-10s-11 3-15 10z" fill="#1c1410"/>',
};
const HEROS = [
  { id: 'bjorn', nom: 'Bjorn', car: 'Chasseur', pv: 16, max: 16, bourse: '14/–', chance: 3, resilience: 1, determination: 1 },
  { id: 'mira', nom: 'Mira', car: 'Éclaireuse', pv: 11, max: 11, bourse: '9/– 4 sc', chance: 2, resilience: 2, determination: 2 },
  { id: 'aldric', nom: 'Aldric', car: 'Érudit', pv: 12, max: 12, bourse: '2 CO 6/–', chance: 2, resilience: 1, determination: 1 },
  { id: 'greta', nom: 'Greta Hartmann', car: 'Soldate', pv: 8, max: 14, bourse: '1 CO 3/–', chance: 1, resilience: 2, determination: 2 },
];
// Partagé avec les scripts de page chargés après celui-ci.
Object.assign(globalThis, { BASE, COMPAGNIE, HEROS });
