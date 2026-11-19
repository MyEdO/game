/**
 * La fuite (#4411) : Ilyanwe fuit, l'Orc frappe dans le dos ; le Test de Calme de la fuyarde contre le coup de l'Orc,
 * et les États Brisé que le coup pose (LDB 15 l.59-66 ; `touche-en-fuyant`, `src/data/regles.json`)
 * (`../../combat-suite.md`, section `fuite`).
 */
import { apresLeDe, COMBATTANTS, RESERVES, reserves, TOUR_D_ILYANWE } from './dome.ts';
import type { Ecran } from './maquette.ts';

export default {
  etats: [{
    nom: 'fuite', gabarit: 'fenetre-du-bas', cour: { etat: 'fuite' }, combattants: COMBATTANTS,
    combat: TOUR_D_ILYANWE(['Orc touche Ilyanwe la Voilée au bras droit.', 'Ilyanwe la Voilée veut rompre le combat.', 'Ilyanwe la Voilée fuit — Orc frappe dans le dos.']),
    fenetre: {
      titre: 'Fuite',
      heros: { role: 'testeur', qui: 'ilyanwe', test: 'Calme · Touché en fuyant', seuil: 52, jet: { des: [70, 1], dr: -2, reussite: false } },
      autre: { role: 'testeur', qui: 'orc', test: 'Corps à corps (Base) · Avantage 2', seuil: 75, modificateurs: [{ nom: 'Dos tourné', valeur: 20 }], jet: { des: [20, 4], dr: 5, reussite: true } },
      centre: { role: 'consequence', arme: 'Hache', coup: 'coup dans le dos', etats: { nombre: 3, etat: 'Brisé' }, issue: 'Orc touche Ilyanwe la Voilée dans le dos : elle fuit, Brisée.' },
      gestes: apresLeDe(RESERVES.ilyanwe, { echec: true }), reserves: reserves(RESERVES.ilyanwe),
    },
  }],
} satisfies Ecran;
