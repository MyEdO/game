/**
 * Le butin (#4411) : le corps du voyageur fouillé sur la route, l'argent réparti entre les bourses, une case par héros
 * pour chaque objet, son Encombrement en rouge quand il porte déjà tout ce qu'il peut (LDB 61 l.33) ; ce qui reste va à
 * un héros (`../../exploration-et-recit.md`, section `butin`).
 */
import { combattants } from './compagnie.ts';
import { LA_ROUTE, LE_CORPS, NUIT_SUR_LA_ROUTE } from './designation-d-un-heros.ts';
import type { Ecran } from './maquette.ts';

export default {
  etats: [{
    nom: 'butin', gabarit: 'lieu-et-voyage', decor: 'grand-route', titre: LA_ROUTE,
    journal: [NUIT_SUR_LA_ROUTE, 'Mira fouille le corps du voyageur.', 'Aldric prend la lettre cachetée.'],
    fouille: {
      sur: LE_CORPS, par: 'mira', texte: 'Un carreau d’arbalète dans le dos. Ses poches n’ont pas été vidées.', argent: 600,
      charges: [{ qui: 'bjorn', enc: 5, max: 8 }, { qui: 'mira', enc: 4, max: 6 }, { qui: 'aldric', enc: 6, max: 6 }, { qui: 'greta', enc: 7, max: 8 }],
      objets: [{ id: 'epee', nom: 'Épée', enc: 1 }, { id: 'habit', nom: 'Vêtements de bonne facture', enc: 1 }],
      reste: 'bjorn',
      gestes: [{ libelle: 'Emporter le reste', principal: true }, { libelle: 'Évaluer' }],
    },
    combattants: combattants(),
  }],
} satisfies Ecran;
